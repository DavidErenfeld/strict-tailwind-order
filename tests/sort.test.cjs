const test = require('node:test')
const assert = require('node:assert/strict')
const { sortClassSource } = require('../lib/sort.cjs')

test('sorts the main categories', () => {
  const input = 'mt-8 bg-white md:w-1/2 flex h-full text-center md:mt-0 w-full items-center'
  const output = 'h-full w-full md:w-1/2 flex items-center text-center bg-white mt-8 md:mt-0'
  assert.equal(sortClassSource(input), output)
})

test('keeps responsive variants with the same concern', () => {
  const input = 'md:justify-between items-center justify-center md:items-start flex max-md:flex-col'
  const output = 'flex max-md:flex-col items-center md:items-start justify-center md:justify-between'
  assert.equal(sortClassSource(input), output)
})

test('sorts height before minimum and maximum height', () => {
  const input = 'max-h-none md:min-h-screen h-full min-h-0 md:h-auto'
  const output = 'h-full md:h-auto min-h-0 md:min-h-screen max-h-none'
  assert.equal(sortClassSource(input), output)
})

test('sorts typography before colors and backgrounds', () => {
  const input = 'bg-white text-[#1C1C1C] font-bold text-center md:text-[1.25rem]/[1.2] text-[1rem]/[1.1]'
  const output = 'text-[1rem]/[1.1] md:text-[1.25rem]/[1.2] text-center font-bold text-[#1C1C1C] bg-white'
  assert.equal(sortClassSource(input), output)
})

test('sorts font sizes with line-height modifiers in the typography size family', () => {
  const input = 'font-light mt-4 text-[#4A4A4A] text-xl/7'
  const output = 'text-xl/7 font-light text-[#4A4A4A] mt-4'
  assert.equal(sortClassSource(input), output)
})

test('keeps multiline whitespace layout', () => {
  const input = 'mt-8\n  flex\n  h-full'
  const output = 'h-full\n  flex\n  mt-8'
  assert.equal(sortClassSource(input), output)
})

test('moves unknown utilities to the end', () => {
  const input = 'mt-8 project-card bg-white flex'
  const output = 'flex bg-white mt-8 project-card'
  assert.equal(sortClassSource(input), output)
})

test('does not split arbitrary variants at nested colons', () => {
  const input = 'mt-4 supports-[display:grid]:grid h-4 [&:first-child]:hidden'
  const output = '[&:first-child]:hidden h-4 supports-[display:grid]:grid mt-4'
  assert.equal(sortClassSource(input), output)
})

test('preserves spacing family order while grouping responsive variants', () => {
  const input = 'mt-8 md:mx-0 py-6 md:mt-0 mx-auto md:py-12'
  const output = 'py-6 md:py-12 mt-8 md:mt-0 mx-auto md:mx-0'
  assert.equal(sortClassSource(input), output)
})


test('sorts drop shadow after background and whitespace before spacing', () => {
  const input = 'mx-auto whitespace-pre-line drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] bg-white text-[1.25rem]/[1.45]'
  const output = 'text-[1.25rem]/[1.45] bg-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] whitespace-pre-line mx-auto'
  assert.equal(sortClassSource(input), output)
})

test('sorts max breakpoints before min-width breakpoints inside each family', () => {
  const input = 'xl:bg-red-500 max-xl:bg-blue-500 md:bg-green-500 max-md:bg-yellow-500 bg-white sm:bg-black max-sm:bg-gray-500 lg:bg-pink-500 max-lg:bg-purple-500 2xl:bg-orange-500 max-2xl:bg-cyan-500'
  const output = 'bg-white max-sm:bg-gray-500 max-md:bg-yellow-500 max-lg:bg-purple-500 max-xl:bg-blue-500 max-2xl:bg-cyan-500 sm:bg-black md:bg-green-500 lg:bg-pink-500 xl:bg-red-500 2xl:bg-orange-500'
  assert.equal(sortClassSource(input), output)
})

test('sorts state markers and screen-reader visibility utilities', () => {
  const input = 'flex sr-only peer group hidden not-sr-only'
  const output = 'group peer sr-only not-sr-only hidden flex'
  assert.equal(sortClassSource(input), output)
})

