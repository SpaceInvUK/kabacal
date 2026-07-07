#!/usr/bin/env node
// embed-tooldb.mjs — splice tools/fastcnc-tools.json into index.html between the
// /*TOOLDB_START*/ ... /*TOOLDB_END*/ markers (the TOOL_FACTORY const).
// Run after xlsx2tooldb.mjs whenever the workshop uploads a new tool spreadsheet.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = join(root, 'index.html');
const db = JSON.parse(readFileSync(join(root, 'tools', 'fastcnc-tools.json'), 'utf8'));

// compact but diffable: one tool per line
const toolLines = db.tools.map(t => '  ' + JSON.stringify(t)).join(',\n');
const js = `{ver:${db.ver},source:${JSON.stringify(db.source)},extractedAt:${JSON.stringify(db.extractedAt)},defaultGroup:${JSON.stringify(db.defaultGroup)},\n groups:${JSON.stringify(db.groups)},\n tools:[\n${toolLines}\n ]}`;

const html = readFileSync(htmlPath, 'utf8');
const re = /(\/\*TOOLDB_START\*\/)[\s\S]*?(\/\*TOOLDB_END\*\/)/;
if (!re.test(html)) { console.error('TOOLDB markers not found in index.html'); process.exit(2); }
writeFileSync(htmlPath, html.replace(re, `$1${js}$2`));
console.log(`embedded ${db.tools.length} tools / ${db.groups.length} groups into index.html`);
