import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import * as officialPlugin from "prettier-plugin-tailwindcss";
import {
  buildPipeline,
  formatThroughPipeline,
  officialConfig,
  runCli,
  strictConfig,
} from "../lib/cli.mjs";
import strictPlugin, * as strictPluginModule from "../index.mjs";
import vueSelfClosingModule from "../lib/vue-self-closing.cjs";

const { protectVueSelfClosingHtmlForOfficial } = vueSelfClosingModule;

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryNodeModules = path.join(repositoryRoot, "node_modules");

function linkDirectory(source, destination) {
  fs.symlinkSync(
    source,
    destination,
    process.platform === "win32" ? "junction" : "dir",
  );
}

function createConsumer(prefix = "strict-tailwind-consumer-") {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.writeFileSync(path.join(directory, "package.json"), '{"type":"module"}\n');
  linkDirectory(repositoryNodeModules, path.join(directory, "node_modules"));
  return directory;
}

function removeConsumer(directory) {
  fs.rmSync(directory, { recursive: true, force: true });
}

function write(directory, relativePath, value) {
  const filePath = path.join(directory, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
  return filePath;
}

function outputCapture() {
  const logs = [];
  const errors = [];
  return {
    logs,
    errors,
    output: {
      log(value) {
        logs.push(String(value));
      },
      error(value) {
        errors.push(String(value));
      },
    },
  };
}

async function withConsumer(callback, prefix) {
  const directory = createConsumer(prefix);
  try {
    return await callback(directory);
  } finally {
    removeConsumer(directory);
  }
}

async function pipelineFor(directory) {
  return buildPipeline(directory);
}

test("builds isolated official and strict plugin configurations", () => {
  const extraPlugin = { options: { sampleOption: { type: "boolean" } } };
  const references = new Map([
    ["strict-tailwind-order", new Set([strictPlugin, strictPluginModule])],
    ["prettier-plugin-tailwindcss", new Set([officialPlugin])],
  ]);
  const config = {
    plugins: [extraPlugin, strictPluginModule, officialPlugin],
    strictTailwindMaxClassLineLength: 80,
    tailwindPreserveDuplicates: true,
  };
  const official = officialConfig(config, officialPlugin, references);
  const strict = strictConfig(config, null, process.cwd(), references);

  assert.deepEqual(official.plugins, [extraPlugin, officialPlugin]);
  assert.equal("strictTailwindMaxClassLineLength" in official, false);
  assert.deepEqual(strict.plugins, [extraPlugin, strictPlugin]);
  assert.equal("tailwindPreserveDuplicates" in strict, false);
});

test("runs official sorting first and strict sorting last", async () => {
  await withConsumer(async (directory) => {
    const filepath = write(
      directory,
      "src/App.html",
      '<div class="px-4 md:px-8 mb-2 md:mb-4"></div>',
    );
    const official = await prettier.format(fs.readFileSync(filepath, "utf8"), {
      filepath,
      plugins: [officialPlugin],
    });
    const pipeline = await pipelineFor(directory);
    const combined = await formatThroughPipeline(
      fs.readFileSync(filepath, "utf8"),
      filepath,
      directory,
      pipeline,
    );

    assert.match(official, /class="mb-2 px-4 md:mb-4 md:px-8"/);
    assert.match(combined, /class="px-4 md:px-8 mb-2 md:mb-4"/);
    assert.equal(
      await formatThroughPipeline(combined, filepath, directory, pipeline),
      combined,
    );
  });
});

test("keeps line-height modifiers with text sizes through the two-stage pipeline", async () => {
  await withConsumer(async (directory) => {
    write(
      directory,
      "src/app.css",
      '@import "tailwindcss";\n@theme { --leading-project: 1.15; }\n',
    );
    write(
      directory,
      "prettier.config.mjs",
      "export default { plugins: ['prettier-plugin-tailwindcss', 'strict-tailwind-order'], tailwindStylesheet: './src/app.css' };\n",
    );
    const filepath = write(
      directory,
      "src/App.vue",
      '<template><div class="font-light mt-4 text-white text-xl/project"></div></template>',
    );
    const pipeline = await pipelineFor(directory);
    const output = await formatThroughPipeline(
      fs.readFileSync(filepath, "utf8"),
      filepath,
      directory,
      pipeline,
    );

    assert.match(output, /class="text-xl\/project font-light text-white mt-4"/);
    assert.equal(
      await formatThroughPipeline(output, filepath, directory, pipeline),
      output,
    );
  });
});

test("uses the same two-stage pipeline for HTML, Vue, JSX, dynamic Vue bindings, and transition attributes", async () => {
  await withConsumer(async (directory) => {
    const pipeline = await pipelineFor(directory);
    const cases = [
      [
        "src/a.html",
        '<div class="px-4 md:px-8 mb-2 md:mb-4"></div>',
        /px-4 md:px-8 mb-2 md:mb-4/,
      ],
      [
        "src/a.vue",
        "<template><div :class=\"['md:px-8 px-4 mb-2']\" /></template>",
        /\['px-4 md:px-8 mb-2'\]/,
      ],
      [
        "src/b.vue",
        "<template><div v-bind:class=\"['md:px-8 px-4 mb-2']\" /></template>",
        /\['px-4 md:px-8 mb-2'\]/,
      ],
      [
        "src/a.jsx",
        'const A=()=> <div className="px-4 md:px-8 mb-2 md:mb-4"/>',
        /px-4 md:px-8 mb-2 md:mb-4/,
      ],
      [
        "src/t.vue",
        '<template><Transition enter-from-class="md:px-8 px-4 mb-2" /></template>',
        /enter-from-class="px-4 md:px-8 mb-2"/,
      ],
    ];

    for (const [relative, source, expected] of cases) {
      const filepath = write(directory, relative, source);
      const output = await formatThroughPipeline(
        source,
        filepath,
        directory,
        pipeline,
      );
      assert.match(output, expected);
      assert.equal(
        await formatThroughPipeline(output, filepath, directory, pipeline),
        output,
      );
    }
  });
});

test("preserves official @apply and tagged-template behavior", async () => {
  await withConsumer(async (directory) => {
    write(
      directory,
      "prettier.config.mjs",
      "export default { plugins: ['prettier-plugin-tailwindcss'], tailwindFunctions: ['tw'] };\n",
    );
    const pipeline = await pipelineFor(directory);
    const cssPath = write(
      directory,
      "src/app.css",
      ".button{@apply px-4 md:px-8 mb-2 md:mb-4;}",
    );
    const jsPath = write(
      directory,
      "src/classes.js",
      "const value = tw`px-4 md:px-8 mb-2 md:mb-4`",
    );
    const css = await formatThroughPipeline(
      fs.readFileSync(cssPath, "utf8"),
      cssPath,
      directory,
      pipeline,
    );
    const js = await formatThroughPipeline(
      fs.readFileSync(jsPath, "utf8"),
      jsPath,
      directory,
      pipeline,
    );

    assert.match(css, /@apply mb-2 px-4 md:mb-4 md:px-8;/);
    assert.match(js, /tw`mb-2 px-4 md:mb-4 md:px-8`/);
  });
});

test("maps official custom attributes and functions into the strict stage", async () => {
  await withConsumer(async (directory) => {
    write(
      directory,
      "prettier.config.mjs",
      "export default { plugins: ['prettier-plugin-tailwindcss', 'strict-tailwind-order'], tailwindAttributes: ['data-classes'], tailwindFunctions: ['cx'] };\n",
    );
    const pipeline = await pipelineFor(directory);
    const htmlPath = write(
      directory,
      "src/a.html",
      '<div data-classes="px-4 md:px-8 mb-2 md:mb-4"></div>',
    );
    const jsPath = write(
      directory,
      "src/a.js",
      "const value = cx('px-4 md:px-8 mb-2 md:mb-4')",
    );
    const html = await formatThroughPipeline(
      fs.readFileSync(htmlPath, "utf8"),
      htmlPath,
      directory,
      pipeline,
    );
    const js = await formatThroughPipeline(
      fs.readFileSync(jsPath, "utf8"),
      jsPath,
      directory,
      pipeline,
    );

    assert.match(html, /data-classes="px-4 md:px-8 mb-2 md:mb-4"/);
    assert.match(js, /cx\(["']px-4 md:px-8 mb-2 md:mb-4["']\)/);
  });
});

test("preserves official default duplicate removal", async () => {
  await withConsumer(async (directory) => {
    const filepath = write(
      directory,
      "src/a.html",
      '<div class="mb-2 px-4 mb-2"></div>',
    );
    const pipeline = await pipelineFor(directory);
    const output = await formatThroughPipeline(
      fs.readFileSync(filepath, "utf8"),
      filepath,
      directory,
      pipeline,
    );

    assert.match(output, /class="px-4 mb-2"/);
  });
});

test("preserves official duplicate and whitespace options", async () => {
  await withConsumer(async (directory) => {
    write(
      directory,
      "prettier.config.mjs",
      "export default { plugins: ['prettier-plugin-tailwindcss'], tailwindPreserveDuplicates: true, tailwindPreserveWhitespace: true };\n",
    );
    const filepath = write(
      directory,
      "src/a.html",
      '<div class="  mb-2   px-4 mb-2  "></div>',
    );
    const pipeline = await pipelineFor(directory);
    const output = await formatThroughPipeline(
      fs.readFileSync(filepath, "utf8"),
      filepath,
      directory,
      pipeline,
    );

    assert.match(output, /class="px-4 mb-2 mb-2"/);
  });
});

test("supports Tailwind v4 stylesheets, imports, custom utilities, variants, and breakpoints", async () => {
  await withConsumer(async (directory) => {
    write(
      directory,
      "styles/theme.css",
      '@theme { --breakpoint-3xl: 120rem; }\n@utility content-auto { content-visibility: auto; }\n@custom-variant theme-midnight (&:where([data-theme="midnight"] *));\n',
    );
    write(
      directory,
      "styles/app.css",
      '@import "tailwindcss";\n@import "./theme.css";\n',
    );
    write(
      directory,
      "prettier.config.mjs",
      "export default { plugins: ['prettier-plugin-tailwindcss'], tailwindStylesheet: './styles/app.css' };\n",
    );
    const filepath = write(
      directory,
      "src/a.html",
      '<div class="3xl:flex theme-midnight:block content-auto flex px-4 md:px-8 mb-2 md:mb-4"></div>',
    );
    const pipeline = await pipelineFor(directory);
    const output = await formatThroughPipeline(
      fs.readFileSync(filepath, "utf8"),
      filepath,
      directory,
      pipeline,
    );

    assert.match(output, /content-auto/);
    assert.match(output, /flex 3xl:flex/);
    assert.match(output, /theme-midnight:block/);
    assert.match(output, /px-4 md:px-8 mb-2 md:mb-4/);
    assert.equal(
      await formatThroughPipeline(output, filepath, directory, pipeline),
      output,
    );
  });
});

test("supports Tailwind v3 configuration through the official stage", async () => {
  await withConsumer(async (directory) => {
    write(
      directory,
      "tailwind.config.cjs",
      "module.exports = { theme: { extend: { colors: { brand: '#123456' } } } };\n",
    );
    write(
      directory,
      "prettier.config.mjs",
      "export default { plugins: ['prettier-plugin-tailwindcss'], tailwindConfig: './tailwind.config.cjs', tailwindPackageName: 'tailwindcss-v3' };\n",
    );
    const filepath = write(
      directory,
      "src/a.html",
      '<div class="px-4 md:px-8 mb-2 md:mb-4 bg-brand"></div>',
    );
    const pipeline = await pipelineFor(directory);
    const output = await formatThroughPipeline(
      fs.readFileSync(filepath, "utf8"),
      filepath,
      directory,
      pipeline,
    );

    assert.match(output, /px-4 md:px-8 mb-2 md:mb-4 bg-brand/);
  });
});

test("keeps regular HTML elements self-closing inside Vue after both stages", async () => {
  await withConsumer(async (directory) => {
    const filepath = write(
      directory,
      "src/a.vue",
      '<template><p class="mb-4 px-2 md:mb-8 md:px-4" /></template>',
    );
    const pipeline = await pipelineFor(directory);
    const output = await formatThroughPipeline(
      fs.readFileSync(filepath, "utf8"),
      filepath,
      directory,
      pipeline,
    );

    assert.match(output, /<p class="px-2 md:px-4 mb-4 md:mb-8" \/>/);
    assert.doesNotMatch(output, /<p><\/p>/);
  });
});

test("CLI supports write, check, multiple files, directories, glob patterns, and repeated current-file execution", async () => {
  await withConsumer(async (directory) => {
    const first = write(
      directory,
      "src/one.html",
      '<div class="px-4 md:px-8 mb-2 md:mb-4"></div>',
    );
    const second = write(
      directory,
      "src/nested/two.vue",
      '<template><p class="mb-4 px-2 md:mb-8 md:px-4" /></template>',
    );
    const capture = outputCapture();

    assert.equal(
      await runCli(["--check", "src"], {
        cwd: directory,
        output: capture.output,
      }),
      1,
    );
    assert.equal(
      await runCli(["--write", "src/one.html", "src/nested"], {
        cwd: directory,
        output: capture.output,
      }),
      0,
    );
    const once = fs.readFileSync(first, "utf8");
    assert.equal(
      await runCli(["--write", first], {
        cwd: directory,
        output: capture.output,
      }),
      0,
    );
    assert.equal(fs.readFileSync(first, "utf8"), once);
    assert.equal(
      await runCli(["--check", "src/**/*.{html,vue}"], {
        cwd: directory,
        output: capture.output,
      }),
      0,
    );
    assert.match(
      fs.readFileSync(second, "utf8"),
      /<p class="px-2 md:px-4 mb-4 md:mb-8" \/>/,
    );
  });
});

test("CLI resolves per-file config overrides and respects .prettierignore", async () => {
  await withConsumer(async (directory) => {
    write(
      directory,
      "prettier.config.mjs",
      "export default { plugins: ['prettier-plugin-tailwindcss'], semi: true, overrides: [{ files: 'src/no-semi.js', options: { semi: false } }] };\n",
    );
    write(directory, ".prettierignore", "src/ignored.html\n");
    const ignored = write(
      directory,
      "src/ignored.html",
      '<div class="px-4 md:px-8 mb-2 md:mb-4"></div>',
    );
    const js = write(directory, "src/no-semi.js", "const classes = 'x'");
    const capture = outputCapture();

    assert.equal(
      await runCli(["--write", "src"], {
        cwd: directory,
        output: capture.output,
      }),
      0,
    );
    assert.equal(
      fs.readFileSync(ignored, "utf8"),
      '<div class="px-4 md:px-8 mb-2 md:mb-4"></div>',
    );
    assert.equal(fs.readFileSync(js, "utf8"), 'const classes = "x"\n');
  });
});

test("CLI reports syntax errors separately and does not write partial official output", async () => {
  await withConsumer(async (directory) => {
    write(
      directory,
      "prettier.config.mjs",
      "export default { plugins: ['prettier-plugin-tailwindcss'], strictTailwindMaxClassLineLength: 'invalid' };\n",
    );
    const filepath = write(
      directory,
      "src/a.html",
      '<div class="px-4 md:px-8 mb-2 md:mb-4"></div>',
    );
    const original = fs.readFileSync(filepath, "utf8");
    const capture = outputCapture();
    const exitCode = await runCli(["--write", filepath], {
      cwd: directory,
      output: capture.output,
    });

    assert.equal(exitCode, 2);
    assert.equal(fs.readFileSync(filepath, "utf8"), original);
    assert.match(capture.errors.join("\n"), /\[strict\]/);
  });
});

test("CLI reports syntax errors separately", async () => {
  await withConsumer(async (directory) => {
    const filepath = write(directory, "src/a.js", "const =");
    const capture = outputCapture();
    assert.equal(
      await runCli(["--check", filepath], {
        cwd: directory,
        output: capture.output,
      }),
      2,
    );
    assert.match(capture.errors.join("\n"), /\[syntax\]/);
  });
});

test("CLI rejects unsupported explicit files and handles paths containing spaces", async () => {
  await withConsumer(async (directory) => {
    const unsupported = write(directory, "src/data.bin", "abc");
    const spaced = write(
      directory,
      "folder with spaces/a.html",
      '<div class="px-4 md:px-8 mb-2 md:mb-4"></div>',
    );
    const capture = outputCapture();

    assert.equal(
      await runCli(["--check", unsupported], {
        cwd: directory,
        output: capture.output,
      }),
      2,
    );
    assert.equal(
      await runCli(["--write", spaced], {
        cwd: directory,
        output: capture.output,
      }),
      0,
    );
    assert.match(fs.readFileSync(spaced, "utf8"), /px-4 md:px-8 mb-2 md:mb-4/);
  }, "strict tailwind consumer with spaces ");
});

test("CLI reports missing consumer dependencies", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "strict-tailwind-missing-"),
  );
  fs.writeFileSync(path.join(directory, "package.json"), "{}");
  try {
    const capture = outputCapture();
    assert.equal(
      await runCli(["--check", "."], {
        cwd: directory,
        output: capture.output,
      }),
      2,
    );
    assert.match(
      capture.errors.join("\n"),
      /requires prettier to be installed/,
    );
  } finally {
    removeConsumer(directory);
  }
});

test("strict family-safe wrapping is the final class-value operation", async () => {
  await withConsumer(async (directory) => {
    write(
      directory,
      "prettier.config.mjs",
      "export default { plugins: ['prettier-plugin-tailwindcss'], strictTailwindMaxClassLineLength: 45 };\n",
    );
    const filepath = write(
      directory,
      "src/a.html",
      '<div class="px-4 md:px-8 mb-2 md:mb-4 items-center sm:items-start md:items-end lg:items-baseline flex"></div>',
    );
    const pipeline = await pipelineFor(directory);
    const output = await formatThroughPipeline(
      fs.readFileSync(filepath, "utf8"),
      filepath,
      directory,
      pipeline,
    );

    assert.match(
      output,
      /items-center sm:items-start md:items-end lg:items-baseline/,
    );
    assert.match(output, /px-4 md:px-8 mb-2 md:mb-4/);
    assert.equal(
      await formatThroughPipeline(output, filepath, directory, pipeline),
      output,
    );
  });
});

test("CLI preserves additional consumer plugins in both stages", async () => {
  await withConsumer(async (directory) => {
    write(
      directory,
      "prettier.config.mjs",
      "const extra = { options: { sampleFlag: { type: 'boolean', default: false } } }; export default { plugins: [extra, 'prettier-plugin-tailwindcss', 'strict-tailwind-order'], sampleFlag: true };\n",
    );
    const filepath = write(
      directory,
      "src/a.html",
      '<div class="px-4 md:px-8 mb-2 md:mb-4"></div>',
    );
    const capture = outputCapture();

    assert.equal(
      await runCli(["--write", filepath], {
        cwd: directory,
        output: capture.output,
      }),
      0,
    );
    assert.match(
      fs.readFileSync(filepath, "utf8"),
      /px-4 md:px-8 mb-2 md:mb-4/,
    );
  });
});

test("CLI resolves multi-page stylesheet overrides per file", async () => {
  await withConsumer(async (directory) => {
    write(
      directory,
      "pages/01/src/main.css",
      '@import "tailwindcss";\n@theme { --breakpoint-3xl: 120rem; }\n',
    );
    write(
      directory,
      "pages/02/src/main.css",
      '@import "tailwindcss";\n@theme { --breakpoint-tablet: 56rem; }\n',
    );
    write(
      directory,
      "prettier.config.mjs",
      "export default { plugins: ['prettier-plugin-tailwindcss'], overrides: [{ files: 'pages/01/**/*', options: { tailwindStylesheet: './pages/01/src/main.css' } }, { files: 'pages/02/**/*', options: { tailwindStylesheet: './pages/02/src/main.css' } }] };\n",
    );
    const pageOne = write(
      directory,
      "pages/01/src/App.vue",
      '<template><div class="3xl:flex mt-4 flex" /></template>',
    );
    const pageTwo = write(
      directory,
      "pages/02/src/App.vue",
      '<template><div class="tablet:flex mt-4 flex" /></template>',
    );
    const capture = outputCapture();

    assert.equal(
      await runCli(["--write", "pages"], {
        cwd: directory,
        output: capture.output,
      }),
      0,
    );
    assert.match(
      fs.readFileSync(pageOne, "utf8"),
      /class="flex 3xl:flex mt-4"/,
    );
    assert.match(
      fs.readFileSync(pageTwo, "utf8"),
      /class="flex tablet:flex mt-4"/,
    );
  });
});

test("CLI accepts Windows-style separators in a relative file path", async () => {
  await withConsumer(async (directory) => {
    const filepath = write(
      directory,
      "src/a.html",
      '<div class="px-4 md:px-8 mb-2 md:mb-4"></div>',
    );
    const capture = outputCapture();

    assert.equal(
      await runCli(["--write", "src\\a.html"], {
        cwd: directory,
        output: capture.output,
      }),
      0,
    );
    assert.match(
      fs.readFileSync(filepath, "utf8"),
      /px-4 md:px-8 mb-2 md:mb-4/,
    );
  });
});

test("CLI reports a missing official plugin from the consumer project", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "strict-tailwind-missing-official-"),
  );
  fs.writeFileSync(path.join(directory, "package.json"), "{}");
  fs.mkdirSync(path.join(directory, "node_modules"));
  linkDirectory(
    path.join(repositoryNodeModules, "prettier"),
    path.join(directory, "node_modules/prettier"),
  );
  try {
    const capture = outputCapture();
    assert.equal(
      await runCli(["--check", "."], {
        cwd: directory,
        output: capture.output,
      }),
      2,
    );
    assert.match(
      capture.errors.join("\n"),
      /requires prettier-plugin-tailwindcss to be installed/,
    );
  } finally {
    removeConsumer(directory);
  }
});

