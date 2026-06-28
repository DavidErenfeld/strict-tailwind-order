# Test Report — strict-tailwind-order 1.0.1

Test and release completion date: 2026-06-29

## Release and Git state

- Published npm version: `strict-tailwind-order@1.0.1`.

- Current package version: `1.0.1`.

- Public/default branch: `master`.

- Release commit:

  ```text
  fba9b3c13e39633bc4381ae4ffcfcf80fba24f80
  ```

- Release tag:

  ```text
  v1.0.1
  ```

- The `develop` implementation was merged into `master`.

- `master` and `v1.0.1` were pushed to GitHub.

- The `Publish to npm` GitHub Actions workflow completed successfully.

- The npm registry reports version `1.0.1`.

- Publication through npm Trusted Publisher and GitHub Actions OIDC is verified.

- The release workflow did not use a fixed npm publication token.

## Released architecture

The supported combined formatting path is:

```text
source
→ Prettier + prettier-plugin-tailwindcss
→ Prettier + strict-tailwind-order
→ final output
```

The architecture guarantees:

- the official plugin runs first;
- strict sorting runs afterward;
- strict family-safe wrapping is the final class-value operation;
- the two sorter plugins run in separate Prettier calls;
- both stages run in memory;
- `--write` writes only after both stages succeed;
- `--check` uses the same pipeline and does not modify files;
- no fork, vendor copy, or reimplementation of the official plugin is used;
- plugin-array order is not used to sequence the two sorter plugins.

## Changes included in 1.0.1

### Explicit Prettier config

The CLI supports:

```text
--config <path>
--config-path <path>
--config=<path>
--config-path=<path>
```

The option can appear before or after inputs.

Supported behavior:

- relative paths resolve from `cwd`;
- absolute paths are supported;
- paths containing spaces are supported;
- Windows-style separators are supported;
- missing config paths return exit code 2;
- directory paths return exit code 2;
- invalid config files return exit code 2;
- explicit config is applied to both pipeline stages;
- filepath-based `overrides` are preserved;
- additional consumer plugins are preserved;
- official Tailwind options are preserved;
- relative stylesheet paths resolve relative to the config file;
- existing environment variables such as `PAGE` remain available;
- no temporary config file is written;
- no environment variable is invented.

No silent fallback for `config/prettier.config.mjs` was added. Explicit `--config` remains the deterministic generic solution.

### Vue regular HTML self-closing compatibility

Before the official stage, regular lowercase HTML elements written as self-closing Vue template elements are protected through reversible markers.

The original names and protected attribute content are restored before the strict stage.

The compatibility layer preserves:

- class values;
- `v-if`;
- `v-for`;
- `v-text`;
- `:class`;
- `v-bind:class`;
- `:key`;
- additional directives and attributes;
- Vue components;
- void elements;
- elements that already have closing tags;
- comments;
- script strings;
- style content.

The final element remains self-closing.

The compatibility layer does not:

- convert `<p ... />` to `<p ...></p>`;
- convert it to a fragment;
- skip the official plugin;
- skip the strict stage;
- hide class values from either sorter;
- change the meaning of the Vue template.

### CLI errors and help

The CLI can distinguish:

```text
[syntax]
[official]
[strict]
```

The help output documents `--config` and the `--config-path` alias.

## Files changed for the compatibility implementation

Runtime and tests:

```text
lib/cli.mjs
lib/vue-self-closing.cjs
tests/cli.test.mjs
```

Documentation included before the release:

```text
README.md
TEST-REPORT.md
```

Release metadata:

```text
package.json
package-lock.json
```

Post-release documentation update:

```text
CHANGELOG.md
TEST-REPORT.md
```

The post-release `CHANGELOG.md` update was not included in the already-published `1.0.1` npm tarball.

No protected sorting-engine file was edited.

## Baseline before the compatibility update

A clean installation was performed with:

```bash
npm ci --ignore-scripts
```

Baseline results:

| Matrix                                 | Passed | Failed |
| -------------------------------------- | -----: | -----: |
| Prettier 3.7.3 + official plugin 0.8.0 |    113 |      0 |
| Prettier 3.8.4 + official plugin 0.8.0 |    113 |      0 |

Additional baseline captures:

- sorting regression cases: 31;
- protected runtime hashes: 5.

These baseline results were regenerated before implementation and were not copied from an older historical report.

## Package tests after implementation

| Environment                            | Passed | Failed |
| -------------------------------------- | -----: | -----: |
| Prettier 3.7.3 + official plugin 0.8.0 |    120 |      0 |
| Prettier 3.8.4 + official plugin 0.8.0 |    120 |      0 |
| Node.js 20.19                          |    120 |      0 |
| Node.js 22.16                          |    120 |      0 |
| Node.js 24                             |    120 |      0 |
| Windows local repository run           |    120 |      0 |

