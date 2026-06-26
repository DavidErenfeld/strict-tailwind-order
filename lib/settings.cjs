const fs = require('fs')
const path = require('path')
const {
  DEFAULT_ATTRIBUTES,
  DEFAULT_BREAKPOINTS,
  DEFAULT_BREAKPOINT_METADATA,
  DEFAULT_FUNCTIONS,
  DEFAULT_IGNORED_CLASSES,
  DEFAULT_STATES
} = require('./constants.cjs')
const { loadStylesheetTheme, mergeBreakpoints } = require('./stylesheet.cjs')

const STYLESHEET_EXTENSIONS = ['.css', '.pcss', '.postcss', '.scss', '.sass', '.less']
const STYLESHEET_NAMES = [
  'main.css',
  'app.css',
  'styles.css',
  'style.css',
  'globals.css',
  'global.css',
  'tailwind.css',
  'index.css'
]
const ENTRY_FILE_NAMES = ['main', 'index', 'app', 'client', 'entry-client', 'bootstrap']
const ENTRY_FILE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']
const STYLESHEET_DIRECTORY_NAMES = ['css', 'styles']

function getPluginSettings(context) {
  return context.settings?.strictTailwindOrder || {}
}

function getContextFilename(context) {
  return context.filename || context.getFilename?.() || ''
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/')
}

function isExistingFile(filePath) {
  try {
    return fs.statSync(filePath).isFile()
  } catch {
    return false
  }
}

