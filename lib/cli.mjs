import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import fg from 'fast-glob';
import vueSelfClosingModule from './vue-self-closing.cjs';
import strictPlugin, * as strictPluginModule from '../index.mjs';

const {protectVueSelfClosingHtmlForOfficial} = vueSelfClosingModule;

const PACKAGE_NAME = 'strict-tailwind-order';
const OFFICIAL_PLUGIN_NAME = 'prettier-plugin-tailwindcss';
const SUPPORTED_PRETTIER = '>=3.7.0 <4.0.0';
const SUPPORTED_OFFICIAL = '>=0.8.0 <0.9.0';
const OFFICIAL_OPTIONS = new Set([
  'tailwindStylesheet',
  'tailwindEntryPoint',
  'tailwindConfig',
  'tailwindAttributes',
  'tailwindFunctions',
  'tailwindPreserveWhitespace',
  'tailwindPreserveDuplicates',
  'tailwindPackageName',
]);

class CliError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.exitCode = exitCode;
  }
}

function parseVersion(value) {
  const match = String(value || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function isSupportedVersion(version, minimum, maximumExclusive) {
  const parsed = parseVersion(version);
  return Boolean(
    parsed &&
      compareVersions(parsed, minimum) >= 0 &&
      compareVersions(parsed, maximumExclusive) < 0,
  );
}

function consumerRequire(cwd) {
  return createRequire(path.join(cwd, 'package.json'));
}

function findPackageJson(entryPath) {
  let directory = path.dirname(entryPath);
  const root = path.parse(directory).root;

  while (directory !== root) {
    const candidate = path.join(directory, 'package.json');
    if (fsSync.existsSync(candidate)) return candidate;
    directory = path.dirname(directory);
  }

  return null;
}

async function resolveConsumerDependency(name, cwd) {
  const request = consumerRequire(cwd);
  let entryPath;

  try {
    entryPath = request.resolve(name);
  } catch {
    throw new CliError(
      name === OFFICIAL_PLUGIN_NAME
        ? `${PACKAGE_NAME} requires ${OFFICIAL_PLUGIN_NAME} to be installed in the current project. Run: npm install -D ${OFFICIAL_PLUGIN_NAME}`
        : `${PACKAGE_NAME} requires prettier to be installed in the current project. Run: npm install -D prettier`,
    );
  }

  const packageJsonPath = findPackageJson(entryPath);
  if (!packageJsonPath) throw new CliError(`Could not locate package metadata for ${name}.`);

  const metadata = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  const module = await import(pathToFileURL(entryPath).href);
  return {entryPath, metadata, module, plugin: module.default || module};
}

function validateVersions(prettierDependency, officialDependency) {
  const prettierVersion = prettierDependency.metadata.version;
  const officialVersion = officialDependency.metadata.version;

  if (!isSupportedVersion(prettierVersion, [3, 7, 0], [4, 0, 0])) {
    throw new CliError(
      `Unsupported prettier version ${prettierVersion}. Supported range: ${SUPPORTED_PRETTIER}. Run: npm install -D prettier@^3.7.0`,
    );
  }

  if (!isSupportedVersion(officialVersion, [0, 8, 0], [0, 9, 0])) {
    throw new CliError(
      `Unsupported ${OFFICIAL_PLUGIN_NAME} version ${officialVersion}. Supported range: ${SUPPORTED_OFFICIAL}. Run: npm install -D ${OFFICIAL_PLUGIN_NAME}@^0.8.0`,
    );
  }
}

function pluginString(value) {
  if (typeof value === 'string') return value.replaceAll('\\', '/');
  if (value instanceof URL) return value.href.replaceAll('\\', '/');
  return '';
}

function stringMatchesPlugin(value, packageName) {
  const normalized = pluginString(value);
  return (
    normalized === packageName ||
    normalized.endsWith(`/${packageName}`) ||
    normalized.includes(`/node_modules/${packageName}/`)
  );
}

function isPlugin(value, packageName, references) {
  return references.has(value) || stringMatchesPlugin(value, packageName);
}

function withoutPlugins(plugins, packageNames, referenceMap) {
  return (Array.isArray(plugins) ? plugins : []).filter((plugin) =>
    packageNames.every((packageName) => !isPlugin(plugin, packageName, referenceMap.get(packageName))),
  );
}

function officialConfig(config, officialPlugin, referenceMap) {
  const plugins = withoutPlugins(
    config.plugins,
    [PACKAGE_NAME, OFFICIAL_PLUGIN_NAME],
    referenceMap,
  );

  const next = {...config, plugins: [...plugins, officialPlugin]};
  for (const option of Object.keys(next)) {
    if (option.startsWith('strictTailwind')) delete next[option];
  }
  return next;
}

function resolveMappedStylesheet(value, configFile, cwd) {
  if (!value || path.isAbsolute(value)) return value;
  return path.resolve(configFile ? path.dirname(configFile) : cwd, value);
}

function strictConfig(config, configFile, cwd, referenceMap) {
  const plugins = withoutPlugins(
    config.plugins,
    [PACKAGE_NAME, OFFICIAL_PLUGIN_NAME],
    referenceMap,
  );
  const next = {...config, plugins: [...plugins, strictPlugin]};

  const officialStylesheet = config.tailwindStylesheet ?? config.tailwindEntryPoint;
  if (next.strictTailwindStylesheet == null && officialStylesheet != null) {
    next.strictTailwindStylesheet = resolveMappedStylesheet(officialStylesheet, configFile, cwd);
  }
  if (next.strictTailwindAttributes == null && config.tailwindAttributes != null) {
    next.strictTailwindAttributes = config.tailwindAttributes;
  }
  if (next.strictTailwindFunctions == null && config.tailwindFunctions != null) {
    next.strictTailwindFunctions = config.tailwindFunctions;
  }
  if (next.strictTailwindPreserveWhitespace == null && config.tailwindPreserveWhitespace != null) {
    next.strictTailwindPreserveWhitespace = config.tailwindPreserveWhitespace;
  }

  for (const option of OFFICIAL_OPTIONS) delete next[option];
  return next;
}

function parseArguments(args) {
  let mode = null;
  let configPath = null;
  const patterns = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--write' || argument === '--check') {
      if (mode && mode !== argument.slice(2)) {
        throw new CliError('Use either --write or --check, not both.');
      }
      mode = argument.slice(2);
      continue;
    }

    if (argument === '--config' || argument === '--config-path') {
      if (configPath != null) throw new CliError('Use only one --config option.');
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new CliError(`${argument} requires a file path.`);
      }
      configPath = value;
      index += 1;
      continue;
    }

    if (argument.startsWith('--config=') || argument.startsWith('--config-path=')) {
      if (configPath != null) throw new CliError('Use only one --config option.');
      configPath = argument.slice(argument.indexOf('=') + 1);
      if (!configPath) throw new CliError('The config option requires a file path.');
      continue;
    }

    if (argument === '--help' || argument === '-h') return {help: true};
    if (argument === '--version' || argument === '-v') return {version: true};
    if (argument.startsWith('-')) throw new CliError(`Unknown option: ${argument}`);
    patterns.push(argument);
  }

  if (!mode) throw new CliError('Missing mode. Use --write or --check.');
  if (patterns.length === 0) throw new CliError('No files or patterns were provided.');
  return {mode, patterns, configPath};
}