The Windows local run used:

```bash
npm ci --ignore-scripts
npm test
```

Result:

```text
tests 120
pass 120
fail 0
```

Coverage added for 1.0.1 includes:

- simple regular HTML self-closing Vue elements;
- complex self-closing Vue elements;
- `v-if`;
- `v-for`;
- `v-text`;
- `:class`;
- `v-bind:class`;
- `:key`;
- entity-like content in non-class attributes;
- components;
- void elements;
- closed regular elements;
- comments;
- script strings;
- style content;
- official intermediate output;
- strict final output;
- second-run idempotence;
- relative explicit config;
- absolute explicit config;
- config before inputs;
- config after inputs;
- `--config-path`;
- config paths with spaces;
- Windows-style separators;
- missing config;
- directory config;
- syntax-invalid config;
- config `overrides`;
- additional plugins;
- `tailwindStylesheet`;
- `process.env.PAGE`;
- `--write`;
- `--check`;
- current-file execution;
- no partial writes;
- missing dependencies;
- incompatible dependency versions.

## Protected sorting contract

`tests/sort.test.cjs` still contains exactly 31 sorting regression tests.

Its SHA-256 remained unchanged:

```text
6580ea62303a002453f10d0e5d9d0054118ca8ef7d3c4ae2e5eefefc00088dae
```

All five protected runtime hashes remained unchanged:

```text
5383cac01362ea2b4d8e1b434c38c54fa20f898316c9fccd47a2c41d58d10c9f  lib/classify.cjs
9c2f09efe8c1bcfb8f6ccd52e341c64147d4701c11fe83dea95b4893261cb301  lib/sort.cjs
3809bed15b16f616b221ca066c1dea97ccc5699cfb4e42b053c294f0e4e2f4a0  lib/variants.cjs
09da88361b5e126a582bba7ebfaf9f44418e07b67b3193508f842c2ffbaaa0da  lib/constants.cjs
83913f6ad08c609a5a16616d1e862c2ec47c9b9b481b040acb0c17a332d522c1  lib/custom-classes.cjs
```

No expected sorting output was edited.

The update did not change:

- category ranks;
- category precedence;
- family definitions;
- subgroup definitions;
- utility classification;
- base/variant grouping;
- breakpoint precedence;
- state precedence;
- variant-key generation;
- comparator logic;
- tie-breakers;
- unknown-class placement;
- relative stability of unknown classes;
- family adjacency;
- wrapping behavior that affects ordering or splits a family.

## Eight-project consumer matrix

Each supplied archive was extracted into a separate temporary working copy.

The original archives were not modified.

Bundled or old `node_modules` directories were not used.

Each project was tested with:

```text
Prettier 3.7.3
Prettier 3.8.4
prettier-plugin-tailwindcss 0.8.0
```

The relevant-file manifest contained 281 files.

Both Prettier versions produced byte-for-byte identical final output for every successful file.

| Project                  | Relevant files | Successful from original source | Changed on first write | Written on second write | Result                               |
| ------------------------ | -------------: | ------------------------------: | ---------------------: | ----------------------: | ------------------------------------ |
| `Consumer-A` |             10 |                              10 |                     10 |                       0 | passed                               |
| `Consumer-B`         |             80 |                              80 |                     67 |                       0 | passed                               |
| `Consumer-C`           |             33 |                              33 |                     12 |                       0 | passed with explicit config          |
| `Consumer-D`       |             51 |                              51 |                     20 |                       0 | passed with explicit config and PAGE |
| `Consumer-E`        |             38 |                              38 |                     16 |                       0 | passed with explicit config and PAGE |
| `Consumer-F`     |             12 |                              11 |                     11 |                       0 | one existing syntax error            |
| `Consumer-G`     |             45 |                              45 |                      0 |                       0 | passed with explicit config          |
| `Consumer-H`               |             12 |                              12 |                      8 |                       0 | passed, including real Price.vue     |
| **Total**                |        **281** |                         **280** |                **144** |                   **0** | **one invalid source file**          |

For every successful group:

1. initial `--check` behaved as expected;
2. first `--write` succeeded;
3. second `--write` wrote zero files;
4. final `--check` returned exit code 0;
5. no partial write occurred;
6. no config-resolution failure occurred;
7. no stylesheet-resolution failure occurred;
8. no sorting failure occurred;
9. no wrapping failure occurred;
10. no idempotence failure occurred.

Failure totals:

```text
parser/syntax errors:        1
official-plugin errors:      0
strict errors:               0
config-resolution failures:  0
stylesheet failures:         0
sorting failures:            0
wrapping failures:           0
idempotence failures:        0
partial-write failures:      0
ignored relevant files:      0
unsupported relevant files:  0
```

