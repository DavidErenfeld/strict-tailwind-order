const { isRecognizedColorSuffix } = require('./color-suffix.cjs')
const { classifyTextUtility, isArbitraryTextSize } = require('./text-utility.cjs')

const STATE_MARKER_ORDER = ['group', 'peer']
const VISIBILITY_ORDER = [
  'sr-only',
  'not-sr-only',
  'hidden',
  'block',
  'inline-block',
  'inline',
  'contents',
  'visible',
  'invisible',
  'collapse'
]
const POSITION_ORDER = ['static', 'relative', 'absolute', 'fixed', 'sticky']
const DISPLAY_ORDER = ['grid', 'flex', 'inline-flex']
const FLEX_DIRECTION_ORDER = ['flex-row', 'flex-col', 'flex-row-reverse', 'flex-col-reverse']
const FLEX_WRAP_ORDER = ['flex-wrap', 'flex-wrap-reverse', 'flex-nowrap']
const FLEX_SIZE_ORDER = ['flex-1', 'flex-auto', 'flex-initial', 'flex-none']
const TEXT_ALIGN_ORDER = ['text-left', 'text-start', 'text-center', 'text-right', 'text-end', 'text-justify']
const TEXT_MISC_ORDER = [
  'uppercase',
  'lowercase',
  'capitalize',
  'normal-case',
  'italic',
  'not-italic',
  'underline',
  'overline',
  'line-through',
  'no-underline',
  'truncate',
  'text-ellipsis',
  'text-clip',
  'text-balance',
  'text-pretty',
  'text-wrap',
  'text-nowrap'
]


function configuredColors(options = {}) {
  return new Set((options.theme?.colors || []).map((value) => String(value).trim()).filter(Boolean))
}

function isArbitrarySuffix(value) {
  return /^\[[\s\S]+\]$/.test(value) || /^\([\s\S]+\)$/.test(value)
}

function isNumericOrArbitrary(value, allowed = ['0', '1', '2', '4', '8']) {
  return allowed.includes(value) || isArbitrarySuffix(value)
}

function isBackgroundUtility(utility, colors) {
  if (!utility.startsWith('bg-')) return false
  const suffix = utility.slice(3)
  if (isRecognizedColorSuffix(suffix, colors) || isArbitrarySuffix(suffix)) return true

  return /^(?:none|auto|cover|contain|fixed|local|scroll|bottom|center|left|left-bottom|left-top|right|right-bottom|right-top|top|repeat|no-repeat|repeat-x|repeat-y|repeat-round|repeat-space|clip-border|clip-padding|clip-content|clip-text|origin-border|origin-padding|origin-content|blend-(?:normal|multiply|screen|overlay|darken|lighten|color-dodge|color-burn|hard-light|soft-light|difference|exclusion|hue|saturation|color|luminosity)|gradient-to-(?:t|tr|r|br|b|bl|l|tl)|linear(?:-to-(?:t|tr|r|br|b|bl|l|tl))?|radial|conic)$/.test(suffix)
}

function isGradientStopUtility(utility, prefix, colors) {
  if (!utility.startsWith(prefix)) return false
  const suffix = utility.slice(prefix.length)
  if (isRecognizedColorSuffix(suffix, colors) || isArbitrarySuffix(suffix)) return true
  return /^-?\d+(?:\.\d+)?%$/.test(suffix)
}

function isBorderUtility(utility, colors) {
  if (utility === 'border' || utility === 'border-collapse' || utility === 'border-separate') return true
  if (!utility.startsWith('border-')) return false

  const suffix = utility.slice(7)
  if (/^(?:solid|dashed|dotted|double|hidden|none)$/.test(suffix)) return true
  if (/^(?:spacing|opacity)-/.test(suffix)) return true
  if (isRecognizedColorSuffix(suffix, colors) || isNumericOrArbitrary(suffix)) return true

  const directional = suffix.match(/^(x|y|s|e|t|r|b|l)(?:-(.+))?$/)
  if (!directional) return false
  const value = directional[2]
  if (!value) return true
  return isNumericOrArbitrary(value) || isRecognizedColorSuffix(value, colors)
}

function isRoundedUtility(utility) {
  if (utility === 'rounded') return true
  if (!utility.startsWith('rounded-')) return false

  const suffix = utility.slice(8)
  const size = '(?:none|xs|sm|md|lg|xl|2xl|3xl|4xl|full|\\[[^\\]]+\\]|\\([^\\)]+\\))'
  if (new RegExp(`^${size}$`).test(suffix)) return true
  return new RegExp(`^(?:s|e|t|r|b|l|ss|se|ee|es|tl|tr|br|bl)(?:-${size})?$`).test(suffix)
}

