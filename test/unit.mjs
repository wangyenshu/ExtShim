// Node unit tests for the shared core. Run: node test/unit.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileMatchPattern, contentScriptMatches, matchesGlob } from '../src/core/match.js';
import { base64ToBytes, bytesToBase64, computeExtensionId, normalizePath, parseJSONC, sha256 } from '../src/core/util.js';
import { formatMessage, mergeMessages, parseShortcut, shortcutMatches, localeCandidates, htmlScriptRefs } from '../src/core/manifest.js';
import { scanTopLevelDeclarations } from '../src/core/scan.js';
import { unwrapClassicScript, wrapClassicScript, toBookmarklet, unitFunctionBody, UNIT_PARAM } from '../src/core/bundle.js';
import { readZip, rootFiles, crxToZip } from '../src/core/zip.js';
import { analyzeWithAcorn } from '../src/cli/analyze.js';
import { build } from '../src/cli/build.js';
import { stubNamespace } from '../src/runtime/api/helpers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
let failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('✓ ' + name); } catch (e) { failed++; console.log('✗ ' + name + '\n   ' + (e.stack || e).toString().split('\n').slice(0, 4).join('\n   ')); }
}

await test('match patterns', () => {
  const m = (p, u) => compileMatchPattern(p)(u);
  assert.equal(m('<all_urls>', 'https://a.com/x'), true);
  assert.equal(m('<all_urls>', 'file:///tmp/x.html'), true);
  assert.equal(m('<all_urls>', 'chrome://settings'), false);
  assert.equal(m('*://*/*', 'http://x.org/'), true);
  assert.equal(m('*://*/*', 'ftp://x.org/'), false);
  assert.equal(m('https://*.google.com/*', 'https://google.com/'), true);
  assert.equal(m('https://*.google.com/*', 'https://mail.google.com/a'), true);
  assert.equal(m('https://*.google.com/*', 'https://evilgoogle.com/'), false);
  assert.equal(m('https://example.com/foo*', 'https://example.com/foobar?x=1'), true);
  assert.equal(m('https://example.com/foo*', 'https://example.com/bar'), false);
  assert.equal(m('http://localhost/*', 'http://localhost:8080/x'), true);
  assert.equal(m('http://localhost:3000/*', 'http://localhost:8080/x'), false);
  assert.equal(m('file:///*', 'file:///home/a.html'), true);
  assert.equal(m('garbage', 'https://a.com/'), false);
  assert.equal(matchesGlob('*nytimes.com/???s/*', 'https://www.nytimes.com/arts/index.html'), true);
  assert.equal(contentScriptMatches({ matches: ['*://*/*'], exclude_matches: ['*://*.example.com/*'] }, 'https://www.example.com/'), false);
  assert.equal(contentScriptMatches({ matches: ['*://*/*'], include_globs: ['*foo*'] }, 'https://a.com/bar'), false);
});

await test('sha256 + extension ids', () => {
  for (const n of [0, 1, 55, 56, 63, 64, 65, 1000]) {
    const b = crypto.randomBytes(n);
    assert.equal(Buffer.from(sha256(new Uint8Array(b))).toString('hex'), crypto.createHash('sha256').update(b).digest('hex'));
  }
  const key = crypto.randomBytes(294);
  const expected = crypto.createHash('sha256').update(key).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, (c) => String.fromCharCode(97 + parseInt(c, 16)));
  assert.equal(computeExtensionId({ key: key.toString('base64') }), expected);
  assert.match(computeExtensionId({ name: 'X' }), /^[a-p]{32}$/);
});

await test('base64, paths, JSONC', () => {
  const b = new Uint8Array(crypto.randomBytes(1001));
  assert.deepEqual(base64ToBytes(bytesToBase64(b)), b);
  assert.equal(bytesToBase64(new Uint8Array([1, 2])), Buffer.from([1, 2]).toString('base64'));
  assert.equal(normalizePath('../img/a.png', 'popup/popup.html'), 'img/a.png');
  assert.equal(normalizePath('/x/y.js?v=1#h'), 'x/y.js');
  assert.equal(normalizePath('./a%20b.js', 'dir/p.html'), 'dir/a b.js');
  assert.deepEqual(parseJSONC('{\n// c\n"a": "http://x", /* b */ "b": [1,2,],}'), { a: 'http://x', b: [1, 2] });
});

