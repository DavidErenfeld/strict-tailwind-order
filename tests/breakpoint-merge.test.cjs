const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  clearStylesheetCache,
  loadStylesheetTheme,
  mergeBreakpoints,
  normalizeCssIdentifier,
  parseThemeVariables
} = require('../lib/stylesheet.cjs')
const { DEFAULT_BREAKPOINT_METADATA, DEFAULT_BREAKPOINTS } = require('../lib/constants.cjs')
const { resolveSortOptions } = require('../lib/settings.cjs')
const { sortClassSource } = require('../lib/sort.cjs')

function cssTheme(block) {
  return `@theme {\n${block}\n}`
}

function parseBreakpoints(css) {
  return parseThemeVariables(css).breakpoints
}

function mergeFromCss(css, explicitOrder = null) {
  return mergeBreakpoints(
    DEFAULT_BREAKPOINT_METADATA,
    parseBreakpoints(css),
    explicitOrder
  )
}

test('override one built-in breakpoint keeps every built-in name', () => {
  const breakpoints = mergeFromCss(cssTheme('  --breakpoint-md: 50rem;'))
  assert.deepEqual(breakpoints, ['sm', 'md', 'lg', 'xl', '2xl'])
})

test('adds a breakpoint before sm', () => {
  const breakpoints = mergeFromCss(cssTheme('  --breakpoint-xs: 30rem;'))
  assert.deepEqual(breakpoints, ['xs', 'sm', 'md', 'lg', 'xl', '2xl'])
})

test('inserts a breakpoint between md and lg', () => {
  const breakpoints = mergeFromCss(cssTheme('  --breakpoint-tablet: 56rem;'))
  assert.deepEqual(breakpoints, ['sm', 'md', 'tablet', 'lg', 'xl', '2xl'])
})

test('adds a breakpoint after 2xl', () => {
  const breakpoints = mergeFromCss(cssTheme('  --breakpoint-3xl: 120rem;'))
  assert.deepEqual(breakpoints, ['sm', 'md', 'lg', 'xl', '2xl', '3xl'])
})

test('overrides and extends breakpoints together', () => {
  const breakpoints = mergeFromCss(cssTheme(`
    --breakpoint-md: 50rem;
    --breakpoint-tablet: 56rem;
    --breakpoint-3xl: 120rem;
  `))
  assert.deepEqual(breakpoints, ['sm', 'md', 'tablet', 'lg', 'xl', '2xl', '3xl'])
})

test('explicit breakpointOrder wins exactly', () => {
  const breakpoints = mergeFromCss(
    cssTheme(`
      --breakpoint-md: 50rem;
      --breakpoint-tablet: 56rem;
      --breakpoint-3xl: 120rem;
    `),
    ['xs', 'sm', 'md', 'tablet', 'lg', 'xl', '2xl', '3xl']
  )
  assert.deepEqual(breakpoints, ['xs', 'sm', 'md', 'tablet', 'lg', 'xl', '2xl', '3xl'])
})

test('sorts same-unit breakpoints numerically without unit conversion', () => {
  const css = cssTheme(`
    --breakpoint-2xl: 96rem;
    --breakpoint-2\\.5xl: 100rem;
    --breakpoint-3xl: 120rem;
  `)
  const breakpoints = mergeFromCss(css)
  assert.deepEqual(breakpoints, ['sm', 'md', 'lg', 'xl', '2xl', '2.5xl', '3xl'])
  assert.equal(
    sortClassSource('3xl:w-1/4 w-full 2.5xl:w-1/3 2xl:w-1/2', { breakpoints }),
    'w-full 2xl:w-1/2 2.5xl:w-1/3 3xl:w-1/4'
  )
})

test('mixed-unit breakpoints preserve CSS declaration order without unit conversion', () => {
  const css = cssTheme(`
    --breakpoint-2xl: 96rem;
    --breakpoint-3xl: 1800px;
  `)
  const breakpoints = mergeFromCss(css)
  assert.deepEqual(breakpoints, ['sm', 'md', 'lg', 'xl', '2xl', '3xl'])
  assert.equal(
    sortClassSource('3xl:w-1/4 w-full 2xl:w-1/2', { breakpoints }),
    'w-full 2xl:w-1/2 3xl:w-1/4'
  )
})

test('mixed-unit breakpoints keep declaration order when px is declared before rem', () => {
  const css = cssTheme(`
    --breakpoint-wide: 1800px;
    --breakpoint-2xl: 96rem;
  `)
  const breakpoints = mergeFromCss(css)
  assert.deepEqual(breakpoints, ['sm', 'md', 'lg', 'xl', 'wide', '2xl'])
})

