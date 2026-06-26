import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import prettier from 'prettier';
import * as plugin from '../index.mjs';

const baseOptions = {
  plugins: [plugin],
  semi: true,
  singleQuote: true,
  bracketSpacing: false,
  printWidth: 120,
};

async function format(code, filepath, extra = {}) {
  return prettier.format(code, {...baseOptions, filepath, ...extra});
}

test('sorts Vue static class attributes with the strict order', async () => {
  const output = await format(
    '<template><div class="mt-8 bg-white flex h-full text-center md:mt-0 w-full items-center"></div></template>',
    '/tmp/project/src/App.vue',
  );

  assert.match(output, /class="h-full w-full flex items-center text-center bg-white mt-8 md:mt-0"/);
});

test('wraps long Vue class attributes without splitting class families', async () => {
  const output = await format(
    '<template><button type="button" class="relative flex h-10 w-full cursor-pointer appearance-none items-center justify-between gap-3 bg-[#D9D9D9] px-4 text-start text-[0.9875rem]/[1] font-light text-[#1C1C1C] transition-colors duration-300 outline-none focus:ring-0 focus:outline-none">X</button></template>',
    '/tmp/project/src/App.vue',
  );

  assert.match(
    output,
    /class="\n\s+relative h-10 w-full flex items-center justify-between gap-3 text-\[0\.9875rem\]\/\[1\] text-start\n\s+font-light text-\[#1C1C1C\] bg-\[#D9D9D9\] outline-none focus:outline-none focus:ring-0\n\s+transition-colors duration-300 appearance-none cursor-pointer px-4\n\s+"/,
  );
});

test('sorts strings inside Vue dynamic class bindings', async () => {
  const output = await format(
    `<template><div :class="['mt-4 flex items-center', active && 'text-white bg-black', { 'md:px-8 px-4 mb-2': wide }]" /></template>`,
    '/tmp/project/src/App.vue',
  );

  assert.match(output, /\['flex items-center mt-4', active && 'text-white bg-black', \{'px-4 md:px-8 mb-2': wide\}\]/);
});

test('sorts class helper function arguments', async () => {
  const output = await format(
    `const value = cn('mt-4 flex items-center', active && 'text-white bg-black')`,
    '/tmp/project/src/classes.ts',
  );

  assert.equal(output, `const value = cn('flex items-center mt-4', active && 'text-white bg-black');\n`);
});

test('sorts and wraps JSX className attributes', async () => {
  const output = await format(
    `const A = () => <div className="relative flex h-10 w-full cursor-pointer appearance-none items-center justify-between gap-3 bg-[#D9D9D9] px-4 text-start text-[0.9875rem]/[1] font-light text-[#1C1C1C] transition-colors duration-300 outline-none focus:ring-0 focus:outline-none">X</div>`,
    '/tmp/project/src/A.tsx',
  );

  assert.match(output, /className="\n\s+relative h-10 w-full flex items-center justify-between/);
  assert.match(output, /transition-colors duration-300 appearance-none cursor-pointer px-4/);
});

test('auto-detects the current page stylesheet and its custom breakpoint', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'prettier-strict-tailwind-'));
  const previousCwd = process.cwd();
  const component = path.join(directory, 'pages/01/src/components/App.vue');
  const stylesheet = path.join(directory, 'pages/01/src/main.css');

  fs.mkdirSync(path.dirname(component), {recursive: true});
  fs.writeFileSync(path.join(directory, 'package.json'), '{}');
  fs.writeFileSync(stylesheet, '@theme { --breakpoint-3xl: 120rem; }');
  fs.writeFileSync(component, '<template />');

  try {
    process.chdir(directory);
    const output = await format(
      '<template><div class="3xl:items-center flex items-start"></div></template>',
      component,
    );
    assert.match(output, /class="flex items-start 3xl:items-center"/);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(directory, {recursive: true, force: true});
  }
});

