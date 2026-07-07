#!/usr/bin/env node
// xlsx2tooldb.mjs — convert a FASTCNCTOOLS vtdb-extract .xlsx into Kabacal's tool database JSON.
//
// Usage:  node tools/xlsx2tooldb.mjs <FASTCNCTOOLS_extracted.xlsx> [out.json]
//         (default out: tools/fastcnc-tools.json)
//
// Reads the "Effective Tools" sheet (the merged material+machine rows produced by the
// vtdb extractor). Zero dependencies — parses the xlsx zip + XML with node stdlib.
//
// Import rules (agreed 2026-07-07):
//   - Material / Machine columns are IGNORED (no MDF/hardwood categories in Kabacal).
//   - Group = last segment of "Group Path" ("FAST CNC TOOLS / STANDARD TOOLS" -> "Standard Tools",
//     root rows -> "Fast CNC Tools"). Group order: Standard Tools first, then by first appearance.
//   - Feeds normalised to mm/min: rows whose Feed Units say m/min are multiplied by 1000.
//   - Tool # comes from the "Tool #" column (the machine/ATC number used for T{n}/H{n} in NC).
//   - Stable ids derived from the Vectric Geometry ID (v+first 8 hex chars) so re-imports
//     update in place. Exceptions: "(1) 6mm CUTTER" (num 1) keeps id "t1" and the 90° 38.3mm
//     V-Bit keeps id "t6" — saved jobs and the golden recipe reference those ids.
//   - SAFETY: t1 passDepth is pinned to 6 (the machine reference job cuts 18mm in 3x6mm
//     passes; the vtdb stores 25 which would mean full-depth single-pass). The vtdb value is
//     kept in `passDepthDb` so the user can adopt it deliberately in the UI.

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const [,, xlsxPath, outPath = new URL('./fastcnc-tools.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')] = process.argv;
if (!xlsxPath) { console.error('usage: node tools/xlsx2tooldb.mjs <extracted.xlsx> [out.json]'); process.exit(1); }

// --- minimal zip reader (stored + deflate entries) ---
function zipEntries(buf) {
  const out = {};
  let p = buf.length - 22;                                   // find EOCD (no zip comment expected)
  while (p >= 0 && buf.readUInt32LE(p) !== 0x06054b50) p--;
  if (p < 0) throw new Error('not a zip');
  let n = buf.readUInt16LE(p + 10), off = buf.readUInt32LE(p + 16);
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('bad central dir');
    const method = buf.readUInt16LE(off + 10), csize = buf.readUInt32LE(off + 20),
          nameLen = buf.readUInt16LE(off + 28), extraLen = buf.readUInt16LE(off + 30),
          cmtLen = buf.readUInt16LE(off + 32), lho = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    const lhExtra = buf.readUInt16LE(lho + 28), lhName = buf.readUInt16LE(lho + 26);
    const dataOff = lho + 30 + lhName + lhExtra;
    const raw = buf.subarray(dataOff, dataOff + csize);
    out[name] = () => method === 8 ? inflateRawSync(raw) : Buffer.from(raw);
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

// --- minimal xlsx sheet reader ---
const dec = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
function sharedStrings(z) {
  if (!z['xl/sharedStrings.xml']) return [];
  const xml = z['xl/sharedStrings.xml']().toString('utf8');
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => dec(t[1])).join(''));
}
function sheetRows(z, file, ss) {
  const xml = z[file]().toString('utf8'), rows = [];
  for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    // cells are either self-closing (empty, styled) or paired with a <v> value — handle both explicitly
    for (const cm of rm[1].matchAll(/<c ([^>]*?)\/>|<c ([^>]*?)>([\s\S]*?)<\/c>/g)) {
      const attrs = cm[1] || cm[2] || '', inner = cm[3] || '';
      const rr = /r="([A-Z]+)\d+"/.exec(attrs); if (!rr) continue;
      const col = rr[1].split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const vm = /<v>([\s\S]*?)<\/v>/.exec(inner); if (!vm) continue;
      const t = /t="([^"]*)"/.exec(attrs);
      cells[col] = (t && t[1] === 's') ? ss[+vm[1]] : dec(vm[1]);
    }
    if (Object.keys(cells).length) rows.push(cells);
  }
  return rows;
}

