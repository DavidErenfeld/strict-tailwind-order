# strict-tailwind-order

A Prettier 3 plugin that applies the same strict functional Tailwind class order and family-safe class-line wrapping previously provided by `@daviderenfeld/eslint-plugin-strict-tailwind-order`.

## Install

```bash
pnpm add -D prettier strict-tailwind-order
```

## Configure

```js
/** @type {import('prettier').Config} */
const config = {
  semi: true,
  singleQuote: true,
  bracketSpacing: false,
  printWidth: 120,
  plugins: ['strict-tailwind-order'],
};

export default config;
```

Load this plugin last when other Prettier parser plugins are used.

No ESLint integration or ESLint configuration is required.

## Defaults

- Sorts Vue/HTML `class`, JSX `className`, Vue transition class attributes, and common class helper functions.
- Automatically detects `main.css`, `app.css`, `styles.css`, `globals.css`, `tailwind.css`, and imported stylesheet entry points.
- Detects sibling source layouts such as `src/js` with `src/css`, build layouts such as `resources/builds/default/js` with `css`, and page entry files backed by `pages/<page>/src/main.css`.
- Supports multi-page repositories without selecting a stylesheet from another page.
- Detects Tailwind v4 breakpoints, custom classes, `@utility`, and `@custom-variant` declarations.
- Formats self-closing regular HTML elements inside Vue while preserving `/>`.
- Wraps class content after 100 characters without splitting a utility family across lines.
- Keeps unknown classes at the end in their original order.

## Options

```js
export default {
  plugins: ['strict-tailwind-order'],
  strictTailwindMaxClassLineLength: 100,
  strictTailwindStylesheet: 'src/main.css', // optional; auto-detected by default
  strictTailwindAttributes: ['button-class'],
  strictTailwindFunctions: ['cx'],
};
```

Set `strictTailwindMaxClassLineLength` to `0` to disable class-content wrapping.

## Migration from the ESLint plugin

1. Remove `@daviderenfeld/eslint-plugin-strict-tailwind-order` from the ESLint configuration.
2. Remove the old package.
3. Install this package.
4. Add it to the Prettier `plugins` array.
5. Do not load `prettier-plugin-tailwindcss` at the same time, because both plugins sort the same class strings.