test('is idempotent', async () => {
  const filepath = '/tmp/project/src/App.vue';
  const input = '<template><div class="md:px-8 px-4 mb-2 flex items-center"></div></template>';
  const first = await format(input, filepath);
  const second = await format(first, filepath);
  assert.equal(second, first);
});

test('formats multiple self-closing regular Vue elements and preserves their structure', async () => {
  const input = `<template>
  <section>
    <p class="mb-4 px-2 md:mb-8 md:px-4" v-text="price" />
    <p
      v-if="visible"
      class="mt-3 flex items-center"
      :class="['mb-4 px-2', active && 'md:mb-8 md:px-4']"
      v-text="'&#8362'"
    />
    <span v-for="item in items" :key="item.id" v-bind:class="{'mb-4 px-2': item.active}" />
  </section>
</template>`;
  const filepath = '/tmp/project/src/Price.vue';
  const first = await format(input, filepath);
  const second = await format(first, filepath);

  assert.equal(second, first);
  assert.match(first, /<p class="px-2 md:px-4 mb-4 md:mb-8" v-text="price" \/>/);
  assert.match(first, /class="flex items-center mt-3"/);
  assert.match(first, /\['px-2 mb-4', active && 'md:px-4 md:mb-8'\]/);
  assert.match(first, /v-text="'&#8362'"/);
  assert.match(first, /<span[\s\S]*v-bind:class="\{'px-2 mb-4': item\.active\}"[\s\S]*\/>/);
});

test('preserves components, void elements, closed elements, comments, script strings, and styles', async () => {
  const input = `<template>
  <!-- <p class="mb-4 px-2" /> -->
  <Card class="mb-4 px-2" />
  <img class="mb-4 px-2" src="/x.jpg" />
  <p class="mb-4 px-2">Text</p>
  <div class="mb-4 px-2" />
  <span class="mt-4 flex" />
</template>

<script>
const html = '<p class="mb-4 px-2" />';
</script>

<style>
.example::before { content: '<p class="mb-4 px-2" />'; }
</style>`;
  const filepath = '/tmp/project/src/Preservation.vue';
  const first = await format(input, filepath);
  const second = await format(first, filepath);

  assert.equal(second, first);
  assert.match(first, /<!-- <p class="mb-4 px-2" \/> -->/);
  assert.match(first, /<Card class="px-2 mb-4" \/>/);
  assert.match(first, /<img class="px-2 mb-4" src="\/x\.jpg" \/>/);
  assert.match(first, /<p class="px-2 mb-4">Text<\/p>/);
  assert.match(first, /<div class="px-2 mb-4" \/>/);
  assert.match(first, /<span class="flex mt-4" \/>/);
  assert.match(first, /const html = '<p class="mb-4 px-2" \/>';/);
  assert.match(first, /content: '<p class="mb-4 px-2" \/>';/);
});

test('uses custom breakpoints from an auto-detected sibling stylesheet directory', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'prettier-strict-tailwind-siblings-'));
  const previousCwd = process.cwd();
  const component = path.join(directory, 'dev/src/js/Components/App.vue');
  const stylesheet = path.join(directory, 'dev/src/css/app.css');

  fs.mkdirSync(path.dirname(component), {recursive: true});
  fs.mkdirSync(path.dirname(stylesheet), {recursive: true});
  fs.writeFileSync(path.join(directory, 'dev/package.json'), '{}');
  fs.writeFileSync(stylesheet, '@theme { --breakpoint-3xl: 120rem; }');
  fs.writeFileSync(component, '<template />');

  try {
    process.chdir(path.join(directory, 'dev'));
    const output = await format('<template><div class="3xl:flex mt-4 bg-white flex"></div></template>', component);
    assert.match(output, /class="flex 3xl:flex bg-white mt-4"/);
  } finally {
    process.chdir(previousCwd);
    fs.rmSync(directory, {recursive: true, force: true});
  }
});
