# Test Report — Unreleased two-stage CLI compatibility update

Test date: 2026-06-26

## Release and Git state

- Public npm version: `strict-tailwind-order@1.0.0`.
- Current package version field: `1.0.0`.
- The code covered by this report is unreleased local code intended for the `develop` branch.
- No branch switch, commit, merge, push, tag, release, version change, changelog release entry, or npm publication was performed.
- A real OIDC publication of a new version remains unverified.
- The newest supplied source archive did not contain `.git`, so its exact `develop` branch, commit, remote, tags, and clean working-tree state could not be independently verified from that archive.
- A separate older archive contained Git metadata for historical `master` commit `bcd7b8c700b8cf95fa9998d7e1a50594e55e7ab4` and tag `v1.0.0`; it was not used as the implementation source of truth.

## Changes implemented

### Explicit Prettier config

The CLI now supports:

```text
--config <path>
--config-path <path>
--config=<path>
--config-path=<path>
```

The option can appear before or after inputs. Relative paths resolve from `cwd`; absolute paths are supported. Missing paths, directories, and invalid configuration files return exit code 2 with a clear error.

The explicit configuration is loaded through Prettier's API for every filepath, so `overrides`, additional plugins, official Tailwind options, relative stylesheet paths, and existing environment variables such as `PAGE` are preserved in both stages. No temporary config is written and no environment value is invented.

No silent fallback for `config/prettier.config.mjs` was added. Explicit `--config` is the generic, deterministic solution and avoids ambiguous config selection.

### Vue regular HTML self-closing compatibility

Before the official stage, regular lowercase HTML elements written as self-closing Vue template elements are protected with unique reversible markers. The original names are restored before the strict stage.

Entity-like ampersands inside non-class attributes of protected elements are also protected temporarily. This is required by the real `Consumer-H/src/components/Price.vue` input, which contains `v-text="'&#8362'"` on a self-closing regular HTML element.

The compatibility layer does not change class values, components, void elements, already-closed regular elements, comments, script strings, style content, directives, `:class`, `v-bind:class`, or `:key`. The final structure remains self-closing.

### Error categories and help

- Non-syntax failures can now be identified as `[official]` or `[strict]`.
- Syntax failures remain `[syntax]`.
- CLI help documents `--config` and the `--config-path` alias.

## Files changed

Runtime and tests:

- `lib/cli.mjs`
- `lib/vue-self-closing.cjs`
- `tests/cli.test.mjs`

Documentation:

- `README.md`
- `TEST-REPORT.md`

No protected sorting file was edited. `package.json`, version, release workflow, type declarations, and changelog release history were not changed.

## Baseline before this compatibility update

A clean install was performed with:

```bash
npm ci --ignore-scripts
```

Results before editing the current snapshot:

- Prettier 3.7.3 + `prettier-plugin-tailwindcss@0.8.0`: 113 passed, 0 failed.
- Prettier 3.8.4 + `prettier-plugin-tailwindcss@0.8.0`: 113 passed, 0 failed.
- Sorting regression cases captured: 31.
- Protected runtime hashes captured: 5.

These baseline results were generated again before the implementation and were not copied from a historical report.

## Package tests after implementation

- Prettier 3.7.3 + official plugin 0.8.0: 120 passed, 0 failed.
- Prettier 3.8.4 + official plugin 0.8.0: 120 passed, 0 failed.
- Node 20.19.0 with the current default dependency set: 120 passed, 0 failed.
- Node 22.16.0 with the current default dependency set: 120 passed, 0 failed.
- Node 24.0.0 with the current default dependency set: 120 passed, 0 failed.

The added coverage includes:

