const test = require('node:test')
const assert = require('node:assert/strict')
const { parseThemeVariables, stripCssComments } = require('../lib/stylesheet.cjs')

test('stripCssComments removes block comments but preserves quoted strings', () => {
  const css = `
    @theme {
      --color-keep: "/* not a comment */";
    }

    /* @theme {
      --color-fake: red;
    } */
  `

  const stripped = stripCssComments(css)
  assert.match(stripped, /--color-keep: "\/\* not a comment \*\/"/)
  assert.doesNotMatch(stripped, /--color-fake/)
})

test('parseThemeVariables ignores commented-out theme declarations', () => {
  const parsed = parseThemeVariables(`
    /* @theme { --color-fake: red; } */

    @theme {
      /* --color-hidden: blue; */
      --color-real: green;
    }
  `)

  assert.deepEqual(parsed.colors, ['real'])
})

test('parseThemeVariables supports a final declaration without a semicolon', () => {
  const parsed = parseThemeVariables(`
    @theme {
      --color-primary: red
    }
  `)

  assert.deepEqual(parsed.colors, ['primary'])
})

test('parseThemeVariables supports mixed declarations with only the final one omitting a semicolon', () => {
  const parsed = parseThemeVariables(`
    @theme {
      --text-hero: 4rem;
      --color-primary: red
    }
  `)

  assert.deepEqual(parsed.fontSizes, ['hero'])
  assert.deepEqual(parsed.colors, ['primary'])
})

test('parseThemeVariables supports metadata and escaped identifiers without final semicolons', () => {
  const parsed = parseThemeVariables(`
    @theme {
      --text-2\\.5xl: 1.75rem;
      --text-hero--line-height: 1.1;
      --color-primary: red
    }
  `)

  assert.deepEqual(parsed.fontSizes, ['2.5xl'])
  assert.deepEqual(parsed.colors, ['primary'])
})

test('parseThemeVariables ignores closing braces inside quoted values', () => {
  const parsed = parseThemeVariables(`
    @theme {
      --font-test: "}";
      --color-real: red;
      --text-hero: 4rem;
    }
  `)

  assert.deepEqual(parsed.colors, ['real'])
  assert.deepEqual(parsed.fontSizes, ['hero'])
})

test('parseThemeVariables handles semicolons and braces inside quoted values', () => {
  const parsed = parseThemeVariables(`
    @theme inline {
      --font-test: "a;b}c";
      --color-primary: #123456;
    }
  `)

  assert.deepEqual(parsed.colors, ['primary'])
})

test('extractCustomClassData reads ordinary selectors and Tailwind utility declarations', () => {
  const { extractCustomClassData } = require('../lib/stylesheet.cjs')
  const parsed = extractCustomClassData(`
    .project-card, .ntlv-scrollbar-none:hover { display: block; }
    .hover\\:special:hover { opacity: 1; }
    @media (min-width: 40rem) {
      .nested-card .child-card { display: grid; }
    }
    @supports selector(.not-a-real-rule) {
      .supported-card { display: flex; }
    }
    @utility content-auto { content-visibility: auto; }
    @utility tab-* { tab-size: --value(integer); }
    .quoted::before { content: ".not-a-class"; }
  `)

  assert.deepEqual(
    [...parsed.classes].sort(),
    [
      'child-card',
      'hover:special',
      'nested-card',
      'ntlv-scrollbar-none',
      'project-card',
      'quoted',
      'supported-card'
    ]
  )
  assert.deepEqual(parsed.utilities, ['content-auto'])
  assert.deepEqual(parsed.utilityPatterns, ['tab-*'])
})

test('extractCssImports returns local and package imports without matching comments', () => {
  const { extractCssImports } = require('../lib/stylesheet.cjs')
  assert.deepEqual(
    extractCssImports(`
      /* @import './ignored.css'; */
      @import './base.css';
      @import url("../components/cards.css") layer(components);
      @import 'tailwindcss';
    `),
    ['./base.css', '../components/cards.css', 'tailwindcss']
  )
})

test('extractCustomVariants reads statement and block custom variants', () => {
  const { extractCustomVariants } = require('../lib/stylesheet.cjs')
  assert.deepEqual(
    extractCustomVariants(`
      /* @custom-variant ignored (&:hover); */
      @custom-variant theme-midnight (&:where([data-theme="midnight"] *));
      @custom-variant theme-ocean {
        &:where([data-theme="ocean"] *) { @slot; }
      }
      @custom-variant theme-midnight (&:where(.duplicate *));
    `),
    ['theme-midnight', 'theme-ocean']
  )
})
