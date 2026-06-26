/** @type {import('prettier').Config} */
const config = {
  semi: true,
  singleQuote: true,
  bracketSpacing: false,
  bracketSameLine: false,
  singleAttributePerLine: false,
  htmlWhitespaceSensitivity: 'css',
  printWidth: 120,
  tabWidth: 2,
  plugins: ['strict-tailwind-order'],
};

export default config;