- simple and complex regular HTML self-closing Vue elements;
- `v-if`, `v-for`, `v-text`, `:class`, `v-bind:class`, and `:key`;
- entity-like attribute content from the real failure;
- components, void elements, closed elements, comments, script strings, and style content;
- official intermediate output and strict final output;
- second-run idempotence;
- relative and absolute explicit config paths;
- config before and after inputs;
- `--config-path` alias;
- paths with spaces and Windows-style separators;
- missing config, directory config, and syntax-invalid config;
- config `overrides`, additional plugins, `tailwindStylesheet`, and `process.env.PAGE`;
- `--write`, `--check`, current-file execution, and no partial writes.

## Protected sorting contract

`tests/sort.test.cjs` still contains exactly 31 regression tests. Its SHA-256 remained unchanged:

```text
6580ea62303a002453f10d0e5d9d0054118ca8ef7d3c4ae2e5eefefc00088dae
```

All five protected runtime hashes match the baseline exactly:

```text
5383cac01362ea2b4d8e1b434c38c54fa20f898316c9fccd47a2c41d58d10c9f  lib/classify.cjs
9c2f09efe8c1bcfb8f6ccd52e341c64147d4701c11fe83dea95b4893261cb301  lib/sort.cjs
3809bed15b16f616b221ca066c1dea97ccc5699cfb4e42b053c294f0e4e2f4a0  lib/variants.cjs
09da88361b5e126a582bba7ebfaf9f44418e07b67b3193508f842c2ffbaaa0da  lib/constants.cjs
83913f6ad08c609a5a16616d1e862c2ec47c9b9b481b040acb0c17a332d522c1  lib/custom-classes.cjs
```

No expected sorting output was edited.

## Eight-project consumer matrix

Each archive was extracted to a separate temporary working copy. Original archives were not modified. Existing bundled `node_modules` directories were not used. The pipeline was executed through the package binary with both Prettier 3.7.3 and 3.8.4 and official plugin 0.8.0.

The relevant-file manifest contained 281 files. Both Prettier versions produced byte-for-byte identical final output for every successful file.

| Project | Relevant | Successful from original source | Changed on first write | Written on second write | Final result |
| --- | ---: | ---: | ---: | ---: | --- |
| `Consumer-A` | 10 | 10 | 10 | 0 | passed |
| `Consumer-B` | 80 | 80 | 67 | 0 | passed |
| `Consumer-C` | 33 | 33 | 12 | 0 | passed with explicit config |
| `Consumer-D` | 51 | 51 | 20 | 0 | passed with explicit config and PAGE |
| `Consumer-E` | 38 | 38 | 16 | 0 | passed with explicit config and PAGE |
| `Consumer-F` | 12 | 11 | 11 | 0 | one existing syntax error |
| `Consumer-G` | 45 | 45 | 0 | 0 | passed with explicit config |
| `Consumer-H` | 12 | 12 | 8 | 0 | passed, including real Price.vue |
| **Total** | **281** | **280** | **144** | **0** | **one source syntax error** |

For every successful group:

1. initial `--check` behaved as expected;
2. first `--write` succeeded;
3. second `--write` wrote zero files;
4. final `--check` returned 0;
5. no partial write, config failure, stylesheet failure, sorting failure, wrapping failure, or idempotence failure occurred.

Among the selected 281 relevant files:

- parser/syntax errors: 1;
- official-plugin errors after the compatibility fix: 0;
- strict errors: 0;
- config-resolution failures: 0;
- stylesheet-discovery failures: 0;
- sorting failures: 0;
- wrapping failures: 0;
- idempotence failures: 0;
- partial-write failures: 0;
- ignored files: 0;
- unsupported files: 0.

### Proof of stage order

Stage-level analysis on the original inputs showed that the official stage changed files and the strict stage then changed official output again:

| Project | Official stage changed | Strict stage changed |
| --- | ---: | ---: |
| `Consumer-A` | 10 | 4 |
| `Consumer-B` | 66 | 64 |
| `Consumer-C` | 13 | 13 |
| `Consumer-D` | 1 | 20 |
| `Consumer-E` | 3 | 15 |
| `Consumer-F` valid files | 11 | 5 |
| `Consumer-G` | 18 | 18 |
| `Consumer-H` | 8 | 5 |

