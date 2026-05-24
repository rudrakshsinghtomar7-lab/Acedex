#!/usr/bin/env node
// © 2026 Rudraksh Singh Tomar. All rights reserved.
//
// Idempotent — prepends a single-line copyright header to every
// .js / .jsx / .css file under src/. Files that already start with
// the header (within the first ~80 chars) are skipped, so this can
// run safely on every new file without doubling up. Re-run any time
// after adding files: `node scripts/add-copyright.mjs`.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC  = path.join(root, 'src');

const OWNER = '© 2026 Rudraksh Singh Tomar. All rights reserved.';
const JS_HEADER  = `// ${OWNER}\n`;
const CSS_HEADER = `/* ${OWNER} */\n`;
const MARKER     = '© 2026 Rudraksh Singh Tomar';

const EXT_HEADER = {
  '.js':  JS_HEADER,
  '.jsx': JS_HEADER,
  '.css': CSS_HEADER,
};

async function walk(dir) {
  const out = [];
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

const files = (await walk(SRC)).filter(p => EXT_HEADER[path.extname(p)]);
let touched = 0, skipped = 0;

for (const f of files) {
  const cur = await fs.readFile(f, 'utf8');
  // Skip if marker is anywhere in the first 200 chars (any line/format).
  if (cur.slice(0, 200).includes(MARKER)) { skipped++; continue; }
  await fs.writeFile(f, EXT_HEADER[path.extname(f)] + cur);
  touched++;
}

console.log(`copyright: touched ${touched} file(s), skipped ${skipped} already-headed`);