function createFakePackage(directory, name, version) {
  const packageDirectory = path.join(directory, "node_modules", name);
  fs.mkdirSync(packageDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(packageDirectory, "package.json"),
    JSON.stringify({ name, version, type: "module", main: "./index.mjs" }),
  );
  fs.writeFileSync(
    path.join(packageDirectory, "index.mjs"),
    "export default {};\n",
  );
}

test("CLI reports incompatible Prettier and official-plugin versions", async () => {
  const prettierDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "strict-tailwind-old-prettier-"),
  );
  fs.writeFileSync(path.join(prettierDirectory, "package.json"), "{}");
  createFakePackage(prettierDirectory, "prettier", "3.6.0");
  createFakePackage(prettierDirectory, "prettier-plugin-tailwindcss", "0.8.0");

  const officialDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "strict-tailwind-old-official-"),
  );
  fs.writeFileSync(path.join(officialDirectory, "package.json"), "{}");
  createFakePackage(officialDirectory, "prettier", "3.8.4");
  createFakePackage(officialDirectory, "prettier-plugin-tailwindcss", "0.7.2");

  try {
    const prettierCapture = outputCapture();
    assert.equal(
      await runCli(["--check", "."], {
        cwd: prettierDirectory,
        output: prettierCapture.output,
      }),
      2,
    );
    assert.match(
      prettierCapture.errors.join("\n"),
      /Unsupported prettier version 3\.6\.0/,
    );

    const officialCapture = outputCapture();
    assert.equal(
      await runCli(["--check", "."], {
        cwd: officialDirectory,
        output: officialCapture.output,
      }),
      2,
    );
    assert.match(
      officialCapture.errors.join("\n"),
      /Unsupported prettier-plugin-tailwindcss version 0\.7\.2/,
    );
  } finally {
    removeConsumer(prettierDirectory);
    removeConsumer(officialDirectory);
  }
});