test('sorts grid placement utilities with responsive variants', () => {
  const input = 'lg:col-span-2 col-span-full md:grid-cols-3 grid-cols-1 col-span-2 row-span-2 md:row-span-1'
  const output = 'grid-cols-1 md:grid-cols-3 col-span-full col-span-2 lg:col-span-2 row-span-2 md:row-span-1'
  assert.equal(sortClassSource(input), output)
})

test('sorts space utilities after gaps and by breakpoint', () => {
  const input = 'md:space-x-5 max-md:space-y-5 gap-4 space-x-2 max-md:space-y-2 space-x-3'
  const output = 'gap-4 space-x-2 space-x-3 md:space-x-5 max-md:space-y-5 max-md:space-y-2'
  assert.equal(sortClassSource(input), output)
})

test('sorts text decoration before text colors', () => {
  const input = 'text-blue-500 underline-offset-4 decoration-2 underline font-bold'
  const output = 'font-bold underline decoration-2 underline-offset-4 text-blue-500'
  assert.equal(sortClassSource(input), output)
})

test('sorts gradient stops after backgrounds with responsive variants', () => {
  const input = 'md:to-white from-white bg-gradient-to-b max-md:from-black/95 via-white to-transparent md:from-[#EAE5D980]'
  const output = 'bg-gradient-to-b from-white max-md:from-black/95 md:from-[#EAE5D980] via-white to-transparent md:to-white'
  assert.equal(sortClassSource(input), output)
})

test('sorts outline and ring before effects', () => {
  const input = 'shadow-lg focus:ring-0 ring-offset-2 focus:outline-none rounded-lg border bg-white'
  const output = 'bg-white border rounded-lg focus:outline-none focus:ring-0 ring-offset-2 shadow-lg'
  assert.equal(sortClassSource(input), output)
})

test('sorts blur and backdrop blur as effects', () => {
  const input = 'mt-4 lg:backdrop-blur-[9px] blur-sm opacity-80 bg-black'
  const output = 'bg-black opacity-80 blur-sm lg:backdrop-blur-[9px] mt-4'
  assert.equal(sortClassSource(input), output)
})

test('sorts custom properties and known arbitrary properties before spacing', () => {
  const input = 'mx-auto md:[scrollbar-width:thin] md:[--panel-width:clamp(24rem,31vw,39.5625rem)] max-md:[background:linear-gradient(180deg,#000_0%,#fff_100%)] lg:[-ms-overflow-style:none] bg-white'
  const output = 'bg-white max-md:[background:linear-gradient(180deg,#000_0%,#fff_100%)] md:[--panel-width:clamp(24rem,31vw,39.5625rem)] md:[scrollbar-width:thin] lg:[-ms-overflow-style:none] mx-auto'
  assert.equal(sortClassSource(input), output)
})

test('sorts appearance and miscellaneous utilities before spacing', () => {
  const input = 'px-4 cursor-pointer whitespace-pre-line object-cover select-none overflow-hidden appearance-none pointer-events-none'
  const output = 'appearance-none overflow-hidden object-cover whitespace-pre-line select-none pointer-events-none cursor-pointer px-4'
  assert.equal(sortClassSource(input), output)
})

test('sorts decimal font sizes with typography before text colors', () => {
  const input = 'text-blue-500 text-2.5xl font-bold text-center'
  const output = 'text-2.5xl text-center font-bold text-blue-500'
  assert.equal(sortClassSource(input), output)
})

test('keeps project-specific classes at the absolute end', () => {
  const input = 'arrow-w md:space-x-5 bg-white group mt-4'
  const output = 'group md:space-x-5 bg-white mt-4 arrow-w'
  assert.equal(sortClassSource(input), output)
})

test('places will-change and arbitrary CSS properties before spacing and unknown classes', () => {
  assert.equal(
    sortClassSource('custom-class mt-4 [-webkit-text-stroke:1px_#000] will-change-transform flex [will-change:transform]'),
    'flex will-change-transform [-webkit-text-stroke:1px_#000] [will-change:transform] mt-4 custom-class'
  )
})

