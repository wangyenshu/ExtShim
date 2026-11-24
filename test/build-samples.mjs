// Build every extension in a chrome-extensions-samples checkout; writes index.json.
import fs from 'node:fs';
import path from 'node:path';
import { build } from '../src/cli/build.js';
import { buildRuntime } from '../scripts/build.mjs';
import { slugify } from '../src/core/util.js';

const [root, out] = process.argv.slice(2);
const dirs = [];
const walk = (d, depth) => {
  if (depth > 4) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (fs.existsSync(path.join(p, 'manifest.json'))) dirs.push(p); else walk(p, depth + 1);
  }
};
for (const sub of ['api-samples', 'functional-samples']) if (fs.existsSync(path.join(root, sub))) walk(path.join(root, sub), 0);
fs.mkdirSync(out, { recursive: true });
const runtime = await buildRuntime({ minify: true, write: false });
const index = [];
let ok = 0;
const failed = [];
const skippedBuild = [];
for (const d of dirs) {
  const rel = path.relative(root, d);
  const slug = slugify(rel);
  try {
    const m = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8').replace(/^\s*\/\/.*$/mg, ''));
    const bg = m.background && (m.background.service_worker || (m.background.scripts || [])[0]);
    if ((bg && !fs.existsSync(path.join(d, bg))) || (fs.existsSync(path.join(d, 'package.json')) && !fs.existsSync(path.join(d, 'node_modules')) && /"(build|dependencies)"/.test(fs.readFileSync(path.join(d, 'package.json'), 'utf8')))) {
      index.push({ dir: rel, slug, ok: false, error: 'needs an npm build step' });
      skippedBuild.push(rel);
      continue;
    }
    const r = await build(d, { runtime });
    fs.writeFileSync(path.join(out, slug + '.js'), r.outputs.bundle);
    index.push({ dir: rel, slug, ok: true, units: r.units.size, warnings: r.warnings.length, unsupported: r.report.unsupported });
    ok++;
  } catch (e) {
    index.push({ dir: rel, slug, ok: false, error: e.message });
    failed.push(`${rel}: ${e.message.split('\n')[0]}`);
  }
}
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index, null, 1));
console.log(`built ${ok}/${dirs.length - skippedBuild.length} samples (${skippedBuild.length} skipped: they need npm install/build first)`);
for (const f of failed) console.log('  build failed: ' + f);
