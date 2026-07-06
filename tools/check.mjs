#!/usr/bin/env node
// Kabacal invariant checker — zero dependencies, runs anywhere node runs.
//
// Usage:
//   node tools/check.mjs          full check (syntax + invariants), exit 2 on failure
//   node tools/check.mjs --hook   PostToolUse hook mode: reads the hook JSON on stdin
//                                 and only checks when index.html was the edited file
//
// This is a tripwire, not a test suite: it catches broken JS and accidental
// edits to production-critical rules (pricing, DXF layers, NC post format).
// Runtime behaviour is verified separately with the /verify-kabacal skill.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'index.html');

// --hook mode: skip silently unless the edited file is index.html
if (process.argv.includes('--hook')) {
  let editedPath = '';
  try {
    const payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
    editedPath = (payload.tool_input && payload.tool_input.file_path) || '';
  } catch { /* no/invalid stdin -> treat as not index.html */ }
  if (!/index\.html$/i.test(editedPath)) process.exit(0);
}

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };

let html = '';
try { html = readFileSync(file, 'utf8'); }
catch (e) { failures.push('cannot read index.html: ' + e.message); }

if (html) {
  // 1. Structure: the app is one self-contained HTML file with ONE inline script
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  must(scripts.length === 1, `expected exactly 1 inline <script>, found ${scripts.length}`);

  // 2. Syntax: every script block must compile
  scripts.forEach((s, i) => {
    try { new Function(s); }
    catch (e) { failures.push(`script #${i + 1} does not compile: ${e.message}`); }
  });

  // 3. Pricing invariants (production rules — see CLAUDE.md "Guarded zones")
  const once = (re, label) => {
    const n = (html.match(re) || []).length;
    must(n === 1, `${label}: expected exactly 1 occurrence, found ${n}`);
  };
  once(/const PRICES=\{/g, 'PRICES table');
  once(/function calcQuote\(/g, 'calcQuote');
  once(/function priceForSheet\(/g, 'priceForSheet');
  once(/function cncForThickness\(/g, 'cncForThickness');
  must(html.includes('vat=Math.round(sub*0.2)'), 'VAT 20% rule missing (vat=Math.round(sub*0.2))');
  must(html.includes("size==='10x4')return 75"), "production price rule missing: MDF 18mm on 10x4 = 75");

  // 4. DXF layer contract (consumed by VCarve gadgets downstream)
  for (const layer of ['OFFCUT', 'OFFCUT_TEXT', 'GROOVE', 'LED_CHANNEL', 'OFFSET_A',
                       'REEDED', 'BEADING', 'PART_NUMBER', 'INSIDE']) {
    must(html.includes(`'${layer}'`), `DXF layer missing from source: ${layer}`);
  }
  once(/const DXF_LAYERS=\{/g, 'DXF_LAYERS table');

  // 5. CNC post invariants (Pegasus/Syntec — validated vs James Template.nc)
  for (const tok of [":1248'", "'G40G17G80G49'", "'G53Z0'", "'M05M30'"]) {
    must(html.includes(tok), `NC post invariant missing: ${tok}`);
  }
  must(html.includes("join('\\r\\n')"), 'NC output must join lines with CRLF');
}

if (failures.length) {
  console.error('KABACAL CHECK FAILED:\n - ' + failures.join('\n - '));
  process.exit(2);
}
console.log('kabacal check ok');
