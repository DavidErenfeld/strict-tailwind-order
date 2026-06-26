import * as prettierPluginBabel from 'prettier/plugins/babel';
import * as prettierPluginEstree from 'prettier/plugins/estree';
import * as prettierPluginHtml from 'prettier/plugins/html';
import * as prettierPluginTypeScript from 'prettier/plugins/typescript';
import {doc} from 'prettier';

import expressionsModule from './lib/expressions.cjs';
import settingsModule from './lib/settings.cjs';
import sortModule from './lib/sort.cjs';
import vueSelfClosingModule from './lib/vue-self-closing.cjs';

const {collectClassStrings, getCallName, isStaticStringNode} = expressionsModule;
const {resolveSortOptions} = settingsModule;
const {sortTokenItems, tokenize, wrapFamilyGroups} = sortModule;
const {prepareVueSelfClosingHtml} = vueSelfClosingModule;
const {group, indent, hardline, join} = doc.builders;

const CATEGORY = 'Strict Tailwind Order';
const DEFAULT_MAX_CLASS_LINE_LENGTH = 100;
const DYNAMIC_VUE_ATTRIBUTES = new Set([':class', 'v-bind:class']);
const HTML_PARSERS = ['html', 'vue', 'angular', 'lwc', 'mjml'];

function asArray(value) {
  return Array.isArray(value) && value.length > 0 ? value : undefined;
}

function buildSortOptions(prettierOptions) {
  const pluginSettings = {
    stylesheet: prettierOptions.strictTailwindStylesheet || undefined,
    autoDetectStylesheet: prettierOptions.strictTailwindAutoDetectStylesheet,
    detectCustomClasses: prettierOptions.strictTailwindDetectCustomClasses,
    followImports: prettierOptions.strictTailwindFollowImports,
    maxImportDepth: prettierOptions.strictTailwindMaxImportDepth,
    maxClassLineLength: prettierOptions.strictTailwindMaxClassLineLength,
  };

  const ruleOptions = {
    attributes: asArray(prettierOptions.strictTailwindAttributes),
    functions: asArray(prettierOptions.strictTailwindFunctions),
    breakpoints: asArray(prettierOptions.strictTailwindBreakpoints),
    states: asArray(prettierOptions.strictTailwindStates),
    maxClassLineLength: prettierOptions.strictTailwindMaxClassLineLength,
  };

  return {
    ...resolveSortOptions(
      {
        settings: {strictTailwindOrder: pluginSettings},
        filename: prettierOptions.filepath || '',
        cwd: process.cwd(),
      },
      ruleOptions,
    ),
    preserveWhitespace: prettierOptions.strictTailwindPreserveWhitespace === true,
  };
}

function joinTokensWithSeparators(tokens, separators) {
  let result = separators[0] || '';
  for (let index = 0; index < tokens.length; index += 1) {
    result += tokens[index];
    result += separators[index + 1] || '';
  }
  return result;
}

function shouldWrap(source, maxLineLength) {
  if (!maxLineLength || maxLineLength < 1) return false;
  const lines = source.split(/\r?\n/);
  if (lines.some((line) => line.trim().length > maxLineLength)) return true;
  return !source.includes('\n') && source.trim().length > maxLineLength;
}

function sortClassValue(source, sortOptions, allowWrapping = false) {
  const {tokens, separators} = tokenize(source);
  if (tokens.length < 2) {
    return {value: source, lines: null, changed: false};
  }

  const items = sortTokenItems(tokens, sortOptions);
  const sortedTokens = items.map((item) => item.token);
  const value = sortOptions.preserveWhitespace
    ? joinTokensWithSeparators(sortedTokens, separators)
    : sortedTokens.join(' ');
  const changed = value !== source;

  if (!allowWrapping || !shouldWrap(value, sortOptions.maxClassLineLength)) {
    return {value, lines: null, changed};
  }

  const lines = wrapFamilyGroups(items, sortOptions.maxClassLineLength);
  if (lines.length < 2) return {value, lines: null, changed};
  return {value, lines, changed: true};
}

