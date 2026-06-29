# Changelog

All notable changes to this project are documented in this file.

## [1.0.2] - 2026-06-29

### Fixed

* Prevented prefix collisions between double-digit Vue protection markers such as `Element1` and `Element10`.

* Prevented the equivalent collision for protected entity markers such as `Entity1` and `Entity10`.

* Preserved original self-closing HTML tag names instead of producing invalid elements such as `<iframe0>`.

* Restored protected markers from longest to shortest as an additional safeguard.

### Tests

* Added regression coverage for 12 regular self-closing Vue HTML elements.

* Added regression coverage for 11 protected entity-like attribute values.

* Verified full two-stage pipeline idempotence after marker restoration.

* Verified all 121 automated tests.

* Verified nine anonymized consumer projects across 11 targets and 262 relevant files: 178 first-pass changes, zero second-pass changes, zero leaked placeholders, zero tag-structure differences, and 10 of 11 builds passed; the remaining build was blocked by a dependency missing from the supplied archive.

## [1.0.1] - 2026-06-29

### Added

* Added the `strict-tailwind-order` two-stage CLI.

* Added `--write` and `--check` modes.

* Added support for files, directories, glob patterns, multiple inputs, and current-file execution.

* Added explicit Prettier configuration support through:

  ```text
  --config <path>
  --config-path <path>
  ```

* Added support for relative, absolute, space-containing, and Windows-style config paths.

* Added filepath-aware support for Prettier `overrides`.

* Added preservation of additional consumer plugins in both formatting stages.

* Added support for environment-dependent Prettier configuration such as `process.env.PAGE`.

* Added separate CLI error categories for syntax, official-plugin, and strict-stage failures.

* Added CLI validation for supported Prettier and official-plugin versions.

* Added compatibility preprocessing for regular lowercase HTML elements written as self-closing Vue template elements.

### Changed

* The supported combined formatting flow is now:

  ```text
  source
  → Prettier + prettier-plugin-tailwindcss
  → Prettier + strict-tailwind-order
  → final output
  ```

* The official Tailwind plugin always runs first in an isolated Prettier call.

* Strict functional-family sorting and family-safe wrapping always run last in a second Prettier call.

* Both formatting stages run in memory.

* `--write` writes only after both stages complete successfully.

* `--check` uses the same pipeline without modifying files.

* Consumer projects with non-standard config locations can now pass their config explicitly.

* Multi-page projects can continue using their existing `PAGE`-aware proxy and run one page at a time behind an `all` command.

* Documentation and examples were updated for package scripts, CI, pre-commit hooks, explicit configs, multi-page projects, and PhpStorm File Watchers.

### Fixed

* Fixed failure of the official Tailwind plugin on Vue templates containing regular HTML elements such as:

  ```vue
  <p class="mb-4 px-2 md:mb-8 md:px-4" />
  ```

* Preserved regular HTML self-closing structure after both formatting stages.

* Prevented conversion to expanded empty elements or fragments.

* Protected entity-like attribute content on self-closing Vue elements before the official stage.

* Fixed config resolution for projects using:

  ```text
  config/prettier.config.mjs
  ```

* Preserved `tailwindStylesheet`, Tailwind attributes, Tailwind functions, filepath overrides, additional plugins, and existing environment variables in explicit configs.

* Ensured syntax or pipeline failures do not leave partially formatted files on disk.

### Verified

* 120 package tests passed with Prettier 3.7.3.
* 120 package tests passed with Prettier 3.8.4.
* Tests passed with Node.js 20.19, 22.16, and 24.
* All 31 protected sorting regression tests remained unchanged.
* All five protected sorting-engine hashes remained unchanged.
* Eight supplied consumer projects were tested across 281 relevant files.
* `Consumer-H/src/components/Price.vue` now passes without consumer-source changes.
* Multi-page explicit-config behavior was verified with `PAGE`.
* Windows execution was verified in `Consumer-I`, including `format`, repeated `format`, `format:check`, and `format:check all`.
* The npm package contained 19 runtime files and excluded tests, caches, temporary consumers, and Project Sources.
* Version `1.0.1` was published through the GitHub Actions release workflow.
* npm Trusted Publisher publication through OIDC was successfully verified.
* The npm registry reports:

  ```text
  strict-tailwind-order@1.0.1
  ```

## [1.0.0] - 2026-06-26

### Added

* Initial public release of the `strict-tailwind-order` Prettier 3 plugin.
* Strict functional Tailwind utility ordering.
* Protected functional-family adjacency.
* Family-safe class-line wrapping.
* Vue, HTML, JSX, TSX, dynamic class binding, transition attribute, and configured helper-function support.
* Tailwind stylesheet discovery.
* Tailwind v4 custom breakpoint, custom class, `@utility`, and `@custom-variant` support.
* Stable placement of unknown classes.