const z = zipEntries(readFileSync(xlsxPath));
const wb = z['xl/workbook.xml']().toString('utf8');
const names = [...wb.matchAll(/<sheet name="([^"]*)"/g)].map(m => dec(m[1]));
const effIdx = names.findIndex(n => /effective tools/i.test(n));
if (effIdx < 0) { console.error('No "Effective Tools" sheet found. Sheets: ' + names.join(', ')); process.exit(1); }
const rows = sheetRows(z, `xl/worksheets/sheet${effIdx + 1}.xml`, sharedStrings(z));

const hdr = rows[0], H = {};
Object.entries(hdr).forEach(([i, name]) => H[String(name).trim().toLowerCase()] = +i);
const col = (r, name) => { const i = H[name]; return i == null ? undefined : r[i]; };
const num = v => { const x = parseFloat(v); return isNaN(x) ? null : Math.round(x * 1000) / 1000; };

const TYPE = { 'end mill': 'endmill', 'ball nose': 'ballnose', 'v-bit': 'vbit', 'drill': 'drill', 'form tool': 'form' };
function groupName(path) {
  const last = String(path || '').split('/').map(s => s.trim()).filter(Boolean).pop() || 'Tools';
  return last.toUpperCase() === 'FAST CNC TOOLS' ? 'Fast CNC Tools'
       : last.replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}
// tool number embedded in the name "(1) 6mm CUTTER" wins agreement checks; the Tool # column is the machine number
const tools = [], groupsSeen = [];
for (const r of rows.slice(1)) {
  const name = String(col(r, 'tool name') || '').replace(/�/g, '°').trim();
  if (!name) continue;
  const grp = groupName(col(r, 'group path'));
  if (!groupsSeen.includes(grp)) groupsSeen.push(grp);
  const units = String(col(r, 'feed units') || '').trim().toLowerCase();
  const k = units === 'm/min' ? 1000 : 1;                    // normalise to mm/min
  let feed = num(col(r, 'feed rate')), plunge = num(col(r, 'plunge'));
  if (feed != null) feed = Math.round(feed * k);
  if (plunge != null) plunge = Math.round(plunge * k);
  const gid = String(col(r, 'geometry id') || '').replace(/-/g, '');
  tools.push({
    id: 'v' + (gid.slice(0, 8) || Math.random().toString(36).slice(2, 10)),
    grp,
    name,
    num: Math.max(1, Math.round(num(col(r, 'tool #')) || 1)),
    type: TYPE[String(col(r, 'tool type') || '').trim().toLowerCase()] || 'endmill',
    dia: num(col(r, 'diameter (d)')),
    angle: num(col(r, 'angle')),
    flutes: num(col(r, 'flutes')),
    passDepth: num(col(r, 'pass depth')),
    stepover: num(col(r, 'stepover')),
    stepoverPct: (v => v == null ? null : Math.round(v * 1000) / 10)(num(col(r, 'stepover %'))),
    rpm: num(col(r, 'spindle')),
    feed, plunge
  });
}
// stable legacy ids (golden recipe + saved jobs) + the t1 pass-depth safety pin
for (const t of tools) {
  if (t.grp === 'Standard Tools' && t.num === 1 && /6mm/i.test(t.name) && t.dia === 6) {
    t.id = 't1';
    if (t.passDepth !== 6) { t.passDepthDb = t.passDepth; t.passDepth = 6; }   // proven 3x6mm on the machine reference job
  }
  if (t.grp === 'Standard Tools' && t.num === 6 && t.type === 'vbit') t.id = 't6';
}
// group order: Standard Tools first
const groups = ['Standard Tools', ...groupsSeen.filter(g => g !== 'Standard Tools')];

const db = {
  ver: 2,
  source: xlsxPath.split(/[\\/]/).pop(),
  extractedAt: new Date().toISOString().slice(0, 10),
  defaultGroup: 'Standard Tools',
  groups,
  tools
};
writeFileSync(outPath, JSON.stringify(db, null, 1));
console.log(`wrote ${outPath}: ${tools.length} tools in ${groups.length} groups`);
console.log('groups:', groups.map(g => `${g} (${tools.filter(t => t.grp === g).length})`).join(' · '));
const std = tools.filter(t => t.grp === 'Standard Tools');
console.log('Standard Tools:'); std.forEach(t => console.log(`  T${t.num}  ${t.name}  Ø${t.dia}  F${t.feed ?? '-'}/P${t.plunge ?? '-'}  S${t.rpm ?? '-'}  pass ${t.passDepth ?? '-'}${t.passDepthDb ? ' (db:' + t.passDepthDb + ')' : ''}  [${t.id}]`));