function walkObject(value, visitor, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  visitor(value);

  for (const [key, child] of Object.entries(value)) {
    if (key === 'parent' || key === 'loc' || key === 'tokens' || key === 'comments' || key === 'extra') continue;
    if (Array.isArray(child)) {
      for (const item of child) walkObject(item, visitor, seen);
    } else {
      walkObject(child, visitor, seen);
    }
  }
}

function getStringNodeContent(node) {
  if (!node) return null;
  if ((node.type === 'StringLiteral' || node.type === 'Literal') && typeof node.value === 'string') {
    return node.value;
  }

  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0 && node.quasis?.length === 1) {
    return node.quasis[0].value.raw;
  }

  return null;
}

function quoteString(value, quote) {
  const escaped = String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll(quote, `\\${quote}`)
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r');
  return `${quote}${escaped}${quote}`;
}

function setStringNodeContent(node, value) {
  if (!node) return;

  if ((node.type === 'StringLiteral' || node.type === 'Literal') && typeof node.value === 'string') {
    node.value = value;
    const raw = node.extra?.raw || node.raw;
    const quote = typeof raw === 'string' && (raw.startsWith("'") || raw.startsWith('"')) ? raw[0] : "'";
    const nextRaw = quoteString(value, quote);
    node.extra = {...(node.extra || {}), raw: nextRaw, rawValue: value};
    if ('raw' in node) node.raw = nextRaw;
    return;
  }

  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0 && node.quasis?.length === 1) {
    node.quasis[0].value.raw = value;
    node.quasis[0].value.cooked = value;
  }
}

function sortCollectedStringNodes(root, sortOptions, wrappedNode = null) {
  const strings = [];
  collectClassStrings(root, strings, new Set(), sortOptions.functions);

  for (const stringNode of strings) {
    const original = getStringNodeContent(stringNode);
    if (original == null) continue;
    const allowWrapping = stringNode.type === 'TemplateLiteral';
    const result = sortClassValue(original, sortOptions, allowWrapping);
    if (!result.changed) continue;
    setStringNodeContent(stringNode, result.lines ? `\n${result.lines.join('\n')}\n` : result.value);
    if (wrappedNode && result.lines) wrappedNode.__strictTailwindLines = result.lines;
  }
}

function transformJavaScriptAst(ast, sortOptions) {
  const processed = new WeakSet();

  walkObject(ast, (node) => {
    if (node.type === 'JSXAttribute') {
      const name = node.name?.name;
      if (!sortOptions.attributes.has(name) || !node.value) return;

      if (isStaticStringNode(node.value)) {
        if (processed.has(node.value)) return;
        processed.add(node.value);
        const original = getStringNodeContent(node.value);
        if (original == null) return;
        const result = sortClassValue(original, sortOptions, true);
        if (!result.changed) return;
        setStringNodeContent(node.value, result.value);
        if (result.lines) node.__strictTailwindLines = result.lines;
        return;
      }

      if (node.value.type === 'JSXExpressionContainer') {
        sortCollectedStringNodes(node.value.expression, sortOptions);
      }
      return;
    }

    if (node.type === 'CallExpression') {
      const name = getCallName(node);
      if (!name || !sortOptions.functions.has(name)) return;
      for (const argument of node.arguments || []) sortCollectedStringNodes(argument, sortOptions);
    }
  });
}

function getNodeInnerRange(node) {
  if (!node || !Number.isInteger(node.start) || !Number.isInteger(node.end)) return null;
  if ((node.type === 'StringLiteral' || node.type === 'Literal') && typeof node.value === 'string') {
    return [node.start + 1, node.end - 1];
  }
  if (node.type === 'TemplateLiteral' && node.expressions?.length === 0) {
    return [node.start + 1, node.end - 1];
  }
  return null;
}