test("restores double-digit Vue protection markers without prefix collisions", async () => {
  const tagSource = `<template>
  <p class="mb-4 px-2" />
  <iframe class="mb-4 px-2" />
  <span class="mb-4 px-2" />
  <div class="mb-4 px-2" />
  <section class="mb-4 px-2" />
  <article class="mb-4 px-2" />
  <header class="mb-4 px-2" />
  <footer class="mb-4 px-2" />
  <main class="mb-4 px-2" />
  <aside class="mb-4 px-2" />
  <nav class="mb-4 px-2" />
  <label class="mb-4 px-2" />
</template>`;
  const entitySource = `<template>
  <p data-values="&#65;&#66;&#67;&#68;&#69;&#70;&#71;&#72;&#73;&#74;&#75;" />
</template>`;

  const tagProtection = protectVueSelfClosingHtmlForOfficial(tagSource);
  const entityProtection = protectVueSelfClosingHtmlForOfficial(entitySource);

  assert.equal(tagProtection.protectedCount, 12);
  assert.equal(tagProtection.restore(tagProtection.text), tagSource);
  assert.equal(entityProtection.restore(entityProtection.text), entitySource);

  await withConsumer(async (directory) => {
    const tagFilepath = write(directory, "src/Tags.vue", tagSource);
    const entityFilepath = write(directory, "src/Entities.vue", entitySource);
    const pipeline = await pipelineFor(directory);
    const tagOutput = await formatThroughPipeline(
      tagSource,
      tagFilepath,
      directory,
      pipeline,
    );
    const entityOutput = await formatThroughPipeline(
      entitySource,
      entityFilepath,
      directory,
      pipeline,
    );

    assert.equal(
      await formatThroughPipeline(tagOutput, tagFilepath, directory, pipeline),
      tagOutput,
    );
    assert.equal(
      await formatThroughPipeline(
        entityOutput,
        entityFilepath,
        directory,
        pipeline,
      ),
      entityOutput,
    );
    assert.match(tagOutput, /<iframe class="px-2 mb-4" \/>/);
    assert.match(tagOutput, /<nav class="px-2 mb-4" \/>/);
    assert.match(tagOutput, /<label class="px-2 mb-4" \/>/);
    assert.doesNotMatch(tagOutput, /<(?:iframe|nav|label)\d+\b/);
    assert.doesNotMatch(entityOutput, /&\d+/);
    assert.doesNotMatch(
      `${tagOutput}\n${entityOutput}`,
      /StrictTailwindOrderSelfClosing/,
    );
  });
});