test('mixed-unit declaration order is deterministic when rem and px are interleaved in CSS', () => {
  const css = cssTheme(`
    --breakpoint-3xl: 1800px;
    --breakpoint-2xl: 96rem;
  `)
  const inferred = mergeFromCss(css)
  assert.deepEqual(inferred, ['sm', 'md', 'lg', 'xl', '3xl', '2xl'])

  const explicit = mergeFromCss(css, ['sm', 'md', 'lg', 'xl', '2xl', '3xl'])
  assert.deepEqual(explicit, ['sm', 'md', 'lg', 'xl', '2xl', '3xl'])
})

test('mixed-unit breakpoint sorting is idempotent', () => {
  const css = cssTheme(`
    --breakpoint-wide: 1800px;
    --breakpoint-2xl: 96rem;
  `)
  const breakpoints = mergeFromCss(css)
  const input = 'wide:w-1/4 w-full 2xl:w-1/2'
  const once = sortClassSource(input, { breakpoints })
  const twice = sortClassSource(once, { breakpoints })
  assert.equal(twice, once)
  assert.equal(once, 'w-full wide:w-1/4 2xl:w-1/2')
})

test('responsive sorting inserts custom breakpoints relative to built-ins', () => {
  const css = cssTheme(`
    --breakpoint-xs: 30rem;
    --breakpoint-tablet: 56rem;
    --breakpoint-3xl: 120rem;
  `)
  const breakpoints = mergeFromCss(css)
  assert.equal(
    sortClassSource('3xl:w-1/4 w-full tablet:w-1/3 xs:w-[90%] lg:w-1/2', { breakpoints }),
    'w-full xs:w-[90%] tablet:w-1/3 lg:w-1/2 3xl:w-1/4'
  )
})

test('max variants follow the combined breakpoint sequence', () => {
  const css = cssTheme(`
    --breakpoint-xs: 30rem;
    --breakpoint-tablet: 56rem;
    --breakpoint-3xl: 120rem;
  `)
  const breakpoints = mergeFromCss(css)
  assert.equal(
    sortClassSource('max-3xl:flex-wrap max-tablet:flex-row max-xs:flex-col', { breakpoints }),
    'max-xs:flex-col max-tablet:flex-row max-3xl:flex-wrap'
  )
})

test('normalizeCssIdentifier unescapes breakpoint names', () => {
  const parsed = parseThemeVariables(cssTheme('  --breakpoint-2\\.5xl: 100rem;'))
  assert.deepEqual(parsed.breakpoints.map((breakpoint) => breakpoint.name), ['2.5xl'])
  assert.equal(normalizeCssIdentifier('2\\.5xl'), '2.5xl')
})

test('resolveSortOptions uses built-in metadata and explicit breakpointOrder', () => {
  clearStylesheetCache()
  const context = {
    cwd: path.join(__dirname, 'fixtures'),
    settings: {
      strictTailwindOrder: {
        stylesheet: 'themes/mixed-unit-breakpoints.css',
        breakpointOrder: DEFAULT_BREAKPOINTS.concat(['3xl'])
      }
    },
    options: [{}]
  }

  const options = resolveSortOptions(context, {})
  assert.deepEqual(options.breakpoints, ['sm', 'md', 'lg', 'xl', '2xl', '3xl'])
})

test('loadStylesheetTheme rejects directories without throwing', () => {
  clearStylesheetCache()
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tailwind-order-'))

  try {
    const result = loadStylesheetTheme(directory)
    assert.equal(result.ok, false)
    assert.equal(result.error, 'IS_DIRECTORY')
    assert.match(result.message, /directory, not a file/)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('loadStylesheetTheme reports missing files without throwing', () => {
  clearStylesheetCache()
  const result = loadStylesheetTheme(path.join(os.tmpdir(), 'missing-stylesheet.css'))
  assert.equal(result.ok, false)
  assert.equal(result.error, 'NOT_FOUND')
})

test('loadStylesheetTheme reads valid fixture theme files', () => {
  clearStylesheetCache()
  const loaded = loadStylesheetTheme(path.join(__dirname, 'fixtures/tailwind-v4-theme/main.css'))
  assert.equal(loaded.ok, true)
  assert.deepEqual(mergeBreakpoints(DEFAULT_BREAKPOINT_METADATA, loaded.breakpoints), [
    'sm',
    'md',
    'lg',
    'xl',
    '2xl',
    '3xl'
  ])
})