function readFileSafely(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

function addCandidate(candidates, seen, candidate) {
  if (!candidate) return
  const resolved = path.resolve(candidate)
  if (seen.has(resolved)) return
  seen.add(resolved)
  candidates.push(resolved)
}

function addDirectoryStylesheetCandidates(candidates, seen, directory) {
  for (const name of STYLESHEET_NAMES) addCandidate(candidates, seen, path.join(directory, name))

  for (const stylesheetDirectory of STYLESHEET_DIRECTORY_NAMES) {
    for (const name of STYLESHEET_NAMES) {
      addCandidate(candidates, seen, path.join(directory, stylesheetDirectory, name))
    }
  }

  for (const name of STYLESHEET_NAMES) {
    addCandidate(candidates, seen, path.join(directory, 'src', name))
  }
}

function isPathInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function findNearestPackageRoot(filename = '', cwd = process.cwd()) {
  const normalizedCwd = path.resolve(cwd)
  const absoluteFilename =
    filename && filename !== '<input>' && filename !== '<text>'
      ? path.isAbsolute(filename)
        ? path.resolve(filename)
        : path.resolve(normalizedCwd, filename)
      : null

  let directory = absoluteFilename ? path.dirname(absoluteFilename) : normalizedCwd
  const filesystemRoot = path.parse(directory).root

  while (true) {
    if (isExistingFile(path.join(directory, 'package.json'))) return directory
    if (directory === filesystemRoot) break
    const parent = path.dirname(directory)
    if (parent === directory) break
    directory = parent
  }

  return normalizedCwd
}

function findNearestSourceRoot(filename = '', projectRoot = process.cwd()) {
  if (!filename || filename === '<input>' || filename === '<text>') return null
  const absoluteFilename = path.isAbsolute(filename) ? path.resolve(filename) : path.resolve(projectRoot, filename)
  const normalizedProjectRoot = path.resolve(projectRoot)
  let directory = path.dirname(absoluteFilename)
  const stopDirectory = isPathInside(normalizedProjectRoot, absoluteFilename)
    ? normalizedProjectRoot
    : path.parse(absoluteFilename).root

  while (true) {
    if (path.basename(directory) === 'src') return directory
    if (directory === stopDirectory) break
    const parent = path.dirname(directory)
    if (parent === directory) break
    directory = parent
  }

  return null
}

function stripImportQuery(specifier) {
  return String(specifier || '').split(/[?#]/, 1)[0]
}

function isStylesheetSpecifier(specifier) {
  const clean = stripImportQuery(specifier).toLowerCase()
  return STYLESHEET_EXTENSIONS.some((extension) => clean.endsWith(extension))
}

function extractStylesheetImports(source) {
  const imports = []
  const patterns = [
    /\bimport\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(source))) {
      const specifier = match[1]?.trim()
      if (specifier && isStylesheetSpecifier(specifier)) imports.push(specifier)
    }
  }

  return [...new Set(imports)]
}

function resolveImportedStylesheet(specifier, importerPath, sourceRoot, projectRoot) {
  const clean = stripImportQuery(specifier)
  if (!clean) return null

  let candidate = null
  if (clean.startsWith('.')) {
    candidate = path.resolve(path.dirname(importerPath), clean)
  } else if ((clean.startsWith('@/') || clean.startsWith('~/')) && sourceRoot) {
    candidate = path.resolve(sourceRoot, clean.slice(2))
  } else if (clean.startsWith('/src/')) {
    candidate = path.resolve(projectRoot, clean.slice(1))
  } else if (clean.startsWith('/')) {
    candidate = path.resolve(projectRoot, clean.slice(1))
  }

  return candidate && isExistingFile(candidate) ? candidate : null
}

function containsTailwindMarkers(filePath) {
  const source = readFileSafely(filePath)
  return /(?:@import\s+["']tailwindcss|@tailwind\s+|@theme\b|@utility\b|@custom-variant\b)/.test(source)
}

function rankImportedStylesheet(filePath, originalIndex) {
  const basename = path.basename(filePath).toLowerCase()
  const knownNameIndex = STYLESHEET_NAMES.indexOf(basename)
  let score = 0
  if (containsTailwindMarkers(filePath)) score += 1000
  if (knownNameIndex !== -1) score += 100 - knownNameIndex
  return { filePath, score, originalIndex }
}

function selectImportedStylesheet(importedPaths) {
  if (importedPaths.length === 0) return null
  return importedPaths
    .map(rankImportedStylesheet)
    .sort((left, right) => right.score - left.score || left.originalIndex - right.originalIndex)[0].filePath
}

function getEntryFileCandidates(sourceRoot, applicationRoot) {
  const candidates = []
  const seen = new Set()
  const roots = [sourceRoot, applicationRoot].filter(Boolean)

  for (const root of roots) {
    for (const name of ENTRY_FILE_NAMES) {
      for (const extension of ENTRY_FILE_EXTENSIONS) {
        addCandidate(candidates, seen, path.join(root, `${name}${extension}`))
      }
    }
  }

  return candidates.filter(isExistingFile)
}

function resolveImportedEntryStylesheet(filename, sourceRoot, projectRoot) {
  const importedPaths = []
  const seen = new Set()
  const applicationRoot = sourceRoot ? path.dirname(sourceRoot) : projectRoot
  const sourceFiles = []

  if (filename && isExistingFile(filename)) sourceFiles.push(filename)
  sourceFiles.push(...getEntryFileCandidates(sourceRoot, applicationRoot))

  for (const sourceFile of sourceFiles) {
    const source = readFileSafely(sourceFile)
    for (const specifier of extractStylesheetImports(source)) {
      const resolved = resolveImportedStylesheet(specifier, sourceFile, sourceRoot, projectRoot)
      if (!resolved || seen.has(resolved)) continue
      seen.add(resolved)
      importedPaths.push(resolved)
    }
  }

  return selectImportedStylesheet(importedPaths)
}

function resolveAutoDetectedStylesheet(filename = '', cwd = process.cwd()) {
  const normalizedCwd = path.resolve(cwd)
  const absoluteFilename =
    filename && filename !== '<input>' && filename !== '<text>'
      ? path.isAbsolute(filename)
        ? path.resolve(filename)
        : path.resolve(normalizedCwd, filename)
      : null
  const projectRoot = findNearestPackageRoot(absoluteFilename || '', normalizedCwd)
  const sourceRoot = findNearestSourceRoot(absoluteFilename || '', projectRoot)
  const applicationRoot = sourceRoot ? path.dirname(sourceRoot) : projectRoot

  const imported = resolveImportedEntryStylesheet(absoluteFilename, sourceRoot, projectRoot)
  if (imported) return imported

  const candidates = []
  const seen = new Set()

  if (sourceRoot) addDirectoryStylesheetCandidates(candidates, seen, sourceRoot)

  if (absoluteFilename) {
    const stopDirectory = isPathInside(projectRoot, absoluteFilename)
      ? projectRoot
      : path.parse(absoluteFilename).root
    let directory = path.dirname(absoluteFilename)

    while (true) {
      addDirectoryStylesheetCandidates(candidates, seen, directory)
      if (directory === stopDirectory) break

      const parent = path.dirname(directory)
      if (parent === directory) break
      directory = parent
    }
  }

  addDirectoryStylesheetCandidates(candidates, seen, applicationRoot)
  addDirectoryStylesheetCandidates(candidates, seen, path.join(projectRoot, 'src'))
  addDirectoryStylesheetCandidates(candidates, seen, projectRoot)

  return candidates.find(isExistingFile) || null
}

function resolveStylesheet(settings = {}, filename = '', cwd = process.cwd()) {
  const configured = resolveConfiguredStylesheet(settings, filename, cwd)
  if (configured) return configured
  if (settings.autoDetectStylesheet === false) return null
  return resolveAutoDetectedStylesheet(filename, cwd)
}

function globToRegExp(pattern) {
  const normalized = normalizePath(pattern)
  let result = '^'

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    if (char === '*') {
      if (normalized[index + 1] === '*') {
        result += '.*'
        index += 1
      } else {
        result += '[^/]*'
      }
      continue
    }

    if (char === '?') {
      result += '[^/]'
      continue
    }

    result += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
  }

  result += '$'
  return new RegExp(result)
}

function getRelativeFilename(filename, cwd) {
  if (!filename || filename === '<input>' || filename === '<text>') return ''
  const absolute = path.isAbsolute(filename) ? filename : path.resolve(cwd, filename)
  return normalizePath(path.relative(cwd, absolute))
}

function replacePagePlaceholder(stylesheetPath, relativeFilename) {
  if (!stylesheetPath?.includes('{page}')) return stylesheetPath || null
  const match = relativeFilename.match(/(?:^|\/)pages\/([^/]+)(?:\/|$)/)
  if (!match) return null
  return stylesheetPath.replaceAll('{page}', match[1])
}

function resolveConfiguredStylesheet(settings = {}, filename = '', cwd = process.cwd()) {
  const relativeFilename = getRelativeFilename(filename, cwd)

  if (settings.stylesheets && typeof settings.stylesheets === 'object') {
    for (const [pattern, stylesheetPath] of Object.entries(settings.stylesheets)) {
      if (typeof stylesheetPath !== 'string') continue
      if (globToRegExp(pattern).test(relativeFilename)) {
        return replacePagePlaceholder(stylesheetPath, relativeFilename)
      }
    }
  }

  return replacePagePlaceholder(settings.stylesheet, relativeFilename)
}

function mergeThemeOptions(ruleTheme = {}, stylesheetTheme = {}) {
  const theme = {
    fontSize: [...(ruleTheme.fontSize || [])],
    colors: [...(ruleTheme.colors || [])]
  }

  if (stylesheetTheme.fontSizes?.length) {
    theme.fontSize.push(...stylesheetTheme.fontSizes)
  }

  if (stylesheetTheme.colors?.length) {
    theme.colors.push(...stylesheetTheme.colors)
  }

  return theme
}

function normalizeBoolean(value, defaultValue) {
  return typeof value === 'boolean' ? value : defaultValue
}

function normalizeMaxImportDepth(value) {
  if (Number.isInteger(value) && value >= 0) return value
  return 10
}

function normalizeMaxClassLineLength(value) {
  if (value === 0) return 0
  if (Number.isInteger(value) && value > 0) return value
  return 100
}

function finalizeOptions(options) {
  return {
    attributes: new Set([...DEFAULT_ATTRIBUTES, ...(options.attributes || [])]),
    functions: new Set(options.functions || DEFAULT_FUNCTIONS),
    breakpoints: options.breakpoints || DEFAULT_BREAKPOINTS,
    states: options.states || DEFAULT_STATES,
    customVariants: new Set(options.customVariants || []),
    theme: options.theme || {},
    ignore: [...new Set([...DEFAULT_IGNORED_CLASSES, ...(options.ignore || [])])],
    maxClassLineLength: normalizeMaxClassLineLength(options.maxClassLineLength),
    customClasses: new Set(options.customClasses || []),
    customUtilities: new Set(options.customUtilities || []),
    customUtilityPatterns: options.customUtilityPatterns || []
  }
}

function resolveSortOptions(context, userOptions = {}) {
  const pluginSettings = getPluginSettings(context)
  const cwd = context.cwd || process.cwd()
  const filename = getContextFilename(context)
  const stylesheetPath = resolveStylesheet(pluginSettings, filename, cwd)

  const stylesheetOptions = {
    detectCustomClasses: normalizeBoolean(pluginSettings.detectCustomClasses, true),
    followImports: normalizeBoolean(pluginSettings.followImports, true),
    maxImportDepth: normalizeMaxImportDepth(pluginSettings.maxImportDepth)
  }

  const base = {
    attributes: userOptions.attributes,
    functions: userOptions.functions,
    breakpoints: userOptions.breakpoints,
    states: userOptions.states,
    customVariants: [],
    theme: userOptions.theme || {},
    ignore: userOptions.ignore,
    maxClassLineLength:
      userOptions.maxClassLineLength ?? pluginSettings.maxClassLineLength,
    customClasses: [],
    customUtilities: [],
    customUtilityPatterns: []
  }

  if (!stylesheetPath) {
    return finalizeOptions(base)
  }

  const loaded = loadStylesheetTheme(stylesheetPath, cwd, stylesheetOptions)
  if (!loaded.ok) {
    return finalizeOptions(base)
  }

  return finalizeOptions({
    ...base,
    breakpoints:
      userOptions.breakpoints ||
      mergeBreakpoints(
        DEFAULT_BREAKPOINT_METADATA,
        loaded.breakpoints,
        pluginSettings.breakpointOrder
      ),
    customVariants: loaded.customVariants,
    theme: mergeThemeOptions(userOptions.theme, loaded),
    customClasses: loaded.customClasses,
    customUtilities: loaded.customUtilities,
    customUtilityPatterns: loaded.customUtilityPatterns
  })
}

module.exports = {
  ENTRY_FILE_EXTENSIONS,
  ENTRY_FILE_NAMES,
  STYLESHEET_DIRECTORY_NAMES,
  STYLESHEET_EXTENSIONS,
  STYLESHEET_NAMES,
  extractStylesheetImports,
  finalizeOptions,
  findNearestPackageRoot,
  findNearestSourceRoot,
  getContextFilename,
  getPluginSettings,
  getRelativeFilename,
  globToRegExp,
  mergeThemeOptions,
  normalizeBoolean,
  normalizeMaxClassLineLength,
  normalizeMaxImportDepth,
  replacePagePlaceholder,
  resolveAutoDetectedStylesheet,
  resolveConfiguredStylesheet,
  resolveImportedEntryStylesheet,
  resolveImportedStylesheet,
  resolveStylesheet,
  resolveSortOptions,
  selectImportedStylesheet
}