function isOutlineUtility(utility, colors) {
  if (utility === 'outline') return true
  if (!utility.startsWith('outline-')) return false
  const suffix = utility.slice(8)
  if (/^(?:none|hidden|solid|dashed|dotted|double)$/.test(suffix)) return true
  if (suffix.startsWith('offset-')) return isNumericOrArbitrary(suffix.slice(7), ['0', '1', '2', '4', '8'])
  return isNumericOrArbitrary(suffix, ['0', '1', '2', '4', '8']) || isRecognizedColorSuffix(suffix, colors)
}

function isRingOffsetUtility(utility, colors) {
  if (!utility.startsWith('ring-offset-')) return false
  const suffix = utility.slice(12)
  return isNumericOrArbitrary(suffix, ['0', '1', '2', '4', '8']) || isRecognizedColorSuffix(suffix, colors)
}

function isRingUtility(utility, colors) {
  if (utility === 'ring' || utility === 'ring-inset') return true
  if (!utility.startsWith('ring-') || utility.startsWith('ring-offset-')) return false
  const suffix = utility.slice(5)
  return isNumericOrArbitrary(suffix, ['0', '1', '2', '4', '8']) || isRecognizedColorSuffix(suffix, colors)
}

function isDecorationUtility(utility, colors) {
  if (!utility.startsWith('decoration-')) return false
  const suffix = utility.slice(11)
  if (/^(?:solid|double|dotted|dashed|wavy|auto|from-font)$/.test(suffix)) return true
  if (isNumericOrArbitrary(suffix, ['0', '1', '2', '4', '8'])) return true
  return isRecognizedColorSuffix(suffix, colors)
}

function isShadowUtility(utility, colors) {
  if (utility === 'shadow') return true
  if (!utility.startsWith('shadow-')) return false
  const suffix = utility.slice(7)
  if (/^(?:2xs|xs|sm|md|lg|xl|2xl|none|inner)$/.test(suffix)) return true
  if (isArbitrarySuffix(suffix)) return true
  return isRecognizedColorSuffix(suffix, colors)
}

function isDropShadowUtility(utility) {
  if (utility === 'drop-shadow') return true
  if (!utility.startsWith('drop-shadow-')) return false
  const suffix = utility.slice(12)
  return /^(?:2xs|xs|sm|md|lg|xl|2xl|none)$/.test(suffix) || isArbitrarySuffix(suffix)
}

function stripModifiers(utility) {
  let value = utility
  if (value.startsWith('!')) value = value.slice(1)
  if (value.endsWith('!')) value = value.slice(0, -1)
  if (value.startsWith('-')) value = value.slice(1)
  return value
}

function arbitraryTextValue(utility) {
  const start = utility.indexOf('[')
  const end = utility.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return null
  return utility.slice(start + 1, end).trim()
}

function arbitraryProperty(utility) {
  if (!utility.startsWith('[') || !utility.endsWith(']')) return null
  const content = utility.slice(1, -1)
  const separator = content.indexOf(':')
  if (separator <= 0) return null
  return content.slice(0, separator).trim().toLowerCase()
}

function isArbitraryTextSizeFromClassify(utility) {
  return isArbitraryTextSize(utility)
}

function matchPrefix(value, prefixes) {
  return [...prefixes]
    .sort((a, b) => b.length - a.length)
    .find((prefix) => value === prefix || value.startsWith(`${prefix}-`)) || null
}

function orderedValue(value, order) {
  const index = order.indexOf(value)
  return index === -1 ? order.length : index
}

function result(category, family, subgroup, utilityRank = 0) {
  return { category, family, subgroup, utilityRank }
}

