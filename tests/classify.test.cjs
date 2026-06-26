const test = require('node:test')
const assert = require('node:assert/strict')
const { classifyUtility } = require('../lib/classify.cjs')
const { splitVariants } = require('../lib/variants.cjs')

const recognizedUtilities = [
  'appearance-none',
  'focus:outline-none',
  'focus:ring-0',
  'peer',
  'col-span-full',
  'from-white',
  'group',
  'space-x-2',
  'to-transparent',
  'col-span-2',
  'from-[#EAE5D980]',
  'from-black/95',
  'lg:backdrop-blur-[9px]',
  'lg:col-span-2',
  'max-md:space-y-2',
  'max-md:space-y-3',
  'max-md:space-y-5',
  'md:space-x-5',
  'space-x-3',
  'sr-only',
  'to-[#EAE5D980]',
  'to-white',
  'underline-offset-4',
  'via-white',
  'lg:[-ms-overflow-style:none]',
  'lg:[scrollbar-width:none]',
  'max-md:[background:linear-gradient(180deg,rgba(8,18,36,0.8)_0%,#081224_81.79%)]',
  'md:[--hero-text-width:min(49.375rem,calc(100vw-var(--panel-width)-8rem))]',
  'md:[--panel-width:clamp(24rem,31vw,39.5625rem)]',
  'md:[scrollbar-color:rgba(255,255,255,0.22)_transparent]',
  'md:[scrollbar-width:thin]'
]

test('recognizes every utility previously reported as an unknown Tailwind utility', () => {
  for (const className of recognizedUtilities) {
    const { utility } = splitVariants(className)
    assert.ok(classifyUtility(utility), `${className} should be recognized`)
  }
})

test('keeps project-specific utilities unknown', () => {
  assert.equal(classifyUtility('arrow-w'), null)
})

test('recognizes project isolation and mask utilities', () => {
  assert.ok(classifyUtility('isolate'))
  assert.ok(classifyUtility('isolation-auto'))
  assert.ok(classifyUtility('[mask-image:radial-gradient(circle,black,transparent)]'))
  assert.ok(classifyUtility('mask-none'))
})

test('recognizes utilities used by the target Vue project', () => {
  for (const utility of [
    'size-0',
    'size-full',
    'align-middle',
    'list-disc',
    'origin-center',
    'touch-pan-y',
    'brightness-75',
    'brightness-100',
    'text-2.5xl',
    'text-3.5xl',
    'line-clamp-3',
    'snap-x',
    'resize-y'
  ]) {
    assert.ok(classifyUtility(utility), utility)
  }
})

test('classifies decimal font sizes as typography size, not text color', () => {
  assert.equal(classifyUtility('text-2.5xl').family, 'text-size')
  assert.equal(classifyUtility('text-3.5xl').family, 'text-size')
})

test('supports custom theme font sizes and colors through options', () => {
  const options = {
    theme: {
      fontSize: ['hero', 'display'],
      colors: ['primary']
    }
  }
  assert.equal(classifyUtility('text-hero', options).family, 'text-size')
  assert.equal(classifyUtility('text-display', options).family, 'text-size')
  assert.equal(classifyUtility('text-primary', options).family, 'text-color')
  assert.equal(classifyUtility('text-primary'), null)
})

test('recognizes will-change utilities and arbitrary CSS properties', () => {
  for (const utility of [
    'will-change-auto',
    'will-change-scroll',
    'will-change-contents',
    'will-change-transform',
    'will-change-[opacity,transform]',
    '[will-change:transform]',
    '[-webkit-text-stroke:1px_#000]',
    '[content-visibility:auto]'
  ]) {
    assert.ok(classifyUtility(utility), utility)
  }
})
