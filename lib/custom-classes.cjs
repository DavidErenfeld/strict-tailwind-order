const { areVariantsKnown, splitVariants } = require('./variants.cjs')

function normalizeCustomClassCollection(value) {
  if (value instanceof Set) return value
  return new Set(Array.isArray(value) ? value : [])
}

function patternToRegExp(pattern) {
  const escaped = String(pattern)
    .split('*')
    .map((part) => part.replace(/[|\\{}()[\]^$+?.]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${escaped}$`)
}

function findMatchingPattern(value, patterns = []) {
  for (const pattern of patterns) {
    if (patternToRegExp(pattern).test(value)) return pattern
  }
  return null
}

function getCustomClassInfo(token, options = {}) {
  const classes = normalizeCustomClassCollection(options.customClasses)
  if (classes.has(token)) {
    return {
      family: `custom-class:${token}`,
      source: 'selector'
    }
  }

  const parsed = splitVariants(token)
  if (!areVariantsKnown(parsed.variants, options)) return null

  const utilities = normalizeCustomClassCollection(options.customUtilities)
  if (utilities.has(parsed.utility)) {
    return {
      family: `custom-utility:${parsed.utility}`,
      source: 'utility'
    }
  }

  const pattern = findMatchingPattern(parsed.utility, options.customUtilityPatterns)
  if (pattern) {
    return {
      family: `custom-utility:${pattern}`,
      source: 'utility-pattern'
    }
  }

  return null
}

function isCustomClassToken(token, options = {}) {
  return getCustomClassInfo(token, options) !== null
}

module.exports = {
  findMatchingPattern,
  getCustomClassInfo,
  isCustomClassToken,
  normalizeCustomClassCollection,
  patternToRegExp
}
