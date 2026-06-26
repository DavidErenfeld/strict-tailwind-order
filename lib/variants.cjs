const { DEFAULT_BREAKPOINTS, DEFAULT_STATES } = require('./constants.cjs')

const ALWAYS_KNOWN_VARIANTS = new Set([
  '*',
  '**',
  'first-letter',
  'first-line',
  'marker',
  'selection',
  'file',
  'placeholder',
  'backdrop',
  'before',
  'after',
  'first-of-type',
  'last-of-type',
  'only-of-type',
  'default',
  'user-valid',
  'user-invalid',
  'inert',
  'forced-colors',
  'details-content',
  'noscript'
])

function splitVariants(className) {
  const parts = []
  let current = ''
  let square = 0
  let round = 0
  let curly = 0
  let quote = null
  let escaped = false

  for (const char of className) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\') {
      current += char
      escaped = true
      continue
    }

    if (quote) {
      current += char
      if (char === quote) quote = null
      continue
    }

    if (char === '"' || char === "'") {
      current += char
      quote = char
      continue
    }

    if (char === '[') square += 1
    if (char === ']') square = Math.max(0, square - 1)
    if (char === '(') round += 1
    if (char === ')') round = Math.max(0, round - 1)
    if (char === '{') curly += 1
    if (char === '}') curly = Math.max(0, curly - 1)

    if (char === ':' && square === 0 && round === 0 && curly === 0) {
      parts.push(current)
      current = ''
      continue
    }

    current += char
  }

  parts.push(current)

  return {
    variants: parts.slice(0, -1),
    utility: parts.at(-1) || ''
  }
}

function responsiveRank(variant, breakpoints) {
  if (variant.startsWith('max-')) {
    const breakpoint = variant.slice(4)
    const index = breakpoints.indexOf(breakpoint)
    if (index !== -1) return index
  }

  if (variant.startsWith('max-[')) return breakpoints.length

  const exactIndex = breakpoints.indexOf(variant)
  if (exactIndex !== -1) return breakpoints.length + 1 + exactIndex

  if (variant.startsWith('min-')) {
    const breakpoint = variant.slice(4)
    const index = breakpoints.indexOf(breakpoint)
    if (index !== -1) return breakpoints.length * 2 + 1 + index
  }

  if (variant.startsWith('min-[')) return breakpoints.length * 3 + 2
  if (variant.startsWith('@')) return breakpoints.length * 3 + 3

  return null
}

function isKnownVariant(variant, options = {}, depth = 0) {
  if (!variant || depth > 4) return false

  const breakpoints = options.breakpoints || DEFAULT_BREAKPOINTS
  const states = options.states || DEFAULT_STATES
  const customVariants = options.customVariants instanceof Set
    ? options.customVariants
    : new Set(options.customVariants || [])

  if (responsiveRank(variant, breakpoints) !== null) return true
  if (states.includes(variant) || customVariants.has(variant) || ALWAYS_KNOWN_VARIANTS.has(variant)) return true
  if (variant.startsWith('[') && variant.endsWith(']')) return true
  if (variant.startsWith('@')) return true
  if (variant === 'starting' || variant === 'starting-style') return true

  for (const prefix of ['aria-', 'data-', 'supports-', 'ui-']) {
    if (variant.startsWith(prefix) && variant.length > prefix.length) return true
  }

  for (const prefix of ['group-', 'peer-', 'has-', 'not-', 'in-']) {
    if (!variant.startsWith(prefix) || variant.length <= prefix.length) continue
    const tail = variant.slice(prefix.length)
    if (tail.startsWith('[') && tail.endsWith(']')) return true
    if (isKnownVariant(tail, options, depth + 1)) return true
  }

  return false
}

function areVariantsKnown(variants, options = {}) {
  return variants.every((variant) => isKnownVariant(variant, options))
}

function stateRank(variant, states, customVariants = []) {
  const directIndex = states.indexOf(variant)
  if (directIndex !== -1) return directIndex

  const alwaysVariants = [...ALWAYS_KNOWN_VARIANTS]
  const alwaysIndex = alwaysVariants.indexOf(variant)
  if (alwaysIndex !== -1) return states.length + alwaysIndex

  const custom = customVariants instanceof Set ? [...customVariants] : [...(customVariants || [])]
  const customIndex = custom.indexOf(variant)
  if (customIndex !== -1) return states.length + alwaysVariants.length + customIndex

  const prefixes = ['group-', 'peer-', 'has-', 'not-', 'in-']
  for (let i = 0; i < prefixes.length; i += 1) {
    if (variant.startsWith(prefixes[i])) {
      const tail = variant.slice(prefixes[i].length)
      const tailIndex = states.indexOf(tail)
      return states.length * 2 + i * (states.length + 1) + (tailIndex === -1 ? states.length : tailIndex)
    }
  }

  if (variant.startsWith('aria-')) return states.length * 8
  if (variant.startsWith('data-')) return states.length * 8 + 1
  if (variant.startsWith('supports-')) return states.length * 8 + 2
  if (variant.startsWith('starting')) return states.length * 8 + 3
  if (variant.startsWith('[')) return states.length * 8 + 4

  return states.length * 8 + 5
}

function getVariantKey(variants, options = {}) {
  const breakpoints = options.breakpoints || DEFAULT_BREAKPOINTS
  const states = options.states || DEFAULT_STATES
  const responsive = []
  const nonResponsive = []

  for (const variant of variants) {
    const rank = responsiveRank(variant, breakpoints)
    if (rank === null) {
      nonResponsive.push(variant)
    } else {
      responsive.push(rank)
    }
  }

  let tier = 0
  if (responsive.length > 0 && nonResponsive.length === 0) tier = 1
  if (responsive.length === 0 && nonResponsive.length > 0) tier = 2
  if (responsive.length > 0 && nonResponsive.length > 0) tier = 3

  return {
    tier,
    responsive,
    states: nonResponsive.map((variant) => stateRank(variant, states, options.customVariants)),
    raw: variants.join(':')
  }
}

function compareNumberArrays(a, b) {
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i += 1) {
    const left = a[i] ?? -1
    const right = b[i] ?? -1
    if (left !== right) return left - right
  }
  return 0
}

function compareVariantKeys(a, b) {
  if (a.tier !== b.tier) return a.tier - b.tier

  const responsiveComparison = compareNumberArrays(a.responsive, b.responsive)
  if (responsiveComparison !== 0) return responsiveComparison

  const statesComparison = compareNumberArrays(a.states, b.states)
  if (statesComparison !== 0) return statesComparison

  return a.raw.localeCompare(b.raw)
}

module.exports = {
  ALWAYS_KNOWN_VARIANTS,
  areVariantsKnown,
  compareVariantKeys,
  getVariantKey,
  isKnownVariant,
  responsiveRank,
  splitVariants
}
