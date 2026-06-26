# Test Report — Unreleased two-stage CLI

Test date: 2026-06-26

## Release state

- Public npm version: `strict-tailwind-order@1.0.0`
- Current repository version field: `1.0.0`
- The code covered by this report is unreleased
- No tag, push, GitHub release, or npm publication was performed
- A real OIDC publication of a new version remains unverified

## Baseline before implementation

- Branch: `master`
- Commit: `bcd7b8c700b8cf95fa9998d7e1a50594e55e7ab4`
- Existing tag: `v1.0.0`
- Working tree: clean
- Prettier 3.7.3: 91 passed, 0 failed
- Prettier 3.8.4: 91 passed, 0 failed
- Sorting regression cases captured: 31
- Protected sorting-engine files hashed: 5

## Verification after implementation

### Dependency matrix

- Prettier 3.7.3 with `prettier-plugin-tailwindcss@0.8.0`: 113 passed, 0 failed
- Prettier 3.8.4 with `prettier-plugin-tailwindcss@0.8.0`: 113 passed, 0 failed
- `npm ci --ignore-scripts`: passed
- npm audit result during clean install: 0 vulnerabilities

### Node matrix

The full 113-test suite passed with the installed Prettier 3.8.4 and official plugin 0.8.0 under:

- Node 20.19.0
- Node 22.16.0
- Node 24.0.0

### Pipeline coverage

The suite verifies:

- official stage execution before strict
- strict ordering as the final order
- strict family-safe wrapping as the final class-value operation
- no official-stage rerun after strict
- identical pipeline use for `--write` and `--check`
- no intermediate or partial disk write
- idempotence
- HTML, Vue, JSX, TSX-compatible parser paths
- Vue `:class` and `v-bind:class`
- Vue transition class attributes
- `@apply`
- configured attributes and functions
- tagged templates
- duplicate and whitespace options
- Tailwind v4 stylesheet data
- Tailwind v3 configuration through the official stage
- imported stylesheets, custom utilities, custom variants, and custom breakpoints
- multi-page configuration overrides
- regular HTML self-closing elements inside Vue
- files, multiple inputs, directories, globs, ignored files, unsupported files, syntax errors, and version errors
- paths containing spaces and Windows-style separators on Linux
- preservation of additional consumer plugins
- current-file and repeated File Watcher-style execution

## Protected sorting contract

- `tests/sort.test.cjs` still contains 31 regression cases
- all 31 cases passed against their unchanged expected outputs
- no protected sorting file appears in the Git diff
- all five protected SHA-256 hashes are unchanged from baseline

```text
5383cac01362ea2b4d8e1b434c38c54fa20f898316c9fccd47a2c41d58d10c9f  lib/classify.cjs
9c2f09efe8c1bcfb8f6ccd52e341c64147d4701c11fe83dea95b4893261cb301  lib/sort.cjs
3809bed15b16f616b221ca066c1dea97ccc5699cfb4e42b053c294f0e4e2f4a0  lib/variants.cjs
09da88361b5e126a582bba7ebfaf9f44418e07b67b3193508f842c2ffbaaa0da  lib/constants.cjs
83913f6ad08c609a5a16616d1e862c2ec47c9b9b481b040acb0c17a332d522c1  lib/custom-classes.cjs
```

## Package verification

- `npm pack --dry-run`: passed
- `npm pack`: passed
- Generated archive: `strict-tailwind-order-1.0.0.tgz`
- Package files: 19
- Packed size: 30,462 bytes
- Unpacked size: 121,296 bytes
- SHA-256: `30cc417d4b2039bfa22daa727a2b245d447e0484b4c65e285b06e7cee6ba5251`
- SHA-1: `6cb9a075b65879166198ca3b3f07cd8d561e7b09`
- SHA-512 integrity: `sha512-N7rO/LbCSIci8niRkQt++krKFdA5iigUrghl/LLRFOy/Rz7otpdEYIwTe7+3kH51gDUOMjentnWMVpE+oiqwkg==`
- `bin/strict-tailwind-order.mjs` is included
- `lib/cli.mjs` is included
- tests, project sources, workflow files, package lock, caches, and temporary consumers are excluded from the npm package

## Clean consumer verification

The final TGZ was installed in two newly created consumer projects with `prettier-plugin-tailwindcss@0.8.0` and Tailwind CSS 4.3.1.

### Prettier 3.7.3

- local binary resolved from `node_modules/.bin`
- single Vue file processed from a path containing spaces
- first `--write`: passed
- second `--write`: byte-identical
- `--check`: passed with exit code 0

### Prettier 3.8.4

- local binary resolved from `node_modules/.bin`
- single Vue file processed from a path containing spaces
- first `--write`: passed
- second `--write`: byte-identical
- `--check`: passed with exit code 0

Both consumers produced the same SHA-256 and final output:

```text
422f9c5071d98bb4ca45bc83b7b09edfea8b97d1c544d3d14541a69ec027af34
```

```vue
<template>
  <p
    class="
      flex 3xl:flex items-center sm:items-start md:items-end
      px-2 md:px-4 mb-4 md:mb-8
    "
  />
</template>
```

This verifies official duplicate removal, strict final ordering, strict final wrapping, custom breakpoint handling, self-closing Vue compatibility, and idempotence.

## PhpStorm verification

- JetBrains macro names and watcher fields were checked against official documentation
- the equivalent local-binary command was executed from the terminal on one current file
- a path containing spaces was verified
- repeated execution was verified as byte-identical
- the PhpStorm graphical interface itself was not available and was not tested interactively

## Not executed

- the historical external consumer-project fixture archive was not supplied and was not rerun
- GitHub-hosted Actions was not executed
- no actual File Watcher was created inside PhpStorm
- no commit, push, tag, release, or npm publication was performed
- no new-version OIDC publication was performed