test("protects complex regular HTML self-closing Vue elements before the official stage and restores them before strict", async () => {
  await withConsumer(async (directory) => {
    const source = `<template>
  <p class="mb-4 px-2 md:mb-8 md:px-4" />
  <p
    v-if="visible"
    class="mb-4 px-2 md:mb-8 md:px-4"
    :class="['mb-2 px-4', active && 'md:mb-4 md:px-8']"
    v-text="price"
  />
  <span v-for="item in items" :key="item.id" class="mb-4 px-2" />
  <p class="mb-4 px-2" v-text="'&#8362'" />
  <PriceCard class="mb-4 px-2" />
  <img class="mb-4 px-2" />
  <p class="mb-4 px-2">closed</p>
  <!-- <p class="mb-4 px-2" /> -->
</template>

<script setup>
const visible = true
const active = true
const price = '<p class="mb-4 px-2" />'
const items = []
</script>

<style>
.sample::before { content: '<p class="mb-4 px-2" />'; }
</style>`;
    const filepath = write(directory, "src/Price.vue", source);
    const protection = protectVueSelfClosingHtmlForOfficial(source);

    assert.equal(protection.protectedCount, 4);
    assert.doesNotMatch(protection.text, /<p class="mb-4 px-2 md:mb-8 md:px-4" \/>/);
    assert.match(protection.text, /<PriceCard class="mb-4 px-2" \/>/);
    assert.match(protection.text, /<img class="mb-4 px-2" \/>/);
    assert.match(protection.text, /<!-- <p class="mb-4 px-2" \/> -->/);
    assert.match(protection.text, /const price = '<p class="mb-4 px-2" \/>'/);

    const officialProtected = await prettier.format(protection.text, {
      filepath,
      plugins: [officialPlugin],
    });
    const officialRestored = protection.restore(officialProtected);
    assert.match(officialRestored, /<p[\s\S]*?class="mb-4 px-2 md:mb-8 md:px-4"/);
    assert.doesNotMatch(officialRestored, /StrictTailwindOrderSelfClosing/);

    const pipeline = await pipelineFor(directory);
    const output = await formatThroughPipeline(
      source,
      filepath,
      directory,
      pipeline,
    );

    assert.match(output, /<p class="px-2 md:px-4 mb-4 md:mb-8" \/>/);
    assert.match(output, /class="px-2 md:px-4 mb-4 md:mb-8"/);
    assert.match(output, /:class="\['px-4 mb-2', active && 'md:px-8 md:mb-4'\]"/);
    assert.match(output, /<span[^>]*class="px-2 mb-4"[^>]*\/>/s);
    assert.match(output, /<p[^>]*class="px-2 mb-4"[^>]*v-text="'&#8362'"[^>]*\/>/s);
    assert.match(output, /<PriceCard class="px-2 mb-4" \/>/);
    assert.match(output, /<img class="px-2 mb-4" \/>/);
    assert.match(output, /<p class="px-2 mb-4">closed<\/p>/);
    assert.match(output, /<!-- <p class="mb-4 px-2" \/> -->/);
    assert.match(output, /const price = '<p class="mb-4 px-2" \/>'/);
    assert.match(output, /content: '<p class="mb-4 px-2" \/>'/);
    assert.doesNotMatch(output, /<p><\/p>/);
    assert.doesNotMatch(output, /StrictTailwindOrderSelfClosing/);
    assert.equal(
      await formatThroughPipeline(output, filepath, directory, pipeline),
      output,
    );
  });
});

