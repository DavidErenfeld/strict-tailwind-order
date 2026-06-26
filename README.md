# strict-tailwind-order

A Prettier 3 plugin and CLI that runs the official `prettier-plugin-tailwindcss` first, then applies strict functional class ordering and family-safe class-line wrapping as the final stage.

The package does not fork, vendor, copy, or reimplement the official plugin.

## Requirements

- Node.js `>=20.19`
- Prettier `>=3.7.0 <4.0.0`
- `prettier-plugin-tailwindcss >=0.8.0 <0.9.0`

## Install

```bash
npm install -D prettier prettier-plugin-tailwindcss strict-tailwind-order
```

## Configure

Use one regular Prettier configuration:

```js
const config = {
  semi: true,
  singleQuote: true,
  printWidth: 120,
  plugins: ['prettier-plugin-tailwindcss', 'strict-tailwind-order'],
};

export default config;
```

Run the `strict-tailwind-order` CLI rather than raw `prettier` when both sorters are configured. The CLI creates two isolated configurations internally:

```text
source
→ Prettier + prettier-plugin-tailwindcss
→ Prettier + strict-tailwind-order
→ final output
```

Other parser and language plugins remain available in both stages. The official plugin is removed from the strict stage and cannot run again after strict sorting or wrapping.

## CLI

```bash
npx strict-tailwind-order --write .
npx strict-tailwind-order --check .
npx strict-tailwind-order --write src
npx strict-tailwind-order --check src/App.vue
npx strict-tailwind-order --check "src/**/*.{js,ts,jsx,tsx,vue,html,css}"
```

`--write` performs both stages in memory and writes only the final output after both stages succeed. `--check` uses the same pipeline without modifying files.

The CLI uses the consumer project's Prettier configuration, overrides, `.prettierignore`, parser inference, installed Prettier, and installed official plugin.

## Package scripts

```json
{
  "scripts": {
    "format": "strict-tailwind-order --write .",
    "format:check": "strict-tailwind-order --check ."
  }
}
```

## CI

```yaml
- run: npm ci
- run: npm run format:check
```

## Pre-commit

Pass the staged file paths to the local CLI. Do not run the official plugin in a separate command after it.

```bash
npx strict-tailwind-order --write src/App.vue src/components/Card.tsx
```

## Official plugin options

The official stage receives the project's official options unchanged, including supported stylesheet, config, attribute, function, duplicate, and whitespace options.

The strict stage maps these options when an equivalent exists:

| Official option | Strict option |
| --- | --- |
| `tailwindStylesheet` or `tailwindEntryPoint` | `strictTailwindStylesheet` |
| `tailwindAttributes` | `strictTailwindAttributes` |
| `tailwindFunctions` | `strictTailwindFunctions` |
| `tailwindPreserveWhitespace` | `strictTailwindPreserveWhitespace` |

`tailwindConfig`, `tailwindPackageName`, and `tailwindPreserveDuplicates` remain official-stage options. The strict stage removes them rather than passing unknown options to Prettier.

## Strict options

```js
const config = {
  plugins: ['prettier-plugin-tailwindcss', 'strict-tailwind-order'],
  strictTailwindMaxClassLineLength: 100,
  strictTailwindStylesheet: 'src/main.css',
  strictTailwindAttributes: ['button-class'],
  strictTailwindFunctions: ['cx'],
  strictTailwindPreserveWhitespace: false,
};

export default config;
```

`strictTailwindStylesheet` is optional because stylesheet discovery remains enabled by default. Set `strictTailwindMaxClassLineLength` to `0` to disable class-content wrapping.

## Existing strict behavior

- Sorts Vue and HTML `class`, JSX and TSX `className`, Vue transition class attributes, dynamic class strings, and configured helper functions.
- Detects common stylesheet entry points, imported local stylesheets, sibling `src/js` and `src/css`, `resources/builds/default/js` and `css`, and isolated multi-page layouts.
- Detects Tailwind v4 breakpoints, custom classes, `@utility`, and `@custom-variant` declarations.
- Preserves regular HTML self-closing elements inside Vue.
- Wraps class content without splitting utility families.
- Keeps unknown classes stable at the end.

## Missing or incompatible dependencies

The CLI fails without modifying files when the consumer project is missing Prettier or `prettier-plugin-tailwindcss`.

It also reports the detected version, supported range, and installation command when either dependency is outside the supported range.

The official plugin can be updated independently within `>=0.8.0 <0.9.0`. A newer minor line must be verified before extending that range.

## PhpStorm File Watcher

Disable PhpStorm's built-in **Run Prettier on save** for the same files. Otherwise the built-in formatter can race with the two-stage CLI and replace the final strict order.

Open:

```text
Settings → Tools → File Watchers
```

Create a custom watcher with these values.

### Linux and macOS

```text
Program: $ProjectFileDir$/node_modules/.bin/strict-tailwind-order
Arguments: --write "$FilePath$"
Working directory: $ProjectFileDir$
Output paths to refresh: $FilePath$
```

### Windows

```text
Program: $ProjectFileDir$\node_modules\.bin\strict-tailwind-order.cmd
Arguments: --write "$FilePath$"
Working directory: $ProjectFileDir$
Output paths to refresh: $FilePath$
```

Configure the watcher for each supported file type or for a project scope covering the required files. The command receives only the current file, including paths containing spaces.

Use these watcher settings:

- Clear **Create output file from stdout**.
- Set console output to appear on errors.
- Clear **Trigger the watcher on external changes** to prevent the CLI write from starting another watcher run.
- Keep the working directory at the project root so dependency, config, stylesheet, and ignore resolution use the consumer project.

Save the file twice during setup. The first save may format it; the second must produce no change.

PhpStorm can store a project-level watcher under `.idea` when the watcher is created at project level. Commit that IDE configuration only when the team intentionally shares it and has reviewed the generated paths.

## Direct Prettier plugin usage

The original direct plugin mode remains available for projects that do not use `prettier-plugin-tailwindcss`:

```js
export default {
  plugins: ['strict-tailwind-order'],
};
```

Raw Prettier format-on-save cannot guarantee the required official-first and strict-last execution when both sorter plugins are loaded in one run. Use the CLI, a package script, CI command, pre-commit command, or PhpStorm File Watcher for the combined architecture.
