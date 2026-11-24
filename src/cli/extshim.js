#!/usr/bin/env node
// ExtShim CLI — run browser extensions in web pages.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { build, writeOutputs, readSource, fmt } from './build.js';
import { compatReport } from './compat.js';
import { parseJSONC } from '../core/util.js';
import { buildRuntime } from '../../scripts/build.mjs';

const HELP = `ExtShim: run WebExtensions in a web page.

Usage:
  extshim build <extension> [options]   Build script, bookmarklets, userscript and install page
  extshim serve <extension> [--port N]  Serve an unpacked extension on a test page
  extshim info  <extension>             List APIs used and page-specific limitations

<extension>: unpacked directory, .zip, .crx or .xpi.

Build options:
  -o, --out <dir>              Output directory (default: ./build/<name>)
  --name <slug>                Output file name prefix
  --host-url <url>             URL of <name>.js; adds a loader bookmarklet
  --no-minify                  Do not minify the runtime
  --no-launcher                Hide the toolbar button
  --position <pos>             Launcher position: bottom-right (default), bottom-left, top-right, top-left
  --content-scripts <mode>     manifest (default) | all (ignore match patterns)
  --storage <backend>          auto (default) | indexedDB | localStorage | memory
  --cors-proxy <url>           Proxy prefix for host_permissions requests; {url} is replaced
  --locale <code>              UI locale, e.g. fr
  --menu-modifier <key>        altKey (default) | shiftKey | ctrlKey | always | none
  --id <id>                    Extension ID (also the storage namespace)
`;

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-o' || a === '--out') o.out = argv[++i];
    else if (a === '-h' || a === '--help') o.help = true;
    else if (a.startsWith('--no-')) o[camel(a.slice(5))] = false;
    else if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      o[camel(k)] = v !== undefined ? v : argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : true;
    } else o._.push(a);
  }
  return o;
}
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

async function cmdBuild(src, o) {
  const t0 = Date.now();
  const r = await build(src, {
    hostUrl: o.hostUrl, minify: o.minify, launcher: o.launcher, position: o.position, contentScripts: o.contentScripts,
    storage: o.storage, corsProxy: o.corsProxy, locale: o.locale, contextMenuModifier: o.menuModifier, id: o.id,
  });
  const name = o.name;
  const out = o.out || path.join('build', name || (await import('../core/util.js')).slugify(r.display.name));
  const { slug, written } = writeOutputs(r, out, { name, hostUrl: o.hostUrl });
  console.log(`\n  ${r.display.name} ${r.manifest.version || ''} (MV${r.manifest.manifest_version === 3 ? 3 : 2}) → ${out}  [${Date.now() - t0} ms]\n`);
  for (const [f, n] of Object.entries(written)) console.log(`    ${f.padEnd(Math.max(36, slug.length + 28))} ${fmt(n).padStart(9)}`);
  console.log(`\n  ${r.units.size} scripts precompiled · API modules: core${r.modules.filter((m) => m !== 'dom-api.js').map((m) => ', ' + m.replace(/(-apis)?\.js$/, '')).join('')} · id ${r.id}`);
  if (r.warnings.length) {
    console.log('\n  Limitations:');
    for (const w of r.warnings) console.log('   - ' + w);
  }
  console.log(`\n  Install page: ${path.join(out, 'index.html')}\n`);
}

async function cmdInfo(src) {
  const files = await readSource(src);
  const m = parseJSONC(new TextDecoder().decode(files.get('manifest.json')));
  const rep = compatReport(m, files);
  console.log(`${m.name} ${m.version || ''} (MV${m.manifest_version})`);
  console.log(`APIs used: ${rep.used.join(', ') || '(none)'}`);
  if (rep.warnings.length) { console.log('\nLimitations:'); rep.warnings.forEach((w) => console.log(' - ' + w)); } else console.log('\nNo page-specific limitations.');
}

async function cmdServe(src, o) {
  const port = +(o.port || 8080);
  const abs = path.resolve(src);
  const isDir = fs.statSync(abs).isDirectory();
  const types = { html: 'text/html', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', svg: 'image/svg+xml', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', woff2: 'font/woff2', zip: 'application/zip', crx: 'application/x-chrome-extension' };
  const page = (extUrl) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ExtShim dev page</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px}code{background:#8882;padding:1px 5px;border-radius:4px}</style>
<script src="/__extshim/extshim.js"></script></head><body>
<h1>ExtShim dev page</h1><p>Serving <code>${src}</code>. Reload after editing files.</p>
<p>The quick brown fox jumps over the lazy dog.</p>
<p><a href="https://example.com/">example.com link</a> <input placeholder="input"> <textarea placeholder="textarea"></textarea></p>
<script>ExtShim.load(${JSON.stringify(extUrl)}, { contentScripts: new URLSearchParams(location.search).get('cs') || 'all', log: 'debug' }).then(function (e) { window.ext = e; });</script>
</body></html>`;
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    try {
      if (u.pathname === '/__extshim/extshim.js') {
        res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
        res.end(await buildRuntime({ minify: false, write: false }));
        return;
      }
      if (u.pathname === '/' || u.pathname === '/index.html') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(page(isDir ? '/ext/' : '/ext/' + path.basename(abs)));
        return;
      }
      if (u.pathname.startsWith('/ext/')) {
        const rel = decodeURIComponent(u.pathname.slice(5));
        const file = isDir ? path.join(abs, rel) : rel === path.basename(abs) ? abs : null;
        if (!file || !file.startsWith(isDir ? abs : path.dirname(abs)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'content-type': types[path.extname(file).slice(1)] || 'application/octet-stream', 'cache-control': 'no-store' });
        fs.createReadStream(file).pipe(res);
        return;
      }
      res.writeHead(404); res.end('not found');
    } catch (e) { res.writeHead(500); res.end(String(e && e.stack)); }
  });
  server.listen(port, () => console.log(`http://localhost:${port}/  (?cs=manifest applies match patterns)`));
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const [cmd, src] = o._;
  if (o.help || !cmd || !src) { console.log(HELP); process.exit(cmd ? 0 : 1); }
  if (!fs.existsSync(src)) { console.error(`Not found: ${src}`); process.exit(1); }
  if (cmd === 'build') await cmdBuild(src, o);
  else if (cmd === 'info') await cmdInfo(src);
  else if (cmd === 'serve') await cmdServe(src, o);
  else { console.log(HELP); process.exit(1); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
}