test("CLI accepts explicit relative config before inputs and preserves overrides, PAGE, and stylesheet mapping", async () => {
  await withConsumer(async (directory) => {
    write(
      directory,
      "config/prettier.config.mjs",
      `import { fileURLToPath, URL } from 'node:url';
const page = process.env.PAGE;
export default {
  semi: true,
  singleQuote: true,
  printWidth: 80,
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindStylesheet: fileURLToPath(new URL(\`../pages/\${page}/src/main.css\`, import.meta.url)),
  overrides: [{ files: '../pages/**/*.js', options: { semi: false } }],
};
`,
    );
    write(
      directory,
      "pages/01/src/main.css",
      '@import "tailwindcss";\n@theme { --breakpoint-tablet: 48rem; }\n',
    );
    const vue = write(
      directory,
      "pages/01/src/App.vue",
      '<template><p class="tablet:px-8 px-4 mb-2" /></template>',
    );
    const js = write(directory, "pages/01/src/app.js", 'const value = "x";');
    const capture = outputCapture();
    const previousPage = process.env.PAGE;
    process.env.PAGE = "01";

    try {
      assert.equal(
        await runCli(
          [
            "--config",
            "config/prettier.config.mjs",
            "--write",
            "pages/01/src",
          ],
          { cwd: directory, output: capture.output },
        ),
        0,
      );
    } finally {
      if (previousPage === undefined) delete process.env.PAGE;
      else process.env.PAGE = previousPage;
    }

    assert.match(fs.readFileSync(vue, "utf8"), /class="px-4 tablet:px-8 mb-2"/);
    assert.equal(fs.readFileSync(js, "utf8"), "const value = 'x'\n");
  });
});

