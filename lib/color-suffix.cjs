const TAILWIND_PALETTE =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'

const SPECIAL_COLOR_NAMES = /^(?:inherit|current|transparent|black|white)$/

const PALETTE_COLOR_SUFFIX_RE = new RegExp(
  `^(?:${TAILWIND_PALETTE})-(?:50|100|200|300|400|500|600|700|800|900|950)$`
)

function splitTopLevelSlash(value) {
  let squareDepth = 0
  let roundDepth = 0
  let quote = null

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]

    if (quote) {
      if (char === '\\') {
        index += 1
        continue
      }
      if (char === quote) quote = null
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (char === '[') squareDepth += 1
    else if (char === ']') squareDepth = Math.max(0, squareDepth - 1)
    else if (char === '(') roundDepth += 1
    else if (char === ')') roundDepth = Math.max(0, roundDepth - 1)
    else if (char === '/' && squareDepth === 0 && roundDepth === 0) {
      return {
        color: value.slice(0, index),
        opacity: value.slice(index + 1)
      }
    }
  }

  return { color: value, opacity: null }
}

function isValidOpacityModifier(value) {
  if (value === null) return true
  if (!value) return false
  if (/^\d+(?:\.\d+)?$/.test(value)) return true
  if (/^\[[^\]]+\]$/.test(value)) return true
  if (/^\([^\)]+\)$/.test(value)) return true
  return false
}

function isArbitraryColor(value) {
  return /^\[[^\]]+\]$/.test(value) || /^\([^\)]+\)$/.test(value)
}

function isInvalidSpecialColorShade(suffix) {
  const { color } = splitTopLevelSlash(suffix)
  return /^(?:inherit|current|transparent|black|white)-/.test(color)
}

function isRecognizedColorSuffix(suffix, configuredColors = new Set()) {
  if (!suffix) return false

  const { color, opacity } = splitTopLevelSlash(suffix)
  if (!color || !isValidOpacityModifier(opacity) || isInvalidSpecialColorShade(color)) {
    return false
  }

  if (configuredColors.has(color)) return true
  if (SPECIAL_COLOR_NAMES.test(color)) return true
  if (PALETTE_COLOR_SUFFIX_RE.test(color)) return true
  if (isArbitraryColor(color)) return true
  return false
}

function hasInvalidColorSuffix(utility, prefix) {
  if (!utility.startsWith(prefix)) return false
  const suffix = utility.slice(prefix.length)
  if (!suffix || suffix.startsWith('[') || suffix.startsWith('(')) return false
  return isInvalidSpecialColorShade(suffix)
}

module.exports = {
  hasInvalidColorSuffix,
  isArbitraryColor,
  isInvalidSpecialColorShade,
  isRecognizedColorSuffix,
  isValidOpacityModifier,
  PALETTE_COLOR_SUFFIX_RE,
  SPECIAL_COLOR_NAMES,
  splitTopLevelSlash
}
