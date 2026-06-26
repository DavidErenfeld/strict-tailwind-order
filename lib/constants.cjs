const VUE_TRANSITION_ATTRIBUTES = [
  'enter-class',
  'enter-from-class',
  'enter-active-class',
  'enter-to-class',
  'leave-class',
  'leave-from-class',
  'leave-active-class',
  'leave-to-class',
  'appear-class',
  'appear-from-class',
  'appear-active-class',
  'appear-to-class',
  'move-class',
  'enterClass',
  'enterFromClass',
  'enterActiveClass',
  'enterToClass',
  'leaveClass',
  'leaveFromClass',
  'leaveActiveClass',
  'leaveToClass',
  'appearClass',
  'appearFromClass',
  'appearActiveClass',
  'appearToClass',
  'moveClass'
]

const DEFAULT_ATTRIBUTES = [
  'class',
  'className',
  'custom-class',
  'content-class',
  'overlay-class',
  'fallback-class',
  ...VUE_TRANSITION_ATTRIBUTES
]

const DEFAULT_FUNCTIONS = ['cn', 'clsx', 'classNames', 'twJoin', 'twMerge']

const DEFAULT_IGNORED_CLASSES = []

const DEFAULT_BREAKPOINT_METADATA = [
  { name: 'sm', value: 40, unit: 'rem' },
  { name: 'md', value: 48, unit: 'rem' },
  { name: 'lg', value: 64, unit: 'rem' },
  { name: 'xl', value: 80, unit: 'rem' },
  { name: '2xl', value: 96, unit: 'rem' }
]

const DEFAULT_BREAKPOINTS = DEFAULT_BREAKPOINT_METADATA.map((breakpoint) => breakpoint.name)

const DEFAULT_STATES = [
  'first',
  'last',
  'only',
  'odd',
  'even',
  'visited',
  'target',
  'open',
  'checked',
  'indeterminate',
  'placeholder-shown',
  'autofill',
  'optional',
  'required',
  'valid',
  'invalid',
  'in-range',
  'out-of-range',
  'read-only',
  'empty',
  'focus-within',
  'hover',
  'focus',
  'focus-visible',
  'active',
  'enabled',
  'disabled',
  'motion-safe',
  'motion-reduce',
  'contrast-more',
  'contrast-less',
  'dark',
  'print',
  'portrait',
  'landscape',
  'rtl',
  'ltr'
]

const THEME_OPTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fontSize: {
      type: 'array',
      items: { type: 'string' },
      uniqueItems: true
    },
    colors: {
      type: 'array',
      items: { type: 'string' },
      uniqueItems: true
    }
  }
}

module.exports = {
  DEFAULT_ATTRIBUTES,
  DEFAULT_BREAKPOINT_METADATA,
  DEFAULT_BREAKPOINTS,
  DEFAULT_FUNCTIONS,
  DEFAULT_IGNORED_CLASSES,
  DEFAULT_STATES,
  THEME_OPTION_SCHEMA,
  VUE_TRANSITION_ATTRIBUTES
}