function normalizePathInput(value) {
  return path.sep === '/' ? value.replaceAll('\\', '/') : value;
}

async function resolveExplicitConfigPath(configPath, cwd) {
  if (!configPath) return null;

  const normalized = normalizePathInput(configPath);
  const absolute = path.isAbsolute(normalized) ? path.normalize(normalized) : path.resolve(cwd, normalized);
  let stat;

  try {
    stat = await fs.stat(absolute);
  } catch {
    throw new CliError(`Prettier config file does not exist: ${configPath}`);
  }

  if (!stat.isFile()) throw new CliError(`Prettier config path is not a file: ${configPath}`);
  return absolute;
}

function containsGlob(value) {
  return /[*?{}[\]()!+@]/.test(value);
}

function normalizeGlob(value) {
  return value.replaceAll('\\', '/');
}

async function discoverFiles(patterns, cwd) {
  const records = new Map();

  for (const input of patterns) {
    const absolute = path.resolve(cwd, input);
    let stat = null;
    try {
      stat = await fs.stat(absolute);
    } catch {}

    if (stat?.isFile()) {
      records.set(absolute, {path: absolute, explicit: true});
      continue;
    }

    let matches = [];
    if (stat?.isDirectory()) {
      const relative = normalizeGlob(path.relative(cwd, absolute) || '.');
      matches = await fg(`${relative}/**/*`, {
        cwd,
        absolute: true,
        onlyFiles: true,
        dot: true,
        followSymbolicLinks: false,
        ignore: ['**/.git/**', '**/node_modules/**'],
      });
    } else {
      matches = await fg(normalizeGlob(input), {
        cwd,
        absolute: true,
        onlyFiles: true,
        dot: true,
        followSymbolicLinks: false,
        ignore: ['**/.git/**', '**/node_modules/**'],
      });
    }

    if (matches.length === 0) {
      const kind = containsGlob(input) ? 'pattern' : 'path';
      throw new CliError(`No files matching ${kind}: ${input}`);
    }

    for (const file of matches) records.set(path.resolve(file), {path: path.resolve(file), explicit: false});
  }

  return [...records.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function firstLine(error) {
  return String(error?.message || error).split(/\r?\n/, 1)[0];
}

function isSyntaxError(error) {
  return error?.name === 'SyntaxError' || /syntax|parse error|unexpected token/i.test(firstLine(error));
}

async function buildPipeline(cwd, options = {}) {
  const prettierDependency = await resolveConsumerDependency('prettier', cwd);
  const officialDependency = await resolveConsumerDependency(OFFICIAL_PLUGIN_NAME, cwd);
  validateVersions(prettierDependency, officialDependency);

  const prettier = prettierDependency.module.default || prettierDependency.module;
  await prettier.clearConfigCache?.();
  const referenceMap = new Map([
    ['prettier', new Set([prettierDependency.module, prettier])],
    [OFFICIAL_PLUGIN_NAME, new Set([officialDependency.module, officialDependency.plugin])],
    [PACKAGE_NAME, new Set([strictPluginModule, strictPlugin])],
  ]);

  return {
    prettier,
    officialPlugin: officialDependency.plugin,
    referenceMap,
    configFile: options.configFile || null,
    versions: {
      prettier: prettierDependency.metadata.version,
      official: officialDependency.metadata.version,
    },
  };
}

async function resolveFileContext(pipeline, filePath, cwd) {
  const resolveOptions = {editorconfig: true};
  if (pipeline.configFile) resolveOptions.config = pipeline.configFile;

  let config;
  try {
    config = (await pipeline.prettier.resolveConfig(filePath, resolveOptions)) || {};
  } catch (error) {
    const label = pipeline.configFile || filePath;
    throw new CliError(`Could not load Prettier config ${label}: ${firstLine(error)}`);
  }

  const configFile = pipeline.configFile || (await pipeline.prettier.resolveConfigFile(filePath));
  const official = officialConfig(config, pipeline.officialPlugin, pipeline.referenceMap);
  const strict = strictConfig(config, configFile, cwd, pipeline.referenceMap);
  return {config, configFile, official, strict};
}

function markPipelineStage(error, stage) {
  if (error && typeof error === 'object') {
    error.strictTailwindPipelineStage = stage;
    return error;
  }

  const wrapped = new Error(String(error));
  wrapped.strictTailwindPipelineStage = stage;
  return wrapped;
}

function isVueContext(filePath, config) {
  return config.parser === 'vue' || path.extname(filePath).toLowerCase() === '.vue';
}

async function formatThroughPipeline(source, filePath, cwd, pipeline, context = null) {
  const resolved = context || (await resolveFileContext(pipeline, filePath, cwd));
  const protection = isVueContext(filePath, resolved.official)
    ? protectVueSelfClosingHtmlForOfficial(source)
    : null;
  let officialOutput;

  try {
    officialOutput = await pipeline.prettier.format(protection?.text || source, {
      ...resolved.official,
      filepath: filePath,
    });
  } catch (error) {
    throw markPipelineStage(error, 'official');
  }

  const restoredOfficialOutput = protection?.restore(officialOutput) || officialOutput;

  try {
    return await pipeline.prettier.format(restoredOfficialOutput, {
      ...resolved.strict,
      filepath: filePath,
    });
  } catch (error) {
    throw markPipelineStage(error, 'strict');
  }
}

async function filterSupportedFiles(records, cwd, pipeline) {
  const ignorePath = path.join(cwd, '.prettierignore');
  const hasIgnore = fsSync.existsSync(ignorePath);
  const supported = [];

  for (const record of records) {
    const context = await resolveFileContext(pipeline, record.path, cwd);
    const info = await pipeline.prettier.getFileInfo(record.path, {
      ignorePath: hasIgnore ? ignorePath : undefined,
      plugins: context.official.plugins,
      resolveConfig: false,
    });

    if (info.ignored) continue;
    if (!info.inferredParser) {
      if (record.explicit) throw new CliError(`No parser could be inferred for file: ${record.path}`);
      continue;
    }

    supported.push({...record, context});
  }

  return supported;
}

async function processFiles(mode, files, cwd, pipeline, output) {
  const different = [];
  let failures = 0;

  for (const file of files) {
    const displayPath = path.relative(cwd, file.path) || path.basename(file.path);
    let source;

    try {
      source = await fs.readFile(file.path, 'utf8');
      const formatted = await formatThroughPipeline(source, file.path, cwd, pipeline, file.context);

      if (formatted === source) continue;
      if (mode === 'check') {
        different.push(displayPath);
      } else {
        await fs.writeFile(file.path, formatted, 'utf8');
        output.log(displayPath);
      }
    } catch (error) {
      failures += 1;
      const category = isSyntaxError(error)
        ? 'syntax'
        : error?.strictTailwindPipelineStage || 'pipeline';
      output.error(`[${category}] ${displayPath}: ${firstLine(error)}`);
    }
  }

  if (mode === 'check' && different.length > 0) {
    output.error('Files require formatting:');
    for (const file of different) output.error(file);
  }

  return failures > 0 ? 2 : different.length > 0 ? 1 : 0;
}

function helpText() {
  return `Usage:\n  strict-tailwind-order --write <files...> [--config <path>]\n  strict-tailwind-order --check <files...> [--config <path>]\n\nOptions:\n  --config <path>       Use an explicit Prettier configuration file\n  --config-path <path>  Alias for --config`;
}

export async function runCli(args, options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const output = options.output || console;

  try {
    const parsed = parseArguments(args);
    if (parsed.help) {
      output.log(helpText());
      return 0;
    }
    if (parsed.version) {
      const metadata = JSON.parse(
        await fs.readFile(new URL('../package.json', import.meta.url), 'utf8'),
      );
      output.log(metadata.version);
      return 0;
    }

    const configFile = await resolveExplicitConfigPath(parsed.configPath, cwd);
    const pipeline = await buildPipeline(cwd, {configFile});
    const records = await discoverFiles(parsed.patterns, cwd);
    const files = await filterSupportedFiles(records, cwd, pipeline);
    return processFiles(parsed.mode, files, cwd, pipeline, output);
  } catch (error) {
    output.error(firstLine(error));
    return error instanceof CliError ? error.exitCode : 2;
  }
}

export {
  buildPipeline,
  discoverFiles,
  formatThroughPipeline,
  officialConfig,
  parseArguments,
  resolveExplicitConfigPath,
  strictConfig,
};