function applyReplacements(source, replacements) {
  let result = source;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    result = `${result.slice(0, replacement.start)}${replacement.value}${result.slice(replacement.end)}`;
  }
  return result;
}

async function sortVueDynamicAttribute(value, sortOptions) {
  if (!/[`'"]/.test(value)) return value;

  const prefix = 'const __strict_tailwind_order__ = (';
  const suffix = ');';
  let ast;
  try {
    ast = await prettierPluginBabel.parsers['babel-ts'].parse(`${prefix}${value}${suffix}`, {
      parser: 'babel-ts',
    });
  } catch {
    return value;
  }

  const declaration = ast.program?.body?.[0]?.declarations?.[0];
  const expression = declaration?.init;
  if (!expression) return value;

  const strings = [];
  collectClassStrings(expression, strings, new Set(), sortOptions.functions);
  const replacements = [];

  for (const node of strings) {
    const range = getNodeInnerRange(node);
    if (!range) continue;
    const start = range[0] - prefix.length;
    const end = range[1] - prefix.length;
    if (start < 0 || end < start || end > value.length) continue;

    const original = value.slice(start, end);
    const result = sortClassValue(original, sortOptions, node.type === 'TemplateLiteral');
    if (!result.changed) continue;
    replacements.push({
      start,
      end,
      value: result.lines ? `\n${result.lines.join('\n')}\n` : result.value,
    });
  }

  return replacements.length ? applyReplacements(value, replacements) : value;
}

async function transformHtmlAst(ast, sortOptions) {
  async function visit(node) {
    if (!node || typeof node !== 'object') return;

    for (const attribute of node.attrs || []) {
      if (!attribute?.name || typeof attribute.value !== 'string') continue;

      if (sortOptions.attributes.has(attribute.name)) {
        const result = sortClassValue(attribute.value, sortOptions, true);
        if (result.changed) attribute.value = result.value;
        if (result.lines) attribute.__strictTailwindLines = result.lines;
        continue;
      }

      if (DYNAMIC_VUE_ATTRIBUTES.has(attribute.name)) {
        attribute.value = await sortVueDynamicAttribute(attribute.value, sortOptions);
      }
    }

    for (const child of node.children || []) await visit(child);
  }

  await visit(ast);
}

function createWrappedValueDoc(lines) {
  return group([indent([hardline, join(hardline, lines)]), hardline]);
}

function replaceHtmlAttributeDoc(input, attribute) {
  let replaced = false;

  function visit(value) {
    if (replaced || value == null) return value;

    if (Array.isArray(value)) {
      if (value[0] === attribute.name && value[1] === '="' && value.at(-1) === '"') {
        const next = [...value];
        next[2] = createWrappedValueDoc(attribute.__strictTailwindLines);
        replaced = true;
        return next;
      }

      if (value[0] === attribute.name && value[1] === '=' && (value[2] === '"' || value[2] === "'")) {
        const next = [...value];
        next[3] = createWrappedValueDoc(attribute.__strictTailwindLines);
        replaced = true;
        return next;
      }

      return value.map(visit);
    }

    if (typeof value === 'object') {
      const next = {...value};
      for (const key of ['contents', 'parts', 'expandedStates']) {
        if (key in next) next[key] = visit(next[key]);
      }
      return next;
    }

    return value;
  }

  return visit(input);
}

function wrapHtmlElementDoc(node, printed) {
  const wrappedAttributes = (node.attrs || []).filter((attribute) => attribute.__strictTailwindLines?.length > 1);
  let result = printed;
  for (const attribute of wrappedAttributes) result = replaceHtmlAttributeDoc(result, attribute);
  return result;
}

function createHtmlParser(originalParser, parserName) {
  return {
    ...originalParser,
    async parse(text, options) {
      const prepared = parserName === 'vue' ? prepareVueSelfClosingHtml(text) : null;
      const ast = await originalParser.parse(prepared?.text || text, options);
      prepared?.restore(ast);
      await transformHtmlAst(ast, buildSortOptions(options));
      return ast;
    },
  };
}

function createJavaScriptParser(originalParser) {
  return {
    ...originalParser,
    async parse(text, options) {
      const ast = await originalParser.parse(text, options);
      transformJavaScriptAst(ast, buildSortOptions(options));
      return ast;
    },
  };
}

const htmlPrinter = prettierPluginHtml.printers.html;
const estreePrinter = prettierPluginEstree.printers.estree;

export const parsers = {};
for (const parserName of HTML_PARSERS) {
  const parser = prettierPluginHtml.parsers[parserName];
  if (parser) parsers[parserName] = createHtmlParser(parser, parserName);
}

for (const parserName of ['babel', 'babel-flow', 'babel-ts', '__js_expression']) {
  const parser = prettierPluginBabel.parsers[parserName];
  if (parser) parsers[parserName] = createJavaScriptParser(parser);
}

if (prettierPluginTypeScript.parsers.typescript) {
  parsers.typescript = createJavaScriptParser(prettierPluginTypeScript.parsers.typescript);
}

export const printers = {
  html: {
    ...htmlPrinter,
    print(path, options, print) {
      const printed = htmlPrinter.print(path, options, print);
      return path.node?.kind === 'element' ? wrapHtmlElementDoc(path.node, printed) : printed;
    },
  },
  estree: {
    ...estreePrinter,
    print(path, options, print) {
      const node = path.node;
      if (node?.type === 'JSXAttribute' && node.__strictTailwindLines?.length > 1) {
        return group([
          `${node.name.name}="`,
          indent([hardline, join(hardline, node.__strictTailwindLines)]),
          hardline,
          '"',
        ]);
      }
      return estreePrinter.print(path, options, print);
    },
  },
};