test("CLI accepts absolute config after inputs for write and check", async () => {
  await withConsumer(async (directory) => {
    const config = write(
      directory,
      "config/prettier.config.mjs",
      "export default { singleQuote: true, plugins: ['prettier-plugin-tailwindcss'] };\n",
    );
    const filepath = write(
      directory,
      "src/a.js",
      'const classes = "px-4 md:px-8 mb-2 md:mb-4"',
    );
    const capture = outputCapture();

    assert.equal(
      await runCli(["--check", filepath, "--config", config], {
        cwd: directory,
        output: capture.output,
      }),
      1,
    );
    assert.equal(
      await runCli(["--write", filepath, "--config", config], {
        cwd: directory,
        output: capture.output,
      }),
      0,
    );
    assert.equal(
      await runCli(["--check", filepath, "--config", config], {
        cwd: directory,
        output: capture.output,
      }),
      0,
    );
    assert.match(fs.readFileSync(filepath, "utf8"), /'px-4 md:px-8 mb-2 md:mb-4'/);
  });
});

test("CLI supports config paths with spaces, the --config-path alias, and Windows-style separators", async () => {
  await withConsumer(async (directory) => {
    write(
      directory,
      "config folder/prettier.config.mjs",
      "export default { singleQuote: true, plugins: ['prettier-plugin-tailwindcss'] };\n",
    );
    const filepath = write(directory, "src/a.js", 'const value = "x"');
    const capture = outputCapture();
    const configPath =
      process.platform === "win32"
        ? "config folder\\prettier.config.mjs"
        : "config folder\\prettier.config.mjs";

    assert.equal(
      await runCli(
        ["--write", filepath, "--config-path", configPath],
        { cwd: directory, output: capture.output },
      ),
      0,
    );
    assert.equal(fs.readFileSync(filepath, "utf8"), "const value = 'x';\n");
  }, "strict tailwind explicit config with spaces ");
});

