// Build an extension (folder / .zip / .crx / .xpi) into web-page-runnable artifacts.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import * as esbuild from 'esbuild';
import { readZip, rootFiles } from '../core/zip.js';
import { computeExtensionId, normalizePath, parseJSONC, slugify, bytesToBase64, mimeType } from '../core/util.js';
import { getBackground, htmlScriptRefs, pickIcon, getAction, localizeManifest, formatMessage, mergeMessages, localeCandidates } from '../core/manifest.js';
import {
  bundleBootSource, compressedBookmarklet, loaderBookmarklet, toBookmarklet, userscriptHeader, USERSCRIPT_HOST, wrapClassicScript,
} from '../core/bundle.js';
import { analyzeWithAcorn, isClassicScript } from './analyze.js';
import { buildRuntime } from '../../scripts/build.mjs';
import { compatReport } from './compat.js';
import { modulesFor } from '../runtime/api/modules.js';

const CORE_NAMESPACES = ['runtime', 'extension', 'i18n', 'storage', 'tabs', 'windows', 'permissions', 'management', 'commands', 'action', 'browserAction',
  'pageAction', 'contextMenus', 'menus', 'alarms', 'notifications', 'scripting', 'offscreen', 'sidePanel', 'sidebarAction', 'downloads', 'idle', 'tts',
  'webNavigation', 'omnibox', 'dom', 'extensionTypes'];

/** Top-level namespaces an extension can reach (used to drop unused enum tables). */
export function namespacesFor(manifest) {
  const out = new Set(CORE_NAMESPACES);
  for (const p of [...(manifest.permissions || []), ...(manifest.optional_permissions || [])]) {
    if (typeof p !== 'string') continue;
    out.add(p.split('.')[0]);
    if (/^declarativeNetRequest/.test(p)) out.add('declarativeNetRequest');
    if (/^webRequest/.test(p)) out.add('webRequest');
    if (p === 'gcm') out.add('instanceID');
    if (p === 'ttsEngine') out.add('tts');
  }
  if (manifest.devtools_page) out.add('devtools');
  if (manifest.tts_engine) out.add('ttsEngine');
  return [...out];
}

const SKIP_DIRS = new Set(['.git', '.github', '.svn', '.hg', '__MACOSX', '.idea', '.vscode']);

export async function readSource(src) {
  const stat = fs.statSync(src);
  let files = new Map();
  if (stat.isDirectory()) {
    const walk = (dir, rel) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === '.DS_Store' || e.name === 'Thumbs.db') continue;
        const abs = path.join(dir, e.name);
        const r = rel ? rel + '/' + e.name : e.name;
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(abs, r); } else if (e.isFile()) files.set(r, new Uint8Array(fs.readFileSync(abs)));
      }
    };
    walk(src, '');
  } else {
    files = await readZip(new Uint8Array(fs.readFileSync(src)), { inflateRaw: (d) => zlib.inflateRawSync(d) });
  }
  return rootFiles(files);
}

const text = (b) => new TextDecoder().decode(b);

/** Bundle an ES module entry (and its imports) into a classic script. */
async function bundleModule(files, entry, virtualBase) {
  const plugin = {
    name: 'extshim-vfs',
    setup(b) {
      b.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind === 'entry-point') return { path: entry, namespace: 'ext' };
        if (/^[a-z][a-z0-9+.-]*:/i.test(args.path)) return { path: args.path, external: true };
        const from = args.importer || '';
        const p = normalizePath(args.path, args.path.startsWith('/') ? '' : from);
        if (!files.has(p)) return { errors: [{ text: `Cannot resolve "${args.path}" from ${from || 'entry'} (only files inside the extension can be imported)` }] };
        return { path: p, namespace: 'ext' };
      });
      b.onLoad({ filter: /.*/, namespace: 'ext' }, (args) => {
        const ext = path.extname(args.path).slice(1).toLowerCase();
        const loader = { js: 'js', mjs: 'js', cjs: 'js', json: 'json', css: 'text', txt: 'text', html: 'text', svg: 'text', wasm: 'binary' }[ext] || 'binary';
        let contents = files.get(args.path);
        if (loader === 'js') contents = text(contents).replace(/\bimport\.meta\.url\b/g, JSON.stringify(virtualBase + args.path));
        return { contents, loader };
      });
    },
  };
  const common = { entryPoints: [entry], bundle: true, write: false, plugins: [plugin], platform: 'browser', target: 'es2022', logLevel: 'silent', legalComments: 'none' };
  try {
    const r = await esbuild.build({ ...common, format: 'iife' });
    return r.outputFiles[0].text;
  } catch (e) {
    if (!/top-level await/i.test(String(e.message))) throw e;
    // Top-level await: bundle as ESM (no imports remain) and run it inside an async function.
    const r = await esbuild.build({ ...common, format: 'esm' });
    const code = r.outputFiles[0].text.replace(/^export\s*\{[^}]*\};?\s*$/m, '');
    return `(async()=>{\n${code}\n})().catch(function(e){console.error(e)});`;
  }
}

