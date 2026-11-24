// In-browser builder: turns an extension (files map) into a bundle / bookmarklet without Node.
// Used by the playground. Differences from the CLI: ES modules are not pre-bundled (they are
// loaded natively at runtime), and declarations are found with the lightweight scanner.
import { readZip, rootFiles, isZipLike } from '../core/zip.js';
import { scanTopLevelDeclarations } from '../core/scan.js';
import { bundleBootSource, toBookmarklet, userscriptHeader, USERSCRIPT_HOST, wrapClassicScript, unitFunctionBody, UNIT_PARAM } from '../core/bundle.js';
import { computeExtensionId, parseJSONC, slugify } from '../core/util.js';
import { getBackground, htmlScriptRefs, localizeManifest, formatMessage, mergeMessages, localeCandidates } from '../core/manifest.js';

const dec = new TextDecoder();

function parses(body) {
  try { new Function(UNIT_PARAM, body); return true; } catch { return false; } // eslint-disable-line no-new-func
}

export function build(files, { runtimeSource, options = {} } = {}) {
  if (!files.has('manifest.json')) throw new Error('manifest.json not found');
  const manifest = parseJSONC(dec.decode(files.get('manifest.json')));
  const id = options.id || computeExtensionId(manifest);
  const warnings = [];
  const modules = new Set();
  const bg = getBackground(manifest);
  if (bg && bg.module && bg.files) bg.files.forEach((f) => modules.add(f));
  for (const [p, d] of files) if (/\.html?$/i.test(p)) for (const r of htmlScriptRefs(dec.decode(d), p)) if (r.module) modules.add(r.path);
  const units = new Map();
  for (const [p, d] of files) {
    if (!/\.(m?js|cjs)$/i.test(p)) continue;
    const code = dec.decode(d);
    const wrapped = wrapClassicScript(code, scanTopLevelDeclarations(code).names);
    if (parses(unitFunctionBody(wrapped))) units.set(p, wrapped);
    else if (modules.has(p)) warnings.push(`${p} is an ES module; it will be loaded natively (needs a page that allows blob: scripts). Use the CLI to pre-bundle it.`);
  }
  const boot = bundleBootSource({ id, manifest, files, units, options });
  const bundle = runtimeSource + '\n' + boot;
  let display = manifest;
  if (manifest.default_locale) {
    const msgs = [];
    for (const l of localeCandidates([navigator.language || 'en'], manifest.default_locale)) {
      const f = files.get(`_locales/${l}/messages.json`);
      if (f) { try { msgs.push(parseJSONC(dec.decode(f))); } catch { /* ignore */ } }
    }
    const merged = mergeMessages(msgs);
    display = localizeManifest(manifest, (n) => formatMessage(merged, n, [], {}));
  }
  return {
    id, manifest, display, warnings, units: units.size,
    slug: slugify(display.name),
    bundle,
    bookmarklet: toBookmarklet(bundle),
    userscript: () => userscriptHeader(display) + '(function(){\n' + runtimeSource + '\n' + bundleBootSource({ id, manifest, files, units, options, host: USERSCRIPT_HOST }) + '})();\n',
  };
}

/** Collect files from a drop event, <input webkitdirectory>, a .zip/.crx File, or a URL. */
export async function collectFiles(source) {
  if (source && source.dataTransfer) source = source.dataTransfer;
  if (source && source.items && source.items.length && source.items[0].webkitGetAsEntry) {
    const entries = [...source.items].map((i) => i.webkitGetAsEntry()).filter(Boolean);
    if (entries.length === 1 && entries[0].isFile) return collectFiles(source.files[0]);
    const map = new Map();
    const readEntry = (entry, prefix) => new Promise((resolve) => {
      if (entry.isFile) {
        entry.file(async (f) => { map.set(prefix + entry.name, new Uint8Array(await f.arrayBuffer())); resolve(); }, () => resolve());
      } else {
        const reader = entry.createReader();
        const all = [];
        const next = () => reader.readEntries(async (batch) => {
          if (!batch.length) { await Promise.all(all.map((e) => readEntry(e, prefix + entry.name + '/'))); resolve(); return; }
          all.push(...batch);
          next();
        }, () => resolve());
        next();
      }
    });
    await Promise.all(entries.map((e) => readEntry(e, '')));
    return rootFiles(map);
  }
  if (source && source.length !== undefined && source[0] instanceof File && source[0].webkitRelativePath) {
    const map = new Map();
    for (const f of source) map.set(f.webkitRelativePath, new Uint8Array(await f.arrayBuffer()));
    return rootFiles(map);
  }
  if (source && source.length !== undefined && source[0] instanceof File) source = source[0];
  if (typeof source === 'string') {
    const r = await fetch(source);
    source = new Uint8Array(await r.arrayBuffer());
  }
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(await source.arrayBuffer());
  if (!isZipLike(bytes)) throw new Error('Not a .zip / .crx / .xpi file');
  return rootFiles(await readZip(bytes));
}

export { readZip, rootFiles };