## Proof of stage order

Stage-level analysis showed that the official stage changed source files and that the strict stage then changed official output again.

| Project                          | Official stage changed | Strict stage changed afterward |
| -------------------------------- | ---------------------: | -----------------------------: |
| `Consumer-A`         |                     10 |                              4 |
| `Consumer-B`                 |                     66 |                             64 |
| `Consumer-C`                   |                     13 |                             13 |
| `Consumer-D`               |                      1 |                             20 |
| `Consumer-E`                |                      3 |                             15 |
| `Consumer-F` valid files |                     11 |                              5 |
| `Consumer-G`             |                     18 |                             18 |
| `Consumer-H`                       |                      8 |                              5 |

This confirms:

```text
official first
strict second
strict wrapping last
```

`Consumer-G` is notable because both stages changed intermediate output even though the final strict result was already byte-identical to the original source.

## Explicit config projects

The following projects were run with:

```text
--config config/prettier.config.mjs
```

- `Consumer-C`
- `Consumer-D`
- `Consumer-E`
- `Consumer-G`

`Consumer-D` was tested separately with:

```text
PAGE=01
PAGE=02-temp
```

Both stages resolved the matching page stylesheet.

`Consumer-E` was tested with:

```text
PAGE=01
```

Both stages resolved:

```text
pages/01/src/main.css
```

The supplied `Consumer-C` and `Consumer-G` configs do not declare `tailwindStylesheet`.

Their explicit Prettier options were loaded, while strict stylesheet discovery resolved the page stylesheets.

No config structure or PAGE logic was modified merely to make the tests pass.

## `Consumer-H`

The real file:

```text
Consumer-H/src/components/Price.vue
```

passes without changing the consumer source before formatting.

After the complete pipeline:

- three regular `<p ... />` elements remained self-closing;
- zero empty `<p></p>` replacements were created;
- no fragment was created;
- official class processing occurred;
- strict final ordering occurred;
- second write produced no change;
- both Prettier versions produced identical final output.

Final file SHA-256:

```text
78c012770209bedb7dd6d83dda35df52cc35536d6482a649aaf088922f21b492
```

## `Consumer-F`

Original source behavior:

```text
dev/src/js/Components/Price.vue
```

contains:

```html
&#8362
```

without a terminating semicolon.

Result on the original source:

- CLI exit code: 2;
- error category: `[syntax]`;
- the invalid file remained unchanged;
- no partial write occurred;
- the other 11 relevant files passed;
- the other 11 files were idempotent.

Temporary compatibility-copy behavior:

- only in a separate temporary copy, `&#8362` was changed to `&#8362;`;
- all 12 relevant files then passed;
- first write changed 12 files;
- second write changed 0 files;
- final check returned 0;
- final output was identical between Prettier 3.7.3 and 3.8.4.

The original archive was not modified.

The temporary correction is not presented as a package fix.

## Windows verification in `Consumer-I`

The released implementation was integrated into the real Windows consumer project:

```text
<LOCAL_USER_PATH>\Desktop\Consumer-I
```

The project uses:

```text
config/prettier.config.mjs
pages/01/src/main.css
pages/02/src/main.css
```

The PAGE-aware proxy was changed from raw Prettier to:

```text
strict-tailwind-order
```

with:

```text
--config config/prettier.config.mjs
```

The proxy retained:

```ts
const env = { ...process.env, PAGE: p };
```

Each page is passed separately:

```text
PAGE=01 → pages/01
PAGE=02 → pages/02
```

### Page 01

Initial check reported 14 files requiring formatting.

Results:

```text
first write: 14 files written
second write: 0 files written
final check: passed
```

### Page 02

Initial check reported 6 files requiring formatting.

Results:

```text
first write: 6 files written
second write: 0 files written
final check: passed
```

### All pages

The following command passed:

```bash
pnpm run format:check all
```

Execution confirmed:

```text
PAGE=01 → pages/01
PAGE=02 → pages/02
```

The explicit config, PAGE value, and matching stylesheet were applied independently for each page.

## Recommended consumer installation

Published package installation:

```bash
npm install -D prettier@^3.7.0 prettier-plugin-tailwindcss@0.8.0 strict-tailwind-order@1.0.1
```

With pnpm:

```bash
pnpm add -D prettier@^3.7.0 prettier-plugin-tailwindcss@0.8.0 strict-tailwind-order@1.0.1
```

### Standard config location

```json
{
  "scripts": {
    "format": "strict-tailwind-order --write .",
    "format:check": "strict-tailwind-order --check ."
  }
}
```

### Config in `config/prettier.config.mjs`

