import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import prettier from 'prettier';
import * as plugin from '../index.mjs';

async function walk(directory) {
  const output = [];
  for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
    if (['node_modules', 'dist', '.git', '.idea'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(full)));
    else if (entry.isFile() && entry.name.endsWith('.vue')) output.push(full);
  }
  return output;
}

const projects = process.argv.slice(2);
for (const project of projects) {
  const files = await walk(project);
  const previous = process.cwd();
  process.chdir(project);
  let changed = 0;
  let failures = 0;
  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    try {
      const first = await prettier.format(source, {
        filepath: file,
        plugins: [plugin],
        semi: true,
        singleQuote: true,
        bracketSpacing: false,
        bracketSameLine: false,
        singleAttributePerLine: false,
        htmlWhitespaceSensitivity: 'css',
        printWidth: 120,
        tabWidth: 2,
      });
      const second = await prettier.format(first, {
        filepath: file,
        plugins: [plugin],
        semi: true,
        singleQuote: true,
        bracketSpacing: false,
        bracketSameLine: false,
        singleAttributePerLine: false,
        htmlWhitespaceSensitivity: 'css',
        printWidth: 120,
        tabWidth: 2,
      });
      if (first !== second) {
        console.error('NOT IDEMPOTENT', file);
        failures += 1;
      }
      if (source !== first) changed += 1;
    } catch (error) {
      console.error('FAILED', file, error.stack || error);
      failures += 1;
    }
  }
  process.chdir(previous);
  console.log(JSON.stringify({project, files: files.length, changed, failures}));
  if (failures) process.exitCode = 1;
}