test("CLI rejects missing config paths and directories", async () => {
  await withConsumer(async (directory) => {
    const filepath = write(directory, "src/a.js", "const value=1");
    fs.mkdirSync(path.join(directory, "config"));
    const missingCapture = outputCapture();
    const directoryCapture = outputCapture();

    assert.equal(
      await runCli(["--write", filepath, "--config", "missing.mjs"], {
        cwd: directory,
        output: missingCapture.output,
      }),
      2,
    );
    assert.match(missingCapture.errors.join("\n"), /does not exist/);
    assert.equal(
      await runCli(["--write", filepath, "--config", "config"], {
        cwd: directory,
        output: directoryCapture.output,
      }),
      2,
    );
    assert.match(directoryCapture.errors.join("\n"), /not a file/);
  });
});

test("CLI reports invalid explicit config and leaves files untouched", async () => {
  await withConsumer(async (directory) => {
    write(directory, "config/prettier.config.mjs", "export default {\n");
    const filepath = write(
      directory,
      "src/a.html",
      '<div class="px-4 md:px-8 mb-2 md:mb-4"></div>',
    );
    const original = fs.readFileSync(filepath, "utf8");
    const capture = outputCapture();

    assert.equal(
      await runCli(
        ["--write", filepath, "--config", "config/prettier.config.mjs"],
        { cwd: directory, output: capture.output },
      ),
      2,
    );
    assert.equal(fs.readFileSync(filepath, "utf8"), original);
    assert.match(capture.errors.join("\n"), /Could not load Prettier config/);
  });
});

test("CLI keeps additional plugins from an explicit config in both stages", async () => {
  await withConsumer(async (directory) => {
    write(
      directory,
      "config/marker-plugin.mjs",
      `import * as htmlPlugin from 'prettier/plugins/html';
export const languages = [{ name: 'Marker HTML', parsers: ['marker-html'], extensions: ['.marker'] }];
export const parsers = { 'marker-html': htmlPlugin.parsers.html };
export const printers = { html: htmlPlugin.printers.html };
`,
    );
    write(
      directory,
      "config/prettier.config.mjs",
      `export default {
  plugins: ['./marker-plugin.mjs', 'prettier-plugin-tailwindcss'],
  overrides: [{ files: '**/*.marker', options: { parser: 'marker-html' } }],
};
`,
    );
    const filepath = write(
      directory,
      "src/a.marker",
      '<div class="px-4 md:px-8 mb-2 md:mb-4"></div>',
    );
    const capture = outputCapture();

    assert.equal(
      await runCli(
        ["--write", filepath, "--config", "config/prettier.config.mjs"],
        { cwd: directory, output: capture.output },
      ),
      0,
    );
    assert.match(fs.readFileSync(filepath, "utf8"), /px-4 md:px-8 mb-2 md:mb-4/);
  });
});