/**
 * @param {string} src path to an extension folder, .zip, .crx or .xpi
 * @param {object} o
 */
export async function build(src, o = {}) {
  const files = o.files || (await readSource(src));
  const mtext = files.get('manifest.json');
  if (!mtext) throw new Error('manifest.json not found in ' + src);
  const manifest = parseJSONC(text(mtext));
  const id = o.id || computeExtensionId(manifest);
  const virtualBase = `chrome-extension://${id}/`;
  const warnings = [];

  // Which scripts are ES modules?
  const moduleEntries = new Set();
  const bg = getBackground(manifest);
  if (bg && bg.module && bg.files) bg.files.forEach((f) => moduleEntries.add(f));
  for (const [p, data] of files) {
    if (!/\.html?$/i.test(p)) continue;
    for (const r of htmlScriptRefs(text(data), p)) if (r.module) moduleEntries.add(r.path);
  }

  const units = new Map();
  for (const [p, data] of files) {
    if (!/\.(m?js|cjs)$/i.test(p)) continue;
    const code = text(data);
    const classic = isClassicScript(code);
    if (moduleEntries.has(p)) {
      try {
        units.set('module:' + p, wrapClassicScript(await bundleModule(files, p, virtualBase), []));
      } catch (e) {
        const detail = e.errors && e.errors[0] ? e.errors[0].text : String(e.message).split('\n')[0];
        warnings.push(`Could not bundle ES module ${p}: ${detail}`);
      }
    }
    if (classic) units.set(p, wrapClassicScript(code, analyzeWithAcorn(code).names));
    else if (!moduleEntries.has(p) && !/\b(import|export)\b/.test(code)) warnings.push(`${p} has a syntax error and will not run.`);
  }
  for (const [k, srcText] of units) {
    try { new vm.Script('(' + srcText + ')', { filename: k }); } catch (e) {
      warnings.push(`Wrapping ${k} failed (${e.message}); it will be skipped.`);
      units.delete(k);
    }
  }

  const options = {};
  if (o.launcher === false) options.ui = { launcher: false };
  if (o.position) options.ui = { ...(options.ui || {}), position: o.position };
  if (o.contentScripts) options.contentScripts = o.contentScripts;
  if (o.storage) options.storage = o.storage;
  if (o.corsProxy) options.corsProxy = o.corsProxy;
  if (o.locale) options.locale = o.locale;
  if (o.contextMenuModifier) options.contextMenuModifier = o.contextMenuModifier;
  if (o.log) options.log = o.log;

  const modules = modulesFor(manifest);
  const runtime = o.runtime || (await buildRuntime({ minify: o.minify !== false, write: false, modules, namespaces: namespacesFor(manifest) }));
  const boot = bundleBootSource({ id, manifest, files, units, options });
  const bundle = runtime + '\n' + boot;
  new vm.Script(bundle, { filename: 'bundle.js' });

  const usBoot = bundleBootSource({ id, manifest, files, units, options, host: USERSCRIPT_HOST });
  const userscript = userscriptHeader(localizedManifest(manifest, files, o.locale)) + '(function(){\n' + runtime + '\n' + usBoot + '})();\n';

  // Localized copy of the manifest for names shown by the CLI, install page and userscript header.
  const display = localizedManifest(manifest, files, o.locale);
  const report = compatReport(manifest, files);
  warnings.push(...report.warnings);
  return {
    id, manifest, display, files, units, warnings, report, modules,
    outputs: {
      bundle,
      userscript,
      bookmarklet: toBookmarklet(bundle),
      compressed: compressedBookmarklet(new Uint8Array(zlib.deflateRawSync(Buffer.from(bundle), { level: 9 }))),
      loader: o.hostUrl ? loaderBookmarklet(o.hostUrl) : null,
    },
  };
}

export function localizedManifest(manifest, files, locale) {
  if (!manifest.default_locale) return manifest;
  const msgs = [];
  for (const l of localeCandidates(locale ? [locale] : ['en'], manifest.default_locale)) {
    const f = files.get(`_locales/${l}/messages.json`);
    if (f) { try { msgs.push(parseJSONC(text(f))); } catch { /* ignore */ } }
  }
  const merged = mergeMessages(msgs);
  return localizeManifest(manifest, (n) => formatMessage(merged, n, [], {}));
}

function fmt(n) { return n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' KB'; }

export function writeOutputs(result, outDir, o = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const slug = o.name || slugify(result.display.name);
  const out = result.outputs;
  const written = {};
  const put = (name, content) => { fs.writeFileSync(path.join(outDir, name), content); written[name] = content.length; };
  put(`${slug}.js`, out.bundle);
  put(`${slug}.user.js`, out.userscript);
  put(`${slug}.bookmarklet.txt`, out.bookmarklet);
  put(`${slug}.bookmarklet-compressed.txt`, out.compressed);
  if (out.loader) put(`${slug}.bookmarklet-loader.txt`, out.loader);
  put('index.html', installPage(result, slug, o));
  return { slug, written };
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function installPage(result, slug, o) {
  const m = result.display;
  const name = m.name || slug;
  const iconPath = pickIcon(getAction(m).icon, 128) || pickIcon(m.icons, 128);
  const iconData = iconPath && result.files.get(iconPath) ? `data:${mimeType(iconPath)};base64,${bytesToBase64(result.files.get(iconPath))}` : '';
  const out = result.outputs;
  const big = out.bookmarklet.length > 60000;
  const warn = result.warnings.map((w) => `<li>${esc(w)}</li>`).join('');
  const hostUrl = o.hostUrl ? esc(o.hostUrl) : '';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)}</title>
