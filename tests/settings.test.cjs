const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  extractStylesheetImports,
  finalizeOptions,
  findNearestPackageRoot,
  resolveAutoDetectedStylesheet,
  resolveConfiguredStylesheet,
  resolveStylesheet
} = require('../lib/settings.cjs')

function createFile(filePath, content = '') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
}

test('auto-detects the current page stylesheet in a multi-page repository', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tailwind-pages-'))
  const stylesheet = path.join(directory, 'pages/02/src/main.css')
  const component = path.join(directory, 'pages/02/src/components/Hero.vue')
  createFile(stylesheet, '@theme { --color-brand: #000; }')
  createFile(component, '<template />')

  try {
    assert.equal(resolveAutoDetectedStylesheet(component, directory), stylesheet)
    assert.equal(resolveStylesheet({}, component, directory), stylesheet)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('detects a stylesheet imported by the nearest application entry file', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tailwind-import-'))
  const stylesheet = path.join(directory, 'src/assets/site.css')
  const entry = path.join(directory, 'src/main.ts')
  const component = path.join(directory, 'src/components/Hero.vue')
  createFile(path.join(directory, 'package.json'), '{}')
  createFile(stylesheet, '@import "tailwindcss";')
  createFile(entry, "import { createApp } from 'vue'\nimport './assets/site.css'\n")
  createFile(component, '<template />')

  try {
    assert.equal(resolveAutoDetectedStylesheet(component, directory), stylesheet)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('supports source-root aliases when detecting imported stylesheets', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tailwind-alias-'))
  const stylesheet = path.join(directory, 'src/styles/globals.css')
  const component = path.join(directory, 'src/components/Hero.vue')
  createFile(path.join(directory, 'package.json'), '{}')
  createFile(path.join(directory, 'src/main.ts'), "import '@/styles/globals.css'\n")
  createFile(stylesheet, '@theme { --color-brand: #000; }')
  createFile(component, '<template />')

  try {
    assert.equal(resolveAutoDetectedStylesheet(component, directory), stylesheet)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('prefers a Tailwind entry import when the entry file imports multiple stylesheets', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tailwind-ranked-import-'))
  const reset = path.join(directory, 'src/reset.css')
  const tailwind = path.join(directory, 'src/styles/app-shell.css')
  const component = path.join(directory, 'src/components/Hero.vue')
  createFile(path.join(directory, 'package.json'), '{}')
  createFile(path.join(directory, 'src/main.js'), "import './reset.css'\nimport './styles/app-shell.css'\n")
  createFile(reset, 'html { box-sizing: border-box; }')
  createFile(tailwind, '@import "tailwindcss";')
  createFile(component, '<template />')

  try {
    assert.equal(resolveAutoDetectedStylesheet(component, directory), tailwind)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('extracts static stylesheet imports from import, require, and dynamic import syntax', () => {
  const imports = extractStylesheetImports(`
    import './main.css'
    import styles from './module.scss'
    require('./legacy.less')
    import('./lazy.pcss?inline')
    import './not-a-style.js'
  `)

  assert.deepEqual(imports, ['./main.css', './module.scss', './legacy.less', './lazy.pcss?inline'])
})

test('auto-detects common global stylesheet names without configuration', () => {
  for (const name of ['app.css', 'styles.css', 'globals.css', 'tailwind.css']) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tailwind-name-'))
    const stylesheet = path.join(directory, 'src', name)
    const component = path.join(directory, 'src/components/Hero.vue')
    createFile(stylesheet, '@import "tailwindcss";')
    createFile(component, '<template />')

    try {
      assert.equal(resolveAutoDetectedStylesheet(component, directory), stylesheet)
    } finally {
      fs.rmSync(directory, { recursive: true, force: true })
    }
  }
})

test('auto-detects the nearest main.css in a regular src project', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tailwind-src-'))
  const stylesheet = path.join(directory, 'src/main.css')
  const component = path.join(directory, 'src/components/Hero.vue')
  createFile(stylesheet, '@import "tailwindcss";')
  createFile(component, '<template />')

  try {
    assert.equal(resolveAutoDetectedStylesheet(component, directory), stylesheet)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('uses the nearest package.json as the project root in a monorepo', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tailwind-monorepo-'))
  const appRoot = path.join(directory, 'apps/storefront')
  const appStylesheet = path.join(appRoot, 'src/globals.css')
  const rootStylesheet = path.join(directory, 'src/main.css')
  const component = path.join(appRoot, 'src/components/Hero.vue')
  createFile(path.join(directory, 'package.json'), '{"private":true}')
  createFile(path.join(appRoot, 'package.json'), '{"name":"storefront"}')
  createFile(rootStylesheet, '@theme { --color-root: #000; }')
  createFile(appStylesheet, '@theme { --color-app: #fff; }')
  createFile(component, '<template />')

  try {
    assert.equal(findNearestPackageRoot(component, directory), appRoot)
    assert.equal(resolveAutoDetectedStylesheet(component, directory), appStylesheet)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('explicit stylesheet configuration overrides auto-detection', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tailwind-explicit-'))
  const automatic = path.join(directory, 'src/main.css')
  const explicit = 'styles/tailwind.css'
  const component = path.join(directory, 'src/components/Hero.vue')
  createFile(automatic, '@import "tailwindcss";')
  createFile(path.join(directory, explicit), '@import "tailwindcss";')
  createFile(component, '<template />')

  try {
    assert.equal(resolveConfiguredStylesheet({ stylesheet: explicit }, component, directory), explicit)
    assert.equal(resolveStylesheet({ stylesheet: explicit }, component, directory), explicit)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('auto-detection can be disabled', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tailwind-disabled-'))
  const component = path.join(directory, 'src/components/Hero.vue')
  createFile(path.join(directory, 'src/main.css'), '@import "tailwindcss";')
  createFile(component, '<template />')

  try {
    assert.equal(resolveStylesheet({ autoDetectStylesheet: false }, component, directory), null)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('the generic defaults do not include organization-specific ignored classes', () => {
  const options = finalizeOptions({ ignore: ['analytics-hook'] })
  assert.deepEqual(options.ignore, ['analytics-hook'])
})

test('auto-detects a sibling css directory from src js components', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tailwind-src-siblings-'))
  const stylesheet = path.join(directory, 'dev/src/css/app.css')
  const component = path.join(directory, 'dev/src/js/Components/App.vue')
  createFile(path.join(directory, 'dev/package.json'), '{}')
  createFile(stylesheet, '@theme { --breakpoint-3xl: 120rem; }')
  createFile(component, '<template />')

  try {
    assert.equal(resolveAutoDetectedStylesheet(component, path.join(directory, 'dev')), stylesheet)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('auto-detects a sibling css directory from a resources build application', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tailwind-resources-build-'))
  const stylesheet = path.join(directory, 'resources/builds/default/css/app.css')
  const component = path.join(directory, 'resources/builds/default/js/Components/App.vue')
  createFile(path.join(directory, 'package.json'), '{}')
  createFile(stylesheet, '@theme { --breakpoint-3xl: 120rem; }')
  createFile(component, '<template />')

  try {
    assert.equal(resolveAutoDetectedStylesheet(component, directory), stylesheet)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('does not cross into a sibling page while searching nested style directories', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tailwind-page-boundary-'))
  const pageOneStylesheet = path.join(directory, 'pages/01/src/css/app.css')
  const pageTwoStylesheet = path.join(directory, 'pages/02/src/css/app.css')
  const component = path.join(directory, 'pages/02/src/js/Components/App.vue')
  createFile(path.join(directory, 'package.json'), '{}')
  createFile(pageOneStylesheet, '@theme { --color-one: #000; }')
  createFile(pageTwoStylesheet, '@theme { --color-two: #fff; }')
  createFile(component, '<template />')

  try {
    assert.equal(resolveAutoDetectedStylesheet(component, directory), pageTwoStylesheet)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('auto-detects a page src stylesheet for an entry html file', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'strict-tailwind-page-entry-'))
  const stylesheet = path.join(directory, 'pages/01/src/main.css')
  const entry = path.join(directory, 'pages/01/index.html')
  createFile(path.join(directory, 'package.json'), '{}')
  createFile(stylesheet, '@theme { --color-brand: #000; }')
  createFile(entry, '<div class="text-brand"></div>')

  try {
    assert.equal(resolveAutoDetectedStylesheet(entry, directory), stylesheet)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