export const options = {
  strictTailwindStylesheet: {
    type: 'string',
    category: CATEGORY,
    description: 'Optional stylesheet path. When omitted, the plugin detects the closest Tailwind stylesheet automatically.',
  },
  strictTailwindMaxClassLineLength: {
    type: 'int',
    default: DEFAULT_MAX_CLASS_LINE_LENGTH,
    category: CATEGORY,
    description: 'Maximum class-content line length before family-safe wrapping. Use 0 to disable wrapping.',
  },
  strictTailwindAttributes: {
    type: 'string',
    array: true,
    default: [{value: []}],
    category: CATEGORY,
    description: 'Additional attributes that contain sortable class lists.',
  },
  strictTailwindPreserveWhitespace: {
    type: 'boolean',
    default: false,
    category: CATEGORY,
    description: 'Preserve existing whitespace when sorting does not require family-safe wrapping.',
  },
  strictTailwindFunctions: {
    type: 'string',
    array: true,
    default: [{value: []}],
    category: CATEGORY,
    description: 'Functions whose string arguments contain sortable class lists.',
  },
  strictTailwindBreakpoints: {
    type: 'string',
    array: true,
    default: [{value: []}],
    category: CATEGORY,
    description: 'Optional explicit breakpoint order.',
  },
  strictTailwindStates: {
    type: 'string',
    array: true,
    default: [{value: []}],
    category: CATEGORY,
    description: 'Optional explicit state-variant order.',
  },
  strictTailwindAutoDetectStylesheet: {
    type: 'boolean',
    default: true,
    category: CATEGORY,
    description: 'Automatically discover the closest Tailwind stylesheet.',
  },
  strictTailwindDetectCustomClasses: {
    type: 'boolean',
    default: true,
    category: CATEGORY,
    description: 'Detect custom classes and utilities from the stylesheet.',
  },
  strictTailwindFollowImports: {
    type: 'boolean',
    default: true,
    category: CATEGORY,
    description: 'Follow local stylesheet imports while detecting project classes.',
  },
  strictTailwindMaxImportDepth: {
    type: 'int',
    default: 10,
    category: CATEGORY,
    description: 'Maximum local stylesheet import depth.',
  },
};

const plugin = {parsers, printers, options};
export default plugin;