<style>
:root{color-scheme:light dark;--fg:#1d1d1f;--mut:#6b6b70;--bd:#e3e3e8;--card:#fafafb;--acc:#1a73e8}
@media (prefers-color-scheme:dark){:root{--fg:#ececf0;--mut:#9d9da6;--bd:#33343a;--card:#1c1d21;--acc:#8ab4f8}}
body{font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--fg);max-width:860px;margin:0 auto;padding:40px 24px 80px}
header{display:flex;gap:18px;align-items:center;margin-bottom:28px}header img{width:64px;height:64px;border-radius:14px}
h1{font-size:26px;margin:0}h2{font-size:17px;margin:32px 0 8px}.mut{color:var(--mut)}
.card{border:1px solid var(--bd);background:var(--card);border-radius:12px;padding:16px 18px;margin:12px 0}
.bm{display:inline-block;padding:9px 16px;border-radius:9px;background:var(--acc);color:#fff;font-weight:600;text-decoration:none;cursor:grab;margin:4px 8px 4px 0}
.bm.alt{background:transparent;color:var(--acc);border:1px solid var(--acc)}
code,pre{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}pre{background:var(--card);border:1px solid var(--bd);border-radius:9px;padding:12px;overflow:auto;white-space:pre-wrap;word-break:break-all}
button{font:inherit;padding:8px 14px;border-radius:9px;border:1px solid var(--bd);background:var(--card);color:var(--fg);cursor:pointer}
.warn li{margin:3px 0}small{color:var(--mut)}
#demo{border:1px dashed var(--bd);border-radius:12px;padding:16px 18px;margin-top:12px}
</style></head><body>
<header>${iconData ? `<img src="${iconData}" alt="">` : ''}<div><h1>${esc(name)}</h1><div class="mut">${esc(m.version || '')} · Manifest V${m.manifest_version === 3 ? 3 : 2}${m.description ? ' · ' + esc(m.description) : ''}</div></div></header>

<h2>Bookmarklet</h2>
<div class="card">
<p>Drag a link to the bookmarks bar. Clicking the bookmark runs the extension on the current page; clicking it again opens the popup.</p>
<a class="bm" href="${esc(out.bookmarklet)}" title="${fmt(out.bookmarklet.length)}">${esc(name)}</a>
<a class="bm alt" href="${esc(out.compressed)}" title="${fmt(out.compressed.length)}">${esc(name)} (compressed)</a>
${out.loader ? `<a class="bm alt" href="${esc(out.loader)}" title="Loads ${hostUrl}">${esc(name)} (loader)</a>` : ''}
<ul>
<li>Full, ${fmt(out.bookmarklet.length)}: works on pages with a strict CSP.${big ? ' Exceeds the Firefox bookmark limit (about 64 KB).' : ''}</li>
<li>Compressed, ${fmt(out.compressed.length)}: requires a page that allows <code>eval</code>.</li>
${out.loader ? `<li>Loader: loads <code>${hostUrl}</code>; requires a page whose CSP allows it.</li>` : ''}
</ul>
<p>Context menu items: Alt + right-click.</p>
</div>

<h2>Userscript</h2>
<div class="card"><p><a href="${esc(slug)}.user.js">${esc(slug)}.user.js</a> for Tampermonkey or Violentmonkey. It runs on matching sites, shares storage across sites, and makes cross-origin requests for <code>host_permissions</code>.</p></div>

<h2>Script tag</h2>
<div class="card"><pre>&lt;script src="${esc(slug)}.js"&gt;&lt;/script&gt;</pre><p><small>${fmt(out.bundle.length)}. The extension starts when the script loads.</small></p></div>

${warn ? `<h2>Limitations</h2><div class="card"><ul class="warn">${warn}</ul></div>` : ''}

<h2>Test</h2>
<div class="card"><button id="try">Run on this page</button> <small id="st"></small>
<div id="demo"><h3>Sample content</h3><p>The quick brown fox jumps over the lazy dog.</p>
<p><a href="https://example.com/">example.com</a> <input placeholder="Input"></p>
<ul><li>First item</li><li>Second item</li><li>Third item</li></ul></div></div>
<script>
document.getElementById('try').onclick = function () {
  var s = document.createElement('script');
  s.src = ${JSON.stringify(slug + '.js')};
  s.onload = function () { document.getElementById('st').textContent = 'Running.'; };
  s.onerror = function () { document.getElementById('st').textContent = 'Failed to load ' + s.src + '.'; };
  document.head.appendChild(s);
  this.disabled = true;
};
</script>
</body></html>
`;
}

export { fmt };
