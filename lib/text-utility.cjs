const { isRecognizedColorSuffix } = require('./color-suffix.cjs')

const STANDARD_TEXT_SIZE_RE = /^text-(xs|sm|base|lg|xl|[0-9]+(?:\.[0-9]+)?xl)$/
const TYPED_TEXT_SIZE_RE = /^text-\((?:length|size):[^)]+\)$/
const TYPED_TEXT_COLOR_RE = /^text-\(color:[^)]+\)$/
const LINE_HEIGHT_MODIFIER_RE = /^(?:\d+(?:\.\d+)?|[A-Za-z0-9_-]+|\[[^\]]+\]|\([^\)]+\))$/

function splitLineHeightModifier(utility) {
  const slash = utility.indexOf('/')
  if (slash === -1) return { base: utility, modifier: null }

  return {
    base: utility.slice(0, slash),
    modifier: utility.slice(slash + 1)
  }
}

function hasValidLineHeightModifier(modifier) {
  return modifier === null || LINE_HEIGHT_MODIFIER_RE.test(modifier)
}

function normalizeThemeList(values) {
  if (!values?.length) return new Set()
  return new Set(values.map((value) => String(value).trim()).filter(Boolean))
}

function createThemeSets(options = {}) {
  const theme = options.theme || {}
  const fontSizes = normalizeThemeList(theme.fontSize)
  const colors = normalizeThemeList(theme.colors)

  for (const value of fontSizes) {
    if (value.startsWith('text-')) colors.delete(value.slice(5))
  }

  return { fontSizes, colors }
}

function arbitraryTextValue(utility) {
  const start = utility.indexOf('[')
  const end = utility.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return null
  return utility.slice(start + 1, end).trim()
}

function isArbitraryTextSize(utility) {
  if (!utility.startsWith('text-[')) return false
  if (utility.includes(']/[') || utility.includes(']/')) return true

  const value = arbitraryTextValue(utility)
  if (!value) return false
  if (/^(length|size):/i.test(value)) return true
  if (/^color:/i.test(value)) return false
  if (/^var\(--/i.test(value)) return false
  if (/^-?(?:\d*\.)?\d+(?:px|rem|em|ch|ex|vw|vh|vmin|vmax|cqw|cqh|cqi|cqb|cqmin|cqmax|pt|pc|in|cm|mm|%)$/i.test(value)) {
    return true
  }
  if (/^(?:calc|min|max|clamp)\(/i.test(value) && /(?:px|rem|em|vw|vh|%|cqw|cqh)/i.test(value)) {
    return true
  }
  if (/^(?:#|rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color\(|currentColor|transparent)/i.test(value)) {
    return false
  }

  return false
}

function isArbitraryTextColor(utility) {
  if (!utility.startsWith('text-[')) return false
  if (isArbitraryTextSize(utility)) return false

  const value = arbitraryTextValue(utility)
  if (!value) return false
  if (/^color:/i.test(value)) return true
  if (/^(?:length|size):/i.test(value)) return false
  if (/^var\(--/i.test(value)) return false
  if (/^(?:#|rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color\(|currentColor|transparent)/i.test(value)) {
    return true
  }

  return false
}

function isTextMetadataClass(utility) {
  if (!utility.startsWith('text-') || utility.startsWith('text-[') || utility.startsWith('text-(')) {
    return false
  }
  const { base } = splitLineHeightModifier(utility)
  const suffix = base.slice(5)
  return suffix.includes('--')
}

function isStandardTextSize(utility) {
  const { base, modifier } = splitLineHeightModifier(utility)
  return STANDARD_TEXT_SIZE_RE.test(base) && hasValidLineHeightModifier(modifier)
}

function isConfiguredTextSize(utility, fontSizes) {
  if (!fontSizes.size) return false

  const { base, modifier } = splitLineHeightModifier(utility)
  if (!hasValidLineHeightModifier(modifier)) return false

  if (fontSizes.has(base)) return true

  if (base.startsWith('text-')) {
    const suffix = base.slice(5)
    return fontSizes.has(suffix)
  }

  return false
}

function isTypedTextSize(utility) {
  const { base, modifier } = splitLineHeightModifier(utility)
  return TYPED_TEXT_SIZE_RE.test(base) && hasValidLineHeightModifier(modifier)
}

function isTypedTextColor(utility) {
  return TYPED_TEXT_COLOR_RE.test(utility)
}

function classifyTextUtility(utility, options = {}) {
  if (isTextMetadataClass(utility)) {
    return null
  }

  const { fontSizes, colors } = createThemeSets(options)

  if (isStandardTextSize(utility) || isConfiguredTextSize(utility, fontSizes)) {
    return 'size'
  }

  if (isTypedTextSize(utility) || isArbitraryTextSize(utility)) {
    return 'size'
  }

  if (isTypedTextColor(utility) || isArbitraryTextColor(utility)) {
    return 'color'
  }

  if (!utility.startsWith('text-')) {
    return null
  }

  if (utility.startsWith('text-[') || utility.startsWith('text-(')) {
    return null
  }

  const suffix = utility.slice(5)
  if (isRecognizedColorSuffix(suffix, colors)) {
    return 'color'
  }

  return null
}

module.exports = {
  arbitraryTextValue,
  classifyTextUtility,
  createThemeSets,
  isArbitraryTextColor,
  isArbitraryTextSize,
  isConfiguredTextSize,
  isStandardTextSize,
  isTextMetadataClass,
  isTypedTextColor,
  isTypedTextSize,
  STANDARD_TEXT_SIZE_RE
}