function classifyUtility(rawUtility, options = {}) {
  const negative = rawUtility.startsWith('-') || rawUtility.startsWith('!-')
  const utility = stripModifiers(rawUtility)
  const property = arbitraryProperty(utility)
  const colors = configuredColors(options)

  const marker = STATE_MARKER_ORDER.find((value) => utility === value || utility.startsWith(`${value}/`))
  if (marker) return result(0, marker, STATE_MARKER_ORDER.indexOf(marker))

  if (VISIBILITY_ORDER.includes(utility)) {
    return result(1, 'visibility', 0, orderedValue(utility, VISIBILITY_ORDER))
  }

  if (utility.startsWith('z-')) return result(2, 'z-index', 0, negative ? 1 : 0)

  if (POSITION_ORDER.includes(utility)) {
    return result(3, 'position', 0, orderedValue(utility, POSITION_ORDER))
  }

  const insetOrder = ['inset', 'inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end']
  const inset = matchPrefix(utility, insetOrder)
  if (inset) return result(4, inset, insetOrder.indexOf(inset))

  if (utility.startsWith('size-')) return result(5, 'size', 0)
  if (utility.startsWith('h-')) return result(5, 'h', 1)
  if (utility.startsWith('min-h-')) return result(5, 'min-h', 2)
  if (utility.startsWith('max-h-')) return result(5, 'max-h', 3)

  if (utility.startsWith('w-')) return result(6, 'w', 0)
  if (utility.startsWith('min-w-')) return result(6, 'min-w', 1)
  if (utility.startsWith('max-w-')) return result(6, 'max-w', 2)
  if (utility.startsWith('aspect-')) return result(6, 'aspect', 3)

  if (DISPLAY_ORDER.includes(utility)) {
    return result(7, 'display', 0, orderedValue(utility, DISPLAY_ORDER))
  }

  if (utility.startsWith('grid-cols-')) return result(8, 'grid-cols', 0)
  if (utility.startsWith('grid-rows-')) return result(8, 'grid-rows', 1)
  if (utility.startsWith('col-span-')) return result(8, 'col-span', 2)
  if (utility.startsWith('col-start-')) return result(8, 'col-start', 3)
  if (utility.startsWith('col-end-')) return result(8, 'col-end', 4)
  if (utility.startsWith('row-span-')) return result(8, 'row-span', 5)
  if (utility.startsWith('row-start-')) return result(8, 'row-start', 6)
  if (utility.startsWith('row-end-')) return result(8, 'row-end', 7)

  if (FLEX_DIRECTION_ORDER.includes(utility)) {
    return result(9, 'flex-direction', 0, orderedValue(utility, FLEX_DIRECTION_ORDER))
  }

  if (FLEX_WRAP_ORDER.includes(utility)) {
    return result(9, 'flex-wrap', 1, orderedValue(utility, FLEX_WRAP_ORDER))
  }

  if (FLEX_SIZE_ORDER.includes(utility)) {
    return result(9, 'flex-size', 2, orderedValue(utility, FLEX_SIZE_ORDER))
  }

  if (utility === 'grow' || utility.startsWith('grow-')) return result(9, 'grow', 3)
  if (utility === 'shrink' || utility.startsWith('shrink-')) return result(9, 'shrink', 4)
  if (utility === 'basis' || utility.startsWith('basis-')) return result(9, 'basis', 5)
  if (utility === 'order' || utility.startsWith('order-')) return result(9, 'order', 6)

  const alignmentOrder = ['items', 'justify', 'content', 'place-items', 'self']
  const alignment = matchPrefix(utility, alignmentOrder)
  if (alignment) return result(10, alignment, alignmentOrder.indexOf(alignment))

  if (utility === 'gap' || utility.startsWith('gap-')) {
    if (utility.startsWith('gap-x-')) return result(11, 'gap-x', 1)
    if (utility.startsWith('gap-y-')) return result(11, 'gap-y', 2)
    return result(11, 'gap', 0)
  }
  if (utility.startsWith('space-x-')) return result(11, 'space-x', 3)
  if (utility.startsWith('space-y-')) return result(11, 'space-y', 4)

  if (isArbitraryTextSizeFromClassify(utility)) {
    return result(12, 'text-size', 0)
  }

  const textKind = classifyTextUtility(utility, options)
  if (textKind === 'size') {
    return result(12, 'text-size', 0)
  }

  if (TEXT_ALIGN_ORDER.includes(utility)) {
    return result(12, 'text-align', 1, orderedValue(utility, TEXT_ALIGN_ORDER))
  }

  if (utility.startsWith('tracking-')) return result(12, 'tracking', 2)
  if (utility.startsWith('font-')) return result(12, 'font', 3)
  if (utility.startsWith('leading-')) return result(12, 'leading', 4)

  if (TEXT_MISC_ORDER.includes(utility)) {
    return result(12, 'text-misc', 5, orderedValue(utility, TEXT_MISC_ORDER))
  }
  if (utility.startsWith('line-clamp-')) return result(12, 'line-clamp', 5)
  if (isDecorationUtility(utility, colors)) return result(12, 'decoration', 6)
  if (utility.startsWith('underline-offset-')) return result(12, 'underline-offset', 7)
  if (utility.startsWith('align-')) return result(12, 'vertical-align', 8)
  if (utility.startsWith('list-')) return result(12, 'list-style', 9)

  if (textKind === 'color') return result(13, 'text-color', 0)

  if (isBackgroundUtility(utility, colors)) return result(14, 'background', 0)
  if (isGradientStopUtility(utility, 'from-', colors)) return result(14, 'gradient-from', 1)
  if (isGradientStopUtility(utility, 'via-', colors)) return result(14, 'gradient-via', 2)
  if (isGradientStopUtility(utility, 'to-', colors)) return result(14, 'gradient-to', 3)
  if (property && (property === 'background' || property.startsWith('background-'))) {
    return result(14, 'background-property', 4)
  }

  if (isBorderUtility(utility, colors)) return result(15, 'border', 0)
  if (isRoundedUtility(utility)) return result(16, 'radius', 0)

  if (isOutlineUtility(utility, colors)) return result(17, 'outline', 0)
  if (isRingUtility(utility, colors)) return result(17, 'ring', 1)
  if (isRingOffsetUtility(utility, colors)) return result(17, 'ring-offset', 2)

  if (utility === 'isolate' || utility === 'isolation-auto') return result(18, 'isolation', 0)
  if (property && (property === 'mask' || property.startsWith('mask-'))) return result(18, 'mask-property', 1)
  if (utility.startsWith('mask-')) return result(18, 'mask', 1)
  if (utility.startsWith('opacity-')) return result(18, 'opacity', 2)
  if (isShadowUtility(utility, colors)) return result(18, 'shadow', 3)
  if (isDropShadowUtility(utility)) return result(18, 'drop-shadow', 4)
  if (utility === 'blur' || utility.startsWith('blur-')) return result(18, 'blur', 5)
  if (utility === 'backdrop-blur' || utility.startsWith('backdrop-blur-')) return result(18, 'backdrop-blur', 6)
  if (utility === 'brightness' || utility.startsWith('brightness-')) return result(18, 'brightness', 7)

  if (utility === 'transition' || utility.startsWith('transition-')) return result(19, 'transition', 0)
  if (utility.startsWith('duration-')) return result(19, 'duration', 1)
  if (utility.startsWith('delay-')) return result(19, 'delay', 2)
  if (utility.startsWith('ease-')) return result(19, 'ease', 3)
  if (utility.startsWith('origin-')) return result(19, 'transform-origin', 4)
  if (utility === 'transform' || utility.startsWith('transform-')) return result(19, 'transform', 5)
  if (utility === 'scale' || utility.startsWith('scale-')) return result(19, 'scale', 6)
  if (utility === 'rotate' || utility.startsWith('rotate-')) return result(19, 'rotate', 7)
  if (utility === 'translate' || utility.startsWith('translate-')) return result(19, 'translate', 8)
  if (utility === 'animate' || utility.startsWith('animate-')) return result(19, 'animate', 9)

  if (property?.startsWith('--')) return result(20, 'custom-property', 0)

  if (utility === 'appearance' || utility.startsWith('appearance-')) return result(21, 'appearance', 0)
  if (utility === 'overflow' || utility.startsWith('overflow-')) return result(21, 'overflow', 1)
  if (utility === 'overscroll' || utility.startsWith('overscroll-')) return result(21, 'overscroll', 2)
  if (utility === 'scroll' || utility.startsWith('scroll-')) return result(21, 'scroll', 3)
  if (utility === 'scrollbar' || utility.startsWith('scrollbar-')) return result(21, 'scrollbar', 4)
  if (property && ['scrollbar-width', 'scrollbar-color', '-ms-overflow-style'].includes(property)) {
    return result(21, 'scrollbar-property', 4)
  }
  if (utility === 'object' || utility.startsWith('object-')) return result(21, 'object', 5)
  if (utility === 'whitespace' || utility.startsWith('whitespace-')) return result(21, 'whitespace', 6)
  if (utility === 'select' || utility.startsWith('select-')) return result(21, 'select', 7)
  if (utility === 'pointer-events' || utility.startsWith('pointer-events-')) return result(21, 'pointer-events', 8)
  if (utility === 'touch' || utility.startsWith('touch-')) return result(21, 'touch-action', 9)
  if (utility === 'cursor' || utility.startsWith('cursor-')) return result(21, 'cursor', 10)
  if (utility === 'resize' || utility.startsWith('resize-')) return result(21, 'resize', 11)
  if (utility === 'snap' || utility.startsWith('snap-')) return result(21, 'snap', 12)
  if (utility === 'will-change' || utility.startsWith('will-change-')) {
    return result(21, 'will-change', 13)
  }
  if (property) return result(21, 'arbitrary-property', 14)

  const paddingOrder = ['p', 'pt', 'pe', 'pr', 'pb', 'ps', 'pl', 'px', 'py']
  const padding = matchPrefix(utility, paddingOrder)
  if (padding) return result(22, padding, paddingOrder.indexOf(padding))

  const marginOrder = ['m', 'mt', 'me', 'mr', 'mb', 'ms', 'ml', 'mx', 'my']
  const margin = matchPrefix(utility, marginOrder)
  if (margin) return result(23, margin, marginOrder.indexOf(margin))

  return null
}

module.exports = {
  arbitraryProperty,
  classifyUtility,
  isArbitraryTextSize: isArbitraryTextSizeFromClassify,
  stripModifiers
}
