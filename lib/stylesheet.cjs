const fs = require('fs')
const path = require('path')

const stylesheetCache = new Map()

function normalizeCssIdentifier(value) {
  return String(value).replace(/\\(.)/g, '$1')
}

function stripCssComments(css) {
  let result = ''
  let index = 0

  while (index < css.length) {
    const char = css[index]

    if (char === '"' || char === "'") {
      const quote = char
      result += quote
      index += 1

      while (index < css.length) {
        const current = css[index]
        if (current === '\\') {
          result += css.slice(index, index + 2)
          index += 2
          continue
        }

        result += current
        index += 1
        if (current === quote) break
      }
      continue
    }

    if (char === '/' && css[index + 1] === '*') {
      index += 2
      while (index < css.length && !(css[index] === '*' && css[index + 1] === '/')) {
        index += 1
      }
      index = Math.min(css.length, index + 2)
      continue
    }

    result += char
    index += 1
  }

  return result
}

function skipQuoted(source, start) {
  const quote = source[start]
  let index = start + 1

  while (index < source.length) {
    if (source[index] === '\\') {
      index += 2
      continue
    }
    if (source[index] === quote) return index + 1
    index += 1
  }

  return source.length
}



function decodeCssEscape(source, start) {
  let cursor = start + 1
  if (cursor >= source.length) return { value: '', nextIndex: cursor }

  const hexMatch = source.slice(cursor).match(/^[0-9a-fA-F]{1,6}/)
  if (hexMatch) {
    cursor += hexMatch[0].length
    if (/\s/.test(source[cursor] || '')) cursor += 1
    const codePoint = Number.parseInt(hexMatch[0], 16)
    return {
      value: Number.isFinite(codePoint) && codePoint > 0 ? String.fromCodePoint(codePoint) : '',
      nextIndex: cursor
    }
  }

  return {
    value: source[cursor],
    nextIndex: cursor + 1
  }
}

function readCssIdentifier(source, start) {
  let cursor = start
  let value = ''

  while (cursor < source.length) {
    const char = source[cursor]
    if (char === '\\') {
      const decoded = decodeCssEscape(source, cursor)
      value += decoded.value
      cursor = decoded.nextIndex
      continue
    }

    if (!/[A-Za-z0-9_-]/.test(char)) break
    value += char
    cursor += 1
  }

  return { value, nextIndex: cursor }
}

function extractClassSelectors(selector) {
  const classes = []
  let index = 0

  while (index < selector.length) {
    const char = selector[index]
    if (char === '"' || char === "'") {
      index = skipQuoted(selector, index)
      continue
    }

    if (char !== '.') {
      index += 1
      continue
    }

    const identifier = readCssIdentifier(selector, index + 1)
    if (identifier.value) classes.push(identifier.value)
    index = Math.max(index + 1, identifier.nextIndex)
  }

  return classes
}