```json
{
  "scripts": {
    "format": "strict-tailwind-order --write . --config config/prettier.config.mjs",
    "format:check": "strict-tailwind-order --check . --config config/prettier.config.mjs"
  }
}
```

### PAGE-aware multi-page projects

Keep the existing proxy but replace raw Prettier with:

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

Retain:

```ts
const env = { ...process.env, PAGE: p };
```

Each iteration should pass only its own page directory.

Example:

```ts
taskArgs.push(`pages/${p}`);
```

Commands:

```bash
pnpm run format 01
pnpm run format:check 01
pnpm run format all
pnpm run format:check all
```

## Package verification before release

The final runtime code was packed locally before the version bump.

Results:

```text
npm pack --dry-run: passed
npm pack: passed
package files: 19
packed size: 32.5 kB
unpacked size: 131.6 kB
```

Local pre-release artifact SHA-1:

```text
cecee9323f99d47d37899451eea3bf3b2760a315
```

The package contained:

- the binary;
- `lib/cli.mjs`;
- `lib/vue-self-closing.cjs`;
- all required runtime modules;
- README;
- LICENSE;
- the then-current CHANGELOG;
- package metadata.

The package excluded:

- tests;
- fixtures;
- `.git`;
- GitHub workflow files;
- `node_modules`;
- package lock;
- Project Sources;
- temporary consumers;
- coverage;
- caches;
- ZIP files;
- older TGZ files.

The local artifact used version metadata `1.0.0` before the final version bump.

It is recorded only as pre-release package verification and is not presented as the published `1.0.1` tarball hash.

## Clean consumer verification

The generated final implementation was installed into two new consumers with:

```text
Prettier 3.7.3
Prettier 3.8.4
prettier-plugin-tailwindcss 0.8.0
Tailwind CSS 4.3.1
```

Each consumer used:

- a working-directory path containing spaces;
- a Vue current-file path containing spaces;
- `config/prettier.config.mjs`;
- explicit `--config`;
- `process.env.PAGE`;
- filepath overrides;
- `tailwindStylesheet`;
- a regular self-closing `<p ... />`;
- directives;
- entity-like attribute content;
- a component;
- a void element;
- a closed regular element;
- a comment;
- a script string;
- style content.

For both Prettier versions:

```text
first --write: passed
second --write: byte-identical
--check: exit code 0
self-closing structure: preserved
fragment creation: none
empty expanded <p></p>: none
```

The final files were byte-for-byte identical across both Prettier versions.

Final clean-consumer file SHA-256:

```text
c885438b9bfcc20dd50e6b8a50fbdfd0d6b6f80452cd30c98a25af6980544b2c
```

## PhpStorm-equivalent verification

The following behavior was verified through terminal commands:

- local binary invocation;
- one current file;
- explicit `--config config/prettier.config.mjs`;
- path containing spaces;
- working directory containing spaces;
- Vue regular HTML self-closing input;
- repeated execution with no second change;
- final `--check`;
- execution without explicit config when `prettier.config.mjs` is discoverable at project root.

The PhpStorm graphical interface and an actual File Watcher were not tested interactively.

## GitHub Actions and npm publication verification

Release sequence:

```text
merge develop into master
→ push master
→ update package version to 1.0.1
→ commit release 1.0.1
→ create tag v1.0.1
→ push master and v1.0.1
→ GitHub Actions release workflow
→ npm publication
```

The GitHub Actions run named:

```text
release 1.0.1
```

completed successfully.

The publish job used:

```yaml
publish:
  permissions:
    contents: read
    id-token: write
```

No fixed npm publication token was used.

The npm registry was queried after the workflow completed:

```bash
npm view strict-tailwind-order version
```

Result:

```text
1.0.1
```

This verifies that:

- the tag-triggered workflow ran;
- the package was published;
- the new version is available from the npm registry;
- npm Trusted Publisher OIDC publication succeeded.

## Post-release documentation state

After publication, the repository documentation was updated to describe the completed `1.0.1` release accurately.

Updated after publication:

```text
CHANGELOG.md
TEST-REPORT.md
```

These post-release documentation changes are not part of the already-published `strict-tailwind-order@1.0.1` npm tarball unless a future version is released.

The runtime code, sorting behavior, package version, release tag, and published npm artifact were not changed by this documentation update.

## Remaining limitations

- The original `Consumer-F` archive still contains one invalid source entity.
- The temporary entity correction was not applied to the original archive.
- The PhpStorm graphical File Watcher interface was not tested interactively.
- No external consumer projects beyond the eight supplied archives, generated clean consumers, and `Consumer-I` were claimed as tested.
- The published `1.0.1` package was not modified after publication.
- The post-release `CHANGELOG.md` and `TEST-REPORT.md` updates are currently repository documentation and are not included in the published `1.0.1` tarball.