This verifies official-first and strict-last behavior. `Consumer-G` is notable: both stages changed intermediate output even though the final strict output was already byte-identical to the source.

### Explicit config projects

The following projects were run with:

```text
--config config/prettier.config.mjs
```

- `Consumer-C`
- `Consumer-D`
- `Consumer-E`
- `Consumer-G`

`Consumer-D` was run separately with `PAGE=01` and `PAGE=02-temp`; both official and strict stages resolved the matching page stylesheet. `Consumer-E` was run with `PAGE=01` and both stages resolved `pages/01/src/main.css`.

The supplied `Consumer-C` and `Consumer-G` configs do not declare `tailwindStylesheet`; their explicit Prettier formatting options were loaded, while strict stylesheet discovery resolved the page stylesheets. No config structure or PAGE logic was modified to make the tests pass.

### `Consumer-H`

`Consumer-H/src/components/Price.vue` now passes without changing the consumer source before formatting.

After the complete pipeline:

- three regular `<p ... />` template elements remained self-closing;
- zero empty `<p></p>` replacements were created;
- no fragment was created;
- class values received official processing and strict final ordering;
- the second write produced no change;
- both Prettier versions produced SHA-256 `78c012770209bedb7dd6d83dda35df52cc35536d6482a649aaf088922f21b492` for the final file.

### `Consumer-F`

Original source behavior:

- `dev/src/js/Components/Price.vue` contains `&#8362` without a semicolon.
- The CLI returned exit code 2 with a `[syntax]` error.
- The file hash remained unchanged, proving no partial write.
- The other 11 files passed and were idempotent.

Temporary compatibility copy:

- Only in a separate temporary copy, `&#8362` was changed to `&#8362;`.
- All 12 files then passed.
- First write changed 12 files.
- Second write changed 0 files.
- Final check returned 0.
- Final output was byte-identical between Prettier 3.7.3 and 3.8.4.

The original archive was not changed, and the temporary correction is not presented as a project fix.

## Recommended consumer installation and scripts

### `Consumer-A` (`dev` directory)

The archive contains both npm and pnpm lockfiles. Select one canonical package manager; the recommended pnpm command is:

```bash
pnpm add -D prettier@^3.7.0 prettier-plugin-tailwindcss@0.8.0 strict-tailwind-order
```

```json
{
  "scripts": {
    "format": "strict-tailwind-order --write .",
    "format:check": "strict-tailwind-order --check ."
  }
}
```

### `Consumer-B`

```bash
npm install -D prettier@^3.7.0 prettier-plugin-tailwindcss@0.8.0 strict-tailwind-order
```

```json
{
  "scripts": {
    "format": "strict-tailwind-order --write resources/builds/default/",
    "format:check": "strict-tailwind-order --check resources/builds/default/"
  }
}
```

### `Consumer-C`, `Consumer-D`, `Consumer-E`, and `Consumer-G`

```bash
pnpm add -D prettier@^3.7.0 prettier-plugin-tailwindcss@0.8.0 strict-tailwind-order
```

Keep the existing PAGE-aware `script-proxy.ts`, but replace the raw formatter command with:

```ts
format: {
  cmd: 'strict-tailwind-order',
  args: ['--write', '--config', 'config/prettier.config.mjs'],
},
'format:check': {
  cmd: 'strict-tailwind-order',
  args: ['--check', '--config', 'config/prettier.config.mjs'],
},
```

The existing file-argument handling should apply to both `format` and `format:check`. Keep the existing `{...process.env, PAGE: p}` behavior unchanged.

Recommended package scripts:

```json
{
  "scripts": {
    "format": "tsx config/script-proxy.ts format",
    "format:check": "tsx config/script-proxy.ts format:check"
  }
}
```

Examples:

