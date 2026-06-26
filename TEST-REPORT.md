# Test Report — strict-tailwind-order 1.0.0

Test date: 2026-06-26

## Baseline before repository changes

- Prettier 3.7.3: 91 passed, 0 failed
- Prettier 3.8.4: 91 passed, 0 failed
- Captured sorting regression cases: 31
- Protected sorting-engine files hashed: 5

## Verification after repository changes

- Prettier 3.7.3: 91 passed, 0 failed
- Prettier 3.8.4: 91 passed, 0 failed
- Sorting regression outputs: all 31 byte-identical to baseline
- Protected sorting-engine files: all 5 SHA-256 hashes unchanged
- `package-lock.json`: npm lockfile version 3, Prettier 3.8.4, public npm registry URL
- `npm ci --ignore-scripts`: passed with npm 11.17.0

## Package verification

- `npm pack --dry-run`: passed
- `npm pack`: passed
- Generated archive: `strict-tailwind-order-1.0.0.tgz`
- Package files: 17
- Packed size: 25,189 bytes
- Unpacked size: 102,630 bytes
- TGZ SHA-256: `96db5c1d37c935fab0cdd04c13a0295a34dc9c9dea936fba23c4f182c26fa84c`
- SHA-1: `a7ccdc1700e6368178158381f28158747213ee52`
- SHA-512 integrity: `sha512-p3S3aWJ1wYkJcW4KA5HyBeUrSWxhxQjdrJ9dGsFxVtmNlrgQmtNnuHuOl6Zl/5a6AEC5LzyDPxR8WEckKr2/cA==`
- All required runtime files were present, including `lib/vue-self-closing.cjs`
- `.github`, `docs`, tests, examples, fixtures, caches, coverage, `package-lock.json`, temporary files, and project sources were absent from the package

## Clean consumer verification

The generated TGZ was installed in two clean consumer projects.

### Prettier 3.7.3

- Plugin loaded through `plugins: ['strict-tailwind-order']`
- Automatic stylesheet discovery found `src/main.css`
- Custom `3xl` breakpoint affected class ordering
- Regular Vue HTML element `<p />` remained self-closing
- First `prettier --write`: passed
- Second `prettier --write`: byte-identical
- `prettier --check`: passed

### Prettier 3.8.4

- Plugin loaded through `plugins: ['strict-tailwind-order']`
- Automatic stylesheet discovery found `src/main.css`
- Custom `3xl` breakpoint affected class ordering
- Regular Vue HTML element `<p />` remained self-closing
- First `prettier --write`: passed
- Second `prettier --write`: byte-identical
- `prettier --check`: passed

Both consumer projects produced:

```vue
<template>
  <p class="flex 3xl:flex bg-white mt-4" />
</template>
```

## Not executed

- No GitHub repository was created
- No `git push` was performed
- The GitHub Actions workflow was not executed on GitHub-hosted infrastructure
- No real npm publication was performed
- The historical external multi-project fixture suite was not included in the supplied source-only ZIP and was not rerun
