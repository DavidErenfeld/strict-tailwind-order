const { arbitraryProperty, classifyUtility } = require('./classify.cjs')
const { getCustomClassInfo } = require('./custom-classes.cjs')
const { areVariantsKnown, compareVariantKeys, getVariantKey, splitVariants } = require('./variants.cjs')

function tokenize(source) {
  const matches = [...source.matchAll(/\S+/g)]
  if (matches.length === 0) return { tokens: [], separators: [source] }

  const tokens = matches.map((match) => match[0])
  const separators = []
  let cursor = 0

  for (const match of matches) {
    separators.push(source.slice(cursor, match.index))
    cursor = match.index + match[0].length
  }

  separators.push(source.slice(cursor))
  return { tokens, separators }
}

function joinTokens(tokens, separators) {
  let result = separators[0] || ''
  for (let i = 0; i < tokens.length; i += 1) {
    result += tokens[i]
    result += separators[i + 1] || ''
  }
  return result
}

function createTokenInfo(token, originalIndex, options) {
  const custom = getCustomClassInfo(token, options)
  if (custom) {
    return {
      token,
      originalIndex,
      known: true,
      kind: 'custom',
      category: Number.NEGATIVE_INFINITY,
      family: custom.family,
      subgroup: 0,
      utilityRank: 0,
      variantKey: []
    }
  }

  const parsed = splitVariants(token)
  if (!areVariantsKnown(parsed.variants, options)) return null

  const classification = classifyUtility(parsed.utility, options)
  if (!classification) return null

  return {
    token,
    originalIndex,
    known: true,
    kind: 'tailwind',
    category: classification.category,
    family:
      classification.family === 'arbitrary-property'
        ? `arbitrary-property:${arbitraryProperty(parsed.utility)}`
        : classification.family,
    subgroup: classification.subgroup,
    utilityRank: classification.utilityRank,
    variantKey: getVariantKey(parsed.variants, options)
  }
}

function compareTokenInfo(a, b) {
  if (a.kind === 'custom' || b.kind === 'custom') {
    if (a.kind !== b.kind) return a.kind === 'custom' ? -1 : 1
    return a.originalIndex - b.originalIndex
  }

  if (a.category !== b.category) return a.category - b.category
  if (a.subgroup !== b.subgroup) return a.subgroup - b.subgroup

  const variantComparison = compareVariantKeys(a.variantKey, b.variantKey)
  if (variantComparison !== 0) return variantComparison

  if (a.utilityRank !== b.utilityRank) return a.utilityRank - b.utilityRank
  return a.originalIndex - b.originalIndex
}

function sortTokenItems(tokens, options = {}) {
  const custom = []
  const recognized = []
  const unknown = []

  tokens.forEach((token, index) => {
    const info = createTokenInfo(token, index, options)
    if (info?.kind === 'custom') {
      custom.push(info)
    } else if (info) {
      recognized.push(info)
    } else {
      unknown.push({
        token,
        originalIndex: index,
        known: false,
        category: Number.POSITIVE_INFINITY,
        subgroup: Number.POSITIVE_INFINITY,
        family: `unknown-${index}`
      })
    }
  })

  custom.sort(compareTokenInfo)
  recognized.sort(compareTokenInfo)
  unknown.sort((a, b) => a.originalIndex - b.originalIndex)

  return [...custom, ...recognized, ...unknown]
}

function sortTokens(tokens, options = {}) {
  return sortTokenItems(tokens, options).map((item) => item.token)
}

function getFamilyKey(item) {
  if (!item.known) return item.family
  return `${item.category}:${item.subgroup}:${item.family}`
}

function groupTokenItemsByFamily(items) {
  const groups = []

  for (const item of items) {
    const key = getFamilyKey(item)
    const current = groups.at(-1)
    if (current?.key === key) {
      current.tokens.push(item.token)
    } else {
      groups.push({ key, tokens: [item.token] })
    }
  }

  return groups
}

function wrapFamilyGroups(items, maxLineLength) {
  const groups = groupTokenItemsByFamily(items)
  const lines = []
  let current = ''

  for (const group of groups) {
    const family = group.tokens.join(' ')
    const candidate = current ? `${current} ${family}` : family

    if (current && candidate.length > maxLineLength) {
      lines.push(current)
      current = family
    } else {
      current = candidate
    }
  }

  if (current) lines.push(current)
  return lines
}

function shouldWrap(source, maxLineLength) {
  if (!maxLineLength || maxLineLength < 1) return false
  const lines = source.split(/\r?\n/)
  if (lines.some((line) => line.trim().length > maxLineLength)) return true
  return !source.includes('\n') && source.trim().length > maxLineLength
}

function formatWrappedItems(items, formatting) {
  const maxLineLength = formatting.maxLineLength
  const lines = wrapFamilyGroups(items, maxLineLength)
  if (lines.length < 2) return items.map((item) => item.token).join(' ')

  const contentIndent = formatting.contentIndent || '  '
  const closingIndent = formatting.closingIndent || ''
  return `\n${contentIndent}${lines.join(`\n${contentIndent}`)}\n${closingIndent}`
}

function sortClassSource(source, options = {}, formatting = {}) {
  const { tokens, separators } = tokenize(source)
  if (tokens.length < 2) return source

  const sortedItems = sortTokenItems(tokens, options)
  const sortedTokens = sortedItems.map((item) => item.token)
  const orderChanged = sortedTokens.some((token, index) => token !== tokens[index])

  const maxLineLength = formatting.maxLineLength ?? options.maxClassLineLength
  const wrappingAllowed = formatting.allowWrapping === true
  const sortedSingleLine = sortedTokens.join(' ')
  const wrappingNeeded = wrappingAllowed && shouldWrap(sortedSingleLine, maxLineLength)

  if (wrappingNeeded) {
    const wrapped = formatWrappedItems(sortedItems, {
      ...formatting,
      maxLineLength
    })
    if (wrapped !== source) return wrapped
  }

  if (!orderChanged) return source
  return joinTokens(sortedTokens, separators)
}

module.exports = {
  createTokenInfo,
  formatWrappedItems,
  groupTokenItemsByFamily,
  sortClassSource,
  sortTokenItems,
  sortTokens,
  tokenize,
  wrapFamilyGroups
}