```bash
pnpm format 01
pnpm format:check 01
pnpm format all
pnpm format:check all
```

### `Consumer-F` (`dev` directory)

The archive contains both npm and pnpm lockfiles. Select one canonical package manager; the recommended pnpm command is:

```bash
pnpm add -D prettier@^3.7.0 prettier-plugin-tailwindcss@0.8.0 strict-tailwind-order
```

```json
{
  "scripts": {
    "format": "strict-tailwind-order --write .",
    "format:check": "strict-tailwind-order --check ."
  }
}
```

The existing malformed entity must be corrected in the consumer project before a full-project format can pass; the CLI should not silently repair invalid source syntax.

### `Consumer-H`

```bash
pnpm add -D prettier@^3.7.0 prettier-plugin-tailwindcss@0.8.0 strict-tailwind-order
```

```json
{
  "scripts": {
    "format": "strict-tailwind-order --write src",
    "format:check": "strict-tailwind-order --check src"
  }
}
```

## Package verification

- `npm pack --dry-run`: passed.
- `npm pack`: passed.
- Generated archive: `strict-tailwind-order-1.0.0.tgz`.
- Package files: 19.
- Packed size: 32,522 bytes.
- Unpacked size: 131,551 bytes.
- npm SHA-1: `619b65c9dc35cd3e76a39c5e875e7a7e413424a2`.
- SHA-256: `0e2bf39f59cb6f754f10fe27550b83a137923c377ca3f78df671bc1a73761304`.
- SHA-512 integrity: `sha512-5rr0wdSXoHtFpCdZQg7f+2L7wQULSHn+cxppp4Qw8eq6gUnSI+EBrHiMGBX01RELOExmKmeaQjF+tDBFVzXD6g==`.
- The binary, updated `lib/cli.mjs`, and updated `lib/vue-self-closing.cjs` are included.
- Tests, fixtures, `.git`, workflow files, package lock, Project Sources, temporary consumers, coverage, caches, ZIP files, and old TGZ files are excluded from the npm package.

## Clean consumer verification

The final TGZ was installed from the generated file into two new consumers with:

- Prettier 3.7.3 or 3.8.4;
- `prettier-plugin-tailwindcss@0.8.0`;
- Tailwind CSS 4.3.1.

Each consumer used:

- a working-directory path containing spaces;
- a Vue current-file path containing spaces;
- a config at `config/prettier.config.mjs`;
- `--config`;
- `process.env.PAGE`;
- filepath overrides;
- `tailwindStylesheet`;
- a regular self-closing `<p ... />` with directives and an entity-like attribute;
- a component, a void element, a closed regular element, a comment, a script string, and style content.

For both Prettier versions:

- first `--write`: passed;
- second `--write`: byte-identical;
- `--check`: exit code 0;
- self-closing structure preserved;
- no fragment or empty expanded `<p></p>` created;
- final SHA-256: `c885438b9bfcc20dd50e6b8a50fbdfd0d6b6f80452cd30c98a25af6980544b2c`.

The final files were byte-identical across both Prettier versions.

## PhpStorm-equivalent terminal verification

The following behavior was verified through the terminal, not through the PhpStorm UI:

- local binary invocation on one current file;
- explicit `--config config/prettier.config.mjs`;
- file path and working directory containing spaces;
- Vue regular HTML self-closing input;
- repeated execution with no second change;
- final `--check` success;
- invocation without a special config path when `prettier.config.mjs` is discoverable at project root.

The PhpStorm graphical interface and an actual File Watcher were not tested interactively.

## Not executed

- No tests were run inside the original consumer archives; all work used separate extracted copies.
- No external consumer project beyond the eight supplied archives and generated clean consumers was tested.
- GitHub-hosted Actions was not executed for this local code.
- Windows-style paths were covered by tests, but the complete final matrix was executed on Linux rather than a real Windows host.
- No commit, push, merge, tag, release, npm publication, or new-version OIDC publication was performed.