function extractCustomClassData(css) {
  const source = stripCssComments(css)
  const classes = new Set()
  const utilities = new Set()
  const utilityPatterns = new Set()
  let statementStart = 0
  let index = 0

  while (index < source.length) {
    const char = source[index]

    if (char === '"' || char === "'") {
      index = skipQuoted(source, index)
      continue
    }

    if (char === '{') {
      const prelude = source.slice(statementStart, index).trim()
      const utilityMatch = prelude.match(/^@utility\s+([^\s{]+)/)

      if (utilityMatch) {
        const name = normalizeCssIdentifier(utilityMatch[1].trim())
        if (name.includes('*')) utilityPatterns.add(name)
        else if (name) utilities.add(name)
      } else if (prelude && !prelude.startsWith('@')) {
        for (const className of extractClassSelectors(prelude)) classes.add(className)
      }

      statementStart = index + 1
      index += 1
      continue
    }

    if (char === ';' || char === '}') statementStart = index + 1
    index += 1
  }

  return {
    classes: [...classes],
    utilities: [...utilities],
    utilityPatterns: [...utilityPatterns]
  }
}

function extractCustomVariants(css) {
  const source = stripCssComments(css)
  const variants = []
  const seen = new Set()
  const pattern = /@custom-variant\s+([^\s({;]+)/gi
  let match

  while ((match = pattern.exec(source))) {
    const name = normalizeCssIdentifier(match[1].trim())
    if (!name || seen.has(name)) continue
    seen.add(name)
    variants.push(name)
  }

  return variants
}

function extractCssImports(css) {
  const source = stripCssComments(css)
  const imports = []
  const pattern = /@import\s+(?:url\(\s*)?(?:(['"])(.*?)\1|([^\s;)]+))\s*\)?[^;]*;/gi
  let match

  while ((match = pattern.exec(source))) {
    const specifier = (match[2] || match[3] || '').trim()
    if (specifier) imports.push(specifier)
  }

  return imports
}

function resolveLocalImport(specifier, importerPath) {
  if (!specifier || !specifier.startsWith('.')) return null

  const base = path.resolve(path.dirname(importerPath), specifier)
  const candidates = [base]
  if (!path.extname(base)) {
    candidates.push(`${base}.css`)
    candidates.push(path.join(base, 'index.css'))
  }

  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate
    } catch {
      // Ignore unresolved local imports. The configured entry file remains authoritative.
    }
  }

  return null
}

function normalizeImportDepth(value) {
  if (Number.isInteger(value) && value >= 0) return value
  return 10
}

function collectStylesheetFiles(rootPath, options = {}) {
  const followImports = options.followImports !== false
  const maxImportDepth = normalizeImportDepth(options.maxImportDepth)
  const visited = new Set()
  const files = []

  function visit(filePath, depth) {
    const resolved = path.resolve(filePath)
    if (visited.has(resolved)) return
    visited.add(resolved)

    const css = fs.readFileSync(resolved, 'utf8')
    const stat = fs.statSync(resolved)

    if (followImports && depth < maxImportDepth) {
      for (const specifier of extractCssImports(css)) {
        const imported = resolveLocalImport(specifier, resolved)
        if (imported) visit(imported, depth + 1)
      }
    }

    files.push({
      path: resolved,
      css,
      mtimeMs: stat.mtimeMs,
      size: stat.size
    })
  }

  visit(rootPath, 0)
  return files
}

function isCacheEntryValid(entry) {
  if (!entry?.dependencies?.length) return false

  for (const dependency of entry.dependencies) {
    try {
      const stat = fs.statSync(dependency.path)
      if (!stat.isFile() || stat.mtimeMs !== dependency.mtimeMs || stat.size !== dependency.size) {
        return false
      }
    } catch {
      return false
    }
  }

  return true
}

function isNameBoundary(char) {
  return !char || /[\s{;]/.test(char)
}

function extractThemeBlocks(css) {
  const source = stripCssComments(css)
  const blocks = []
  let index = 0

  while (index < source.length) {
    const char = source[index]

    if (char === '"' || char === "'") {
      index = skipQuoted(source, index)
      continue
    }

    if (!source.startsWith('@theme', index) || !isNameBoundary(source[index + 6])) {
      index += 1
      continue
    }

    let cursor = index + 6
    while (/\s/.test(source[cursor] || '')) cursor += 1

    for (const modifier of ['inline', 'static']) {
      if (source.startsWith(modifier, cursor) && isNameBoundary(source[cursor + modifier.length])) {
        cursor += modifier.length
        while (/\s/.test(source[cursor] || '')) cursor += 1
        break
      }
    }

    if (source[cursor] !== '{') {
      index += 6
      continue
    }

    const contentStart = cursor + 1
    let depth = 1
    cursor += 1

    while (cursor < source.length && depth > 0) {
      const current = source[cursor]
      if (current === '"' || current === "'") {
        cursor = skipQuoted(source, cursor)
        continue
      }
      if (current === '{') depth += 1
      else if (current === '}') depth -= 1
      cursor += 1
    }

    if (depth === 0) {
      blocks.push(source.slice(contentStart, cursor - 1))
      index = cursor
    } else {
      index = source.length
    }
  }

  return blocks
}

function readCustomProperty(block, start) {
  let cursor = start + 2

  while (cursor < block.length && !/[\s:]/.test(block[cursor])) {
    if (block[cursor] === '\\' && cursor + 1 < block.length) cursor += 2
    else cursor += 1
  }

  const rawName = block.slice(start + 2, cursor)
  while (/\s/.test(block[cursor] || '')) cursor += 1
  if (!rawName || block[cursor] !== ':') return null

  cursor += 1
  const valueStart = cursor
  let squareDepth = 0
  let roundDepth = 0
  let braceDepth = 0

  while (cursor < block.length) {
    const char = block[cursor]

    if (char === '"' || char === "'") {
      cursor = skipQuoted(block, cursor)
      continue
    }

    if (char === '[') squareDepth += 1
    else if (char === ']') squareDepth = Math.max(0, squareDepth - 1)
    else if (char === '(') roundDepth += 1
    else if (char === ')') roundDepth = Math.max(0, roundDepth - 1)
    else if (char === '{') braceDepth += 1
    else if (char === '}') braceDepth = Math.max(0, braceDepth - 1)
    else if (char === ';' && squareDepth === 0 && roundDepth === 0 && braceDepth === 0) {
      return {
        name: normalizeCssIdentifier(rawName),
        value: block.slice(valueStart, cursor).trim(),
        nextIndex: cursor + 1
      }
    }

    cursor += 1
  }

  return {
    name: normalizeCssIdentifier(rawName),
    value: block.slice(valueStart).trim(),
    nextIndex: block.length
  }
}

function parseThemeDeclarations(block) {
  const declarations = []
  let index = 0

  while (index < block.length) {
    const char = block[index]

    if (char === '"' || char === "'") {
      index = skipQuoted(block, index)
      continue
    }

    if (char === '-' && block[index + 1] === '-') {
      const declaration = readCustomProperty(block, index)
      if (declaration) {
        declarations.push(declaration)
        index = declaration.nextIndex
        continue
      }
    }

    index += 1
  }

  return declarations
}

function isTextSizeMetadata(name) {
  return name.startsWith('text-') && name.indexOf('--', 5) !== -1
}

function parseBreakpointValue(value) {
  const raw = String(value).trim()
  const match = raw.match(/^(-?(?:\d*\.)?\d+)(px|rem|em|%)?$/)
  if (!match) return { amount: null, unit: null, raw }

  return {
    amount: Number.parseFloat(match[1]),
    unit: match[2] || 'px',
    raw
  }
}

function parseThemeVariables(css) {
  const breakpoints = []
  const colors = []
  const fontSizes = []
  let declarationIndex = 0

  for (const block of extractThemeBlocks(css)) {
    for (const declaration of parseThemeDeclarations(block)) {
      const name = declaration.name
      const value = declaration.value
      const currentIndex = declarationIndex
      declarationIndex += 1

      if (name.startsWith('breakpoint-')) {
        breakpoints.push({
          name: name.slice('breakpoint-'.length),
          value,
          declarationIndex: currentIndex
        })
        continue
      }

      if (name.startsWith('color-')) {
        colors.push(name.slice('color-'.length))
        continue
      }

      if (name.startsWith('text-') && !isTextSizeMetadata(name)) {
        fontSizes.push(name.slice('text-'.length))
      }
    }
  }

  return { breakpoints, colors, fontSizes }
}

function buildCombinedBreakpointEntries(defaultMetadata, customBreakpoints) {
  const combined = new Map()

  for (const breakpoint of defaultMetadata) {
    combined.set(breakpoint.name, {
      name: breakpoint.name,
      amount: breakpoint.value,
      unit: breakpoint.unit,
      declarationIndex: Number.NEGATIVE_INFINITY,
      source: 'builtin'
    })
  }

  for (const breakpoint of customBreakpoints) {
    const name = normalizeCssIdentifier(breakpoint.name)
    const parsed = parseBreakpointValue(breakpoint.value)
    combined.set(name, {
      name,
      amount: parsed.amount,
      unit: parsed.unit,
      declarationIndex: breakpoint.declarationIndex,
      source: 'stylesheet'
    })
  }

  return [...combined.values()]
}

function sortCombinedBreakpoints(entries, customBreakpoints, defaultMetadata) {
  const units = new Set(entries.map((entry) => entry.unit).filter(Boolean))
  const allNumeric = entries.every((entry) => entry.amount !== null)

  if (units.size === 1 && allNumeric) {
    return [...entries]
      .sort(
        (left, right) =>
          left.amount - right.amount ||
          left.declarationIndex - right.declarationIndex ||
          left.name.localeCompare(right.name)
      )
      .map((entry) => entry.name)
  }

  const customNames = new Set(customBreakpoints.map((item) => normalizeCssIdentifier(item.name)))
  const builtinsNotOverridden = defaultMetadata
    .map((breakpoint) => breakpoint.name)
    .filter((name) => !customNames.has(name))
  const customOrder = entries
    .filter((entry) => customNames.has(entry.name))
    .sort(
      (left, right) =>
        left.declarationIndex - right.declarationIndex || left.name.localeCompare(right.name)
    )
    .map((entry) => entry.name)

  return [...builtinsNotOverridden, ...customOrder]
}

function mergeBreakpoints(defaultMetadata, customBreakpoints, explicitOrder = null) {
  if (explicitOrder?.length) return explicitOrder.map(normalizeCssIdentifier)
  const combined = buildCombinedBreakpointEntries(defaultMetadata, customBreakpoints)
  return sortCombinedBreakpoints(combined, customBreakpoints, defaultMetadata)
}

function resolveStylesheetPath(stylesheetPath, cwd = process.cwd()) {
  if (!stylesheetPath) return null
  return path.isAbsolute(stylesheetPath) ? stylesheetPath : path.resolve(cwd, stylesheetPath)
}

function loadStylesheetTheme(stylesheetPath, cwd = process.cwd(), options = {}) {
  const resolvedPath = resolveStylesheetPath(stylesheetPath, cwd)
  if (!resolvedPath) {
    return { ok: false, error: 'MISSING_PATH', path: stylesheetPath, requestedPath: stylesheetPath }
  }

  try {
    if (!fs.existsSync(resolvedPath)) {
      return {
        ok: false,
        error: 'NOT_FOUND',
        path: resolvedPath,
        requestedPath: stylesheetPath,
        message: `No such file or directory: ${resolvedPath}`
      }
    }

    const stat = fs.statSync(resolvedPath)
    if (!stat.isFile()) {
      return {
        ok: false,
        error: 'IS_DIRECTORY',
        path: resolvedPath,
        requestedPath: stylesheetPath,
        message: `The configured Tailwind stylesheet path points to a directory, not a file: ${resolvedPath}`
      }
    }

    const normalizedOptions = {
      detectCustomClasses: options.detectCustomClasses !== false,
      followImports: options.followImports !== false,
      maxImportDepth: normalizeImportDepth(options.maxImportDepth)
    }
    const cacheKey = `${resolvedPath}:${normalizedOptions.detectCustomClasses}:${normalizedOptions.followImports}:${normalizedOptions.maxImportDepth}`
    const cached = stylesheetCache.get(cacheKey)
    if (isCacheEntryValid(cached)) return cached.data

    const files = collectStylesheetFiles(resolvedPath, normalizedOptions)
    const combinedCss = files.map((file) => file.css).join('\n')
    const parsed = parseThemeVariables(combinedCss)
    const customClasses = new Set()
    const customUtilities = new Set()
    const customUtilityPatterns = new Set()
    const customVariants = new Set()

    for (const file of files) {
      for (const variant of extractCustomVariants(file.css)) customVariants.add(variant)

      if (normalizedOptions.detectCustomClasses) {
        const custom = extractCustomClassData(file.css)
        for (const className of custom.classes) customClasses.add(className)
        for (const utility of custom.utilities) customUtilities.add(utility)
        for (const pattern of custom.utilityPatterns) customUtilityPatterns.add(pattern)
      }
    }

    const data = {
      ok: true,
      path: resolvedPath,
      requestedPath: stylesheetPath,
      breakpoints: parsed.breakpoints,
      colors: parsed.colors,
      fontSizes: parsed.fontSizes,
      customVariants: [...customVariants],
      customClasses: [...customClasses],
      customUtilities: [...customUtilities],
      customUtilityPatterns: [...customUtilityPatterns],
      files: files.map((file) => file.path)
    }

    stylesheetCache.set(cacheKey, {
      dependencies: files.map(({ path: filePath, mtimeMs, size }) => ({
        path: filePath,
        mtimeMs,
        size
      })),
      data
    })
    return data
  } catch (error) {
    return {
      ok: false,
      error: 'READ_FAILED',
      path: resolvedPath,
      requestedPath: stylesheetPath,
      message: error instanceof Error ? error.message : String(error)
    }
  }
}

function clearStylesheetCache() {
  stylesheetCache.clear()
}

module.exports = {
  buildCombinedBreakpointEntries,
  clearStylesheetCache,
  collectStylesheetFiles,
  extractClassSelectors,
  extractCssImports,
  extractCustomClassData,
  extractCustomVariants,
  extractThemeBlocks,
  isTextSizeMetadata,
  loadStylesheetTheme,
  mergeBreakpoints,
  normalizeCssIdentifier,
  normalizeImportDepth,
  parseBreakpointValue,
  parseThemeDeclarations,
  parseThemeVariables,
  resolveLocalImport,
  resolveStylesheetPath,
  sortCombinedBreakpoints,
  stripCssComments
}