await test('i18n getMessage', () => {
  const msgs = mergeMessages([
    { Greeting: { message: 'Hello $USER$, you have $count$ items ($$)', placeholders: { user: { content: '$1' }, count: { content: '$2' } } } },
    { greeting: { message: 'ignored' }, other: { message: 'Other $1' } },
  ]);
  assert.equal(formatMessage(msgs, 'greeting', ['Ann', 3]), 'Hello Ann, you have 3 items ($)');
  assert.equal(formatMessage(msgs, 'OTHER', 'x'), 'Other x');
  assert.equal(formatMessage(msgs, 'missing'), '');
  assert.equal(formatMessage(msgs, '@@extension_id', [], { '@@extension_id': 'abc' }), 'abc');
  assert.deepEqual(localeCandidates(['fr-CA', 'en-US'], 'en'), ['fr_CA', 'fr', 'en_US', 'en']);
});

await test('shortcuts', () => {
  const sc = parseShortcut('Ctrl+Shift+Y', false);
  assert.equal(shortcutMatches(sc, { ctrlKey: true, shiftKey: true, altKey: false, metaKey: false, code: 'KeyY' }), true);
  assert.equal(shortcutMatches(sc, { ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, code: 'KeyY' }), false);
  assert.equal(parseShortcut('Command+Comma', true).meta, true);
  assert.equal(parseShortcut('Ctrl+Bogus', false), null);
});

await test('html script refs', () => {
  const r = htmlScriptRefs('<script src="a.js"></script><script type="module" src=\'./m.js\'></script><script src="https://cdn/x.js"></script>', 'popup/p.html');
  assert.deepEqual(r, [{ path: 'popup/a.js', module: false }, { path: 'popup/m.js', module: true }]);
});

await test('scanner matches acorn on tricky code', () => {
  const src = `
    var a = 1, [b, , ...c] = [], {d, e: f = 2, g: {h}, ...i} = {};
    let j = /re}/g.test('}') ? 1 : 2
    const k = \`t \${ {x: 1}.x } \${ \`n\${2}\` }\`, l = x => ({m: 1})
    function n() { var notTop = 1; }
    async function o() {}
    function* p() {}
    class Q extends (class {}) {}
    for (var r = 0, s; r < 1; r++) {}
    for (var t in {}) {}
    if (1) { let nested = 1; }
    label: for (;;) break label;
    let u = a / 2 / 3, v = 4
    const w = function x() {}, y = class Z {}
    var html = '<!-- not a comment -->'
  `;
  const got = scanTopLevelDeclarations(src).names.sort();
  const exp = analyzeWithAcorn(src, { nested: false }).names.sort();
  assert.deepEqual(got, exp);
});

await test('scanner matches acorn on a JS corpus', () => {
  const dirs = [path.join(root, 'node_modules'), '/tmp/corpus/node_modules', '/tmp/chrome-extensions-samples'].filter((d) => fs.existsSync(d));
  let n = 0;
  const bad = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js') && fs.statSync(p).size < 3e6) {
        const code = fs.readFileSync(p, 'utf8');
        let exp;
        try { exp = analyzeWithAcorn(code, { nested: false }).names.sort(); } catch { continue; }
        n++;
        const got = scanTopLevelDeclarations(code).names.sort();
        if (JSON.stringify(got) !== JSON.stringify(exp)) bad.push(p);
      }
    }
  };
  dirs.forEach(walk);
  assert.ok(n > 10, 'corpus too small');
  assert.deepEqual(bad.slice(0, 5), [], `${bad.length}/${n} mismatches`);
  console.log(`   (${n} scripts compared)`);
});

await test('unit wrapper semantics', () => {
  // Emulate the runtime: a scope object with has-always-true and an exposure store.
  const store = Object.create(null);
  const globals = { console, Math, JSON };
  const scope = new Proxy({}, {
    has: (_, k) => typeof k === 'string' && k !== UNIT_PARAM && !['Object', 'Array', 'Function', 'undefined', 'Promise', 'Error', 'TypeError', 'Symbol'].includes(k),
    get: (_, k) => (k === Symbol.unscopables ? undefined : k in store ? store[k] : globals[k]),
    set: (_, k, v) => { store[k] = v; return true; },
  });
  const arg = { scope, expose(defs) { for (const k of Object.keys(defs)) Object.defineProperty(store, k, { get: defs[k][0], set: defs[k][1], configurable: true }); } };
  const run = (code) => {
    const wrapped = wrapClassicScript(code, analyzeWithAcorn(code).names);
    assert.equal(unwrapClassicScript(wrapped), code, 'round trip');
    const fn = vm.runInNewContext('(' + wrapped + ')');
    return fn.call(scope, arg);
  };
  run('function helper(x) { return x * 2 }\nconst K = 21; var counter = 0; var dup; function dup() {}\nwindowish = "implicit"');
  run('"use strict";\ncounter = helper(K); var self = this; var strictThis = (function () { return this })();\nlet late = 1; ');
  assert.equal(store.counter, 42, 'cross-file function + const + var');
  assert.equal(store.windowish, 'implicit', 'implicit global captured');
  assert.equal(store.strictThis, undefined, '"use strict" directive preserved');
  assert.equal(store.late, 1);
  // A file that throws still exposes what it declared before the throw (functions are hoisted).
  try { run('function early() { return "ok" }\nthrow new Error("boom")'); } catch { /* expected */ }
  assert.equal(store.early(), 'ok');
});

