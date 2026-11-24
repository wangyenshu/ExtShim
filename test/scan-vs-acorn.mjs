import fs from 'node:fs';
import path from 'node:path';
import { scanTopLevelDeclarations } from '../src/core/scan.js';
import { analyzeWithAcorn } from '../src/cli/analyze.js';

const roots = process.argv.slice(2);
let files = [];
function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.js$/.test(e.name)) files.push(p); } }
roots.forEach(walk);
let ok = 0, mismatch = 0, skipped = 0; const bad = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let ref;
  try { ref = analyzeWithAcorn(src, { nested: false }); } catch { skipped++; continue; }
  const got = new Set(scanTopLevelDeclarations(src).names);
  const exp = new Set(ref.names);
  const missing = [...exp].filter((x) => !got.has(x));
  const extra = [...got].filter((x) => !exp.has(x));
  if (missing.length || extra.length) { mismatch++; bad.push({ f, missing: missing.slice(0, 5), extra: extra.slice(0, 5) }); } else ok++;
}
console.log({ total: files.length, ok, mismatch, skipped });
for (const b of bad.slice(0, 15)) console.log(b);
