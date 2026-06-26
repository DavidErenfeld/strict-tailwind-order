const REGULAR_HTML_ELEMENTS = new Set([
  'a',
  'abbr',
  'address',
  'article',
  'aside',
  'audio',
  'b',
  'bdi',
  'bdo',
  'blockquote',
  'body',
  'button',
  'canvas',
  'caption',
  'cite',
  'code',
  'colgroup',
  'data',
  'datalist',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'div',
  'dl',
  'dt',
  'em',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hgroup',
  'html',
  'i',
  'iframe',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'main',
  'map',
  'mark',
  'menu',
  'meter',
  'nav',
  'noscript',
  'object',
  'ol',
  'optgroup',
  'option',
  'output',
  'p',
  'picture',
  'pre',
  'progress',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'search',
  'section',
  'select',
  'slot',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'title',
  'tr',
  'u',
  'ul',
  'var',
  'video'
])

function isTagNameCharacter(char) {
  return Boolean(char) && /[A-Za-z0-9:_-]/.test(char)
}

function readTag(source, start) {
  if (source[start] !== '<' || source.startsWith('<!--', start)) return null

  let cursor = start + 1
  let closing = false

  if (source[cursor] === '/') {
    closing = true
    cursor += 1
  }

  while (/\s/.test(source[cursor] || '')) cursor += 1
  const nameStart = cursor

  while (isTagNameCharacter(source[cursor])) cursor += 1
  if (cursor === nameStart) return null

  const nameEnd = cursor
  let quote = null

  while (cursor < source.length) {
    const char = source[cursor]

    if (quote) {
      if (char === '\\') {
        cursor += 2
        continue
      }
      if (char === quote) quote = null
      cursor += 1
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      cursor += 1
      continue
    }

    if (char === '>') {
      let previous = cursor - 1
      while (previous > nameEnd && /\s/.test(source[previous])) previous -= 1
      return {
        start,
        end: cursor + 1,
        nameStart,
        nameEnd,
        name: source.slice(nameStart, nameEnd),
        closing,
        selfClosing: source[previous] === '/'
      }
    }

    cursor += 1
  }

  return null
}

function skipComment(source, start) {
  const end = source.indexOf('-->', start + 4)
  return end === -1 ? source.length : end + 3
}

function skipInterpolation(source, start) {
  let cursor = start + 2
  let quote = null
  let lineComment = false
  let blockComment = false

  while (cursor < source.length) {
    const char = source[cursor]
    const next = source[cursor + 1]

    if (lineComment) {
      if (char === '\n' || char === '\r') lineComment = false
      cursor += 1
      continue
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        cursor += 2
      } else {
        cursor += 1
      }
      continue
    }

    if (quote) {
      if (char === '\\') {
        cursor += 2
        continue
      }
      if (char === quote) quote = null
      cursor += 1
      continue
    }

    if (char === '/' && next === '/') {
      lineComment = true
      cursor += 2
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      cursor += 2
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      cursor += 1
      continue
    }

    if (char === '}' && next === '}') return cursor + 2
    cursor += 1
  }

  return source.length
}

function findRawBlockEnd(source, tag, start) {
  const lowerSource = source.toLowerCase()
  const closingStart = lowerSource.indexOf(`</${tag}`, start)
  if (closingStart === -1) return source.length
  const closingTag = readTag(source, closingStart)
  return closingTag?.end || source.length
}

function extractRawAttributeValue(source, start, end) {
  const raw = source.slice(start, end)
  const equalsIndex = raw.indexOf('=')
  if (equalsIndex === -1) return ''

  const value = raw.slice(equalsIndex + 1).trim()
  const quote = value[0]

  if ((quote === '"' || quote === "'") && value.at(-1) === quote) {
    return value.slice(1, -1)
  }

  return value.split(/\s/, 1)[0]
}

function restoreProtectedAttributes(node, source, protectedPositions) {
  for (const attribute of node.attrs || []) {
    const start = attribute.sourceSpan?.start?.offset
    const end = attribute.sourceSpan?.end?.offset
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue
    if (!protectedPositions.some((position) => position >= start && position < end)) continue
    attribute.value = extractRawAttributeValue(source, start, end)
  }
}

function restoreVueSelfClosingHtml(ast, source, mappings) {
  if (mappings.size === 0) return

  function visit(node) {
    if (!node || typeof node !== 'object') return

    if (node.kind === 'element') {
      const offset = node.nameSpan?.start?.offset
      const mapping = mappings.get(offset)

      if (mapping) {
        node.name = mapping.name
        restoreProtectedAttributes(node, source, mapping.protectedPositions)
      }
    }

    for (const child of node.children || []) visit(child)
  }

  visit(ast)
}

function prepareVueSelfClosingHtml(source) {
  const characters = source.split('')
  const mappings = new Map()
  let templateDepth = 0
  let cursor = 0

  while (cursor < source.length) {
    if (source.startsWith('<!--', cursor)) {
      cursor = skipComment(source, cursor)
      continue
    }

    if (templateDepth > 0 && source.startsWith('{{', cursor)) {
      cursor = skipInterpolation(source, cursor)
      continue
    }

    if (source[cursor] !== '<') {
      cursor += 1
      continue
    }

    const tag = readTag(source, cursor)
    if (!tag) {
      cursor += 1
      continue
    }

    const normalizedName = tag.name.toLowerCase()

    if (templateDepth === 0 && !tag.closing && !tag.selfClosing && (normalizedName === 'script' || normalizedName === 'style')) {
      cursor = findRawBlockEnd(source, normalizedName, tag.end)
      continue
    }

    if (normalizedName === 'template') {
      if (tag.closing) templateDepth = Math.max(0, templateDepth - 1)
      else if (!tag.selfClosing) templateDepth += 1
      cursor = tag.end
      continue
    }

    if (templateDepth > 0 && !tag.closing && !tag.selfClosing && (normalizedName === 'script' || normalizedName === 'style')) {
      cursor = findRawBlockEnd(source, normalizedName, tag.end)
      continue
    }

    if (
      templateDepth > 0 &&
      !tag.closing &&
      tag.selfClosing &&
      tag.name === normalizedName &&
      REGULAR_HTML_ELEMENTS.has(normalizedName)
    ) {
      const protectedPositions = []
      characters[tag.nameStart] = characters[tag.nameStart].toUpperCase()

      for (let index = tag.nameEnd; index < tag.end; index += 1) {
        if (source[index] !== '&') continue
        characters[index] = 'x'
        protectedPositions.push(index)
      }

      mappings.set(tag.nameStart, {
        name: tag.name,
        protectedPositions
      })
    }

    cursor = tag.end
  }

  return {
    text: mappings.size > 0 ? characters.join('') : source,
    restore(ast) {
      restoreVueSelfClosingHtml(ast, source, mappings)
    }
  }
}

module.exports = {
  REGULAR_HTML_ELEMENTS,
  prepareVueSelfClosingHtml,
  readTag,
  restoreVueSelfClosingHtml,
  skipInterpolation
}