test('moves utilities with unknown breakpoint variants to the absolute end', () => {
  const input = 'mt-4 sxl:flex bg-white flex md:flex-col'
  const output = 'flex md:flex-col bg-white mt-4 sxl:flex'
  assert.equal(sortClassSource(input), output)
})

test('keeps configured custom breakpoint variants recognized', () => {
  const input = 'mt-4 sxl:flex bg-white flex'
  const output = 'flex sxl:flex bg-white mt-4'
  assert.equal(sortClassSource(input, { breakpoints: ['sm', 'md', 'lg', 'xl', '2xl', 'sxl'] }), output)
})

test('does not wrap class content that is exactly 100 characters', () => {
  const input = 'w-full flex flex-col items-center lg:items-start text-center lg:text-start motion-reduce:opacity-100'
  assert.equal(input.length, 100)
  assert.equal(
    sortClassSource(
      input,
      { maxClassLineLength: 100 },
      { allowWrapping: true, maxLineLength: 100, contentIndent: '  ', closingIndent: '' }
    ),
    input
  )
})

test('wraps long class content between families without splitting a family', () => {
  const input = 'px-4 motion-reduce:opacity-100 lg:text-start text-center lg:items-start items-center flex-col flex w-full'
  const output = [
    '',
    '  w-full flex flex-col items-center lg:items-start text-center lg:text-start motion-reduce:opacity-100',
    '  px-4',
    ''
  ].join('\n')

  assert.equal(
    sortClassSource(
      input,
      { maxClassLineLength: 100 },
      { allowWrapping: true, maxLineLength: 100, contentIndent: '  ', closingIndent: '' }
    ),
    output
  )
  assert.match(output, /items-center lg:items-start/)
  assert.match(output, /text-center lg:text-start/)
})

test('allows one family to exceed the limit instead of splitting it', () => {
  const input = 'px-4 items-center sm:items-start md:items-end lg:items-baseline xl:items-stretch 2xl:items-center motion-reduce:items-start flex'
  const output = sortClassSource(
    input,
    { maxClassLineLength: 45 },
    { allowWrapping: true, maxLineLength: 45, contentIndent: '  ', closingIndent: '' }
  )

  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean)
  const itemsLine = lines.find((line) => line.startsWith('items-center'))
  assert.equal(
    itemsLine,
    'items-center sm:items-start md:items-end lg:items-baseline xl:items-stretch 2xl:items-center motion-reduce:items-start'
  )
  assert.ok(itemsLine.length > 45)
})

test('keeps official state and arbitrary variants recognized', () => {
  const input = 'sxl:flex group-hover:flex peer-data-[open=true]:block [&:nth-child(2)]:hidden before:content-none flex'
  const output = 'peer-data-[open=true]:block [&:nth-child(2)]:hidden flex group-hover:flex before:content-none sxl:flex'
  assert.equal(sortClassSource(input), output)
})

test('places detected custom CSS classes before Tailwind and unknown classes', () => {
  const input = 'mt-4 typo-class project-card bg-white flex ntlv-scrollbar-none'
  const output = 'project-card ntlv-scrollbar-none flex bg-white mt-4 typo-class'
  assert.equal(
    sortClassSource(input, {
      customClasses: new Set(['project-card', 'ntlv-scrollbar-none'])
    }),
    output
  )
})

test('preserves custom CSS class order at the beginning', () => {
  const input = 'flex second-hook mt-4 first-hook bg-white'
  const output = 'second-hook first-hook flex bg-white mt-4'
  assert.equal(
    sortClassSource(input, {
      customClasses: new Set(['first-hook', 'second-hook'])
    }),
    output
  )
})

test('recognizes variants for @utility classes but not ordinary selector classes', () => {
  const input = 'hover:project-card flex hover:content-auto tab-4 project-card'
  const output = 'hover:content-auto tab-4 project-card flex hover:project-card'
  assert.equal(
    sortClassSource(input, {
      customClasses: new Set(['project-card']),
      customUtilities: new Set(['content-auto']),
      customUtilityPatterns: ['tab-*']
    }),
    output
  )
})