await test('bookmarklet encoding round-trips', () => {
  const code = 'var s = "100% sure\\n";\nvar u = "é ✓ \u{1F600}"; // comment\n';
  const bm = toBookmarklet(code);
  assert.ok(!/[\n\r\t]/.test(bm));
  assert.equal(decodeURIComponent(bm.slice('javascript:'.length)), `(function(){${code}\n})();void 0`);
  new vm.Script(decodeURIComponent(bm.slice(11)));
});

await test('zip and crx reading', async () => {
  const dir = fs.mkdtempSync('/tmp/extshim-zip-');
  fs.mkdirSync(path.join(dir, 'src/ext/sub'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/ext/manifest.json'), '{"name":"z","version":"1","manifest_version":3}');
  fs.writeFileSync(path.join(dir, 'src/ext/sub/a.txt'), 'x'.repeat(5000));
  execFileSync('python3', ['-c', `import zipfile,os\nz=zipfile.ZipFile('${dir}/e.zip','w',zipfile.ZIP_DEFLATED)\nfor dp,_,fs in os.walk('${dir}/src'):\n  [z.write(os.path.join(dp,f), os.path.relpath(os.path.join(dp,f),'${dir}/src')) for f in fs]\nz.close()`]);
  const zip = new Uint8Array(fs.readFileSync(path.join(dir, 'e.zip')));
  const files = rootFiles(await readZip(zip, { inflateRaw: (d) => zlib.inflateRawSync(d) }));
  assert.deepEqual([...files.keys()].sort(), ['manifest.json', 'sub/a.txt']);
  assert.equal(new TextDecoder().decode(files.get('sub/a.txt')), 'x'.repeat(5000));
  const hdr = Buffer.from([8, 1]);
  const crx = Buffer.concat([Buffer.from('Cr24'), Buffer.from([3, 0, 0, 0]), Buffer.from([hdr.length, 0, 0, 0]), hdr, Buffer.from(zip)]);
  assert.deepEqual(crxToZip(new Uint8Array(crx)), zip);
});

await test('CLI builds the examples into valid artifacts', async () => {
  for (const ex of ['highlighter-mv3', 'classic-mv2', 'modules-mv3']) {
    const r = await build(path.join(root, 'examples', ex), { hostUrl: 'https://example.com/x.js' });
    new vm.Script(r.outputs.bundle);
    new vm.Script(r.outputs.userscript);
    new vm.Script(decodeURIComponent(r.outputs.bookmarklet.slice(11)));
    assert.match(r.outputs.userscript, /^\/\/ ==UserScript==\n\/\/ @name {9}\S/);
    for (const u of r.units.values()) new Function(UNIT_PARAM, unitFunctionBody(u)); // eslint-disable-line no-new-func
    if (ex === 'modules-mv3') assert.ok(r.units.has('module:sw.js') && r.units.has('module:popup.js'), 'modules bundled');
  }
});

await test('stub namespaces keep enums and fail softly', async () => {
  const h = { ext: { log: { warn() {} } }, fn: (f) => async (...a) => f(...a), unsupported: (name) => async () => { throw new Error(name + ' unsupported'); }, event: (name) => ({ name }) };
  const ns = stubNamespace(h, 'demo', { Kind: { A: 'a' } });
  assert.deepEqual(ns.Kind, { A: 'a' });
  assert.equal(ns.onChanged.name, 'demo.onChanged');
  assert.equal(ns.CONSTANT, undefined);
  assert.deepEqual(await ns.sub.getAll(), []);
  await assert.rejects(ns.sub.set({}), /demo\.sub\.set unsupported/);
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
