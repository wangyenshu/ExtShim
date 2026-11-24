// Builds the browser runtime (dist/extshim.js, dist/extshim.min.js) and the in-browser builder.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const banner = `/*! ExtShim — run WebExtensions in a web page. MIT License. */`;

/**
 * @param {object} [o]
 * @param {boolean} [o.minify] minify the output (default: false)
 * @param {boolean} [o.write] write dist/extshim.js and dist/extshim.min.js (default: true); always returns the source
 * @param {string[]} [o.modules] optional API module file names (default: all). See src/runtime/api/modules.js.
 * @param {string[]} [o.namespaces] keep only enums of these top-level namespaces (default: all)
 */
export async function buildRuntime({ minify = false, write = true, modules = null, namespaces = null } = {}) {
  const api = path.join(root, 'src/runtime/api');
  const entry = modules
    ? { contents: `import runtime from ${JSON.stringify(path.join(root, 'src/runtime/core.js'))};\n${modules.map((m) => `import ${JSON.stringify(path.join(api, m))};`).join('\n')}\nexport default runtime;\n`, resolveDir: root, sourcefile: 'extshim-entry.js' }
    : null;
  const plugins = [];
  if (namespaces) {
    const keep = new Set(namespaces);
    plugins.push({
      name: 'filter-enums',
      setup(b) {
        b.onLoad({ filter: /[\\/]api[\\/]enums\.js$/ }, async (args) => {
          const { ENUMS } = await import(args.path + '?raw=' + Date.now());
          const kept = Object.fromEntries(Object.entries(ENUMS).filter(([k]) => keep.has(k.split('.')[0])));
          return { contents: `export const ENUMS = ${JSON.stringify(kept)};`, loader: 'js' };
        });
      },
    });
  }
  const r = await esbuild.build({
    ...(entry ? { stdin: entry } : { entryPoints: [path.join(root, 'src/runtime/index.js')] }),
    bundle: true, format: 'iife', globalName: 'ExtShim', target: ['chrome100', 'firefox100', 'safari16'],
    minify, write: false, legalComments: 'none', banner: { js: banner }, footer: { js: 'ExtShim=ExtShim.default;' },
    logLevel: 'silent', plugins,
  });
  const code = r.outputFiles[0].text;
  if (write && !modules) {
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', minify ? 'extshim.min.js' : 'extshim.js'), code);
  }
  return code;
}

export async function buildBuilder() {
  await esbuild.build({
    entryPoints: [path.join(root, 'src/builder/index.js')],
    bundle: true, format: 'iife', globalName: 'ExtShimBuilder', target: ['chrome100', 'firefox100', 'safari16'],
    minify: true, outfile: path.join(root, 'dist/extshim-builder.js'), legalComments: 'none', banner: { js: banner }, logLevel: 'silent',
  });
}

/** Self-contained playground: dist/playground.html with the runtime and builder inlined. */
export function buildPlayground(runtimeMin, builderMin) {
  const inline = (code) => {
    if (/<\/script/i.test(code)) code = code.replace(/<\/script/gi, '<\\/script');
    return code;
  };
  let html = fs.readFileSync(path.join(root, 'playground/index.html'), 'utf8');
  html = html.replace('<script id="extshim-runtime" src="../dist/extshim.min.js"></script>', () => `<script id="extshim-runtime">${inline(runtimeMin)}</script>`);
  html = html.replace('<script id="extshim-builder" src="../dist/extshim-builder.js"></script>', () => `<script id="extshim-builder">${inline(builderMin)}</script>`);
  fs.writeFileSync(path.join(root, 'dist/playground.html'), html);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildRuntime({ minify: false });
  const min = await buildRuntime({ minify: true });
  await buildBuilder();
  buildPlayground(min, fs.readFileSync(path.join(root, 'dist/extshim-builder.js'), 'utf8'));
  console.log(`dist/extshim.js, dist/extshim.min.js (${(min.length / 1024).toFixed(1)} KB minified)`);
}
