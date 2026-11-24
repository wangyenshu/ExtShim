"""End-to-end tests for ExtShim in real Chrome (Playwright).

Run: python3 test/e2e.py [filter]
Builds the examples into test/.out first (node src/cli/extshim.js build ...).
"""
import json
import os
import subprocess
import sys
import time
import traceback
import zipfile
import struct

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import server  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'test', '.out')
BASE = 'http://127.0.0.1:8765'
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
BROWSER = os.environ.get('BROWSER', 'chromium')  # chromium | firefox

RT = "window[Symbol.for('extshim.runtime')]"
EXT = RT + ".list()[0]"


def build(name, *extra):
    subprocess.run(['node', 'src/cli/extshim.js', 'build', f'examples/{name}', '-o', f'{OUT}/{name}', '--name', name,
                    '--host-url', f'{BASE}/out/{name}/{name}.js', *extra], cwd=ROOT, check=True, capture_output=True)


def make_fixtures():
    fx = os.path.join(ROOT, 'test', '.fixtures')
    os.makedirs(fx, exist_ok=True)
    src = os.path.join(ROOT, 'examples', 'highlighter-mv3')
    zpath = os.path.join(fx, 'highlighter.zip')
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        for dp, _, fs in os.walk(src):
            for f in fs:
                full = os.path.join(dp, f)
                z.write(full, 'highlighter-main/' + os.path.relpath(full, src))  # wrapping folder like GitHub zips
    data = open(zpath, 'rb').read()
    header = b'\x08\x01'  # fake protobuf header
    with open(os.path.join(fx, 'highlighter.crx'), 'wb') as f:
        f.write(b'Cr24' + struct.pack('<I', 3) + struct.pack('<I', len(header)) + header + data)


class Page:
    def __init__(self, browser, url, wait=1.2):
        self.ctx = browser.new_context()
        self.pg = self.ctx.new_page()
        self.logs = []
        self.errors = []
        self.pg.on('console', lambda m: self.logs.append(f'{m.type}: {m.text}'))
        self.pg.on('pageerror', lambda e: self.errors.append(str(e)))
        self.pg.goto(url)
        self.wait_ext()
        time.sleep(wait)

    def wait_ext(self, timeout=8):
        end = time.time() + timeout
        while time.time() < end:
            try:
                if self.js(f"!!({RT}) && {RT}.list().length > 0 && {RT}.list().every(e => e.status === 'running')"):
                    return
            except Exception:
                pass
            time.sleep(0.1)
        raise AssertionError('extension did not start; logs:\n' + '\n'.join(self.logs[-30:]))

    def js(self, code, arg=None):
        return self.pg.evaluate(code, arg) if arg is not None else self.pg.evaluate(code)

    def until(self, code, timeout=5, msg=None):
        end = time.time() + timeout
        last = None
        while time.time() < end:
            try:
                last = self.js(code)
                if last:
                    return last
            except Exception as e:  # noqa: BLE001
                last = e
            time.sleep(0.1)
        raise AssertionError(f'{msg or code} (last={last!r})\nlogs:\n' + '\n'.join(self.logs[-25:]))

    def popup(self, code):
        """Evaluate code in the popup document (`d` = document, `w` = window)."""
        return self.js(f"(() => {{ const e = {EXT}; const f = e.popup && e.popup.panel.iframe; if (!f) return null; const w = f.contentWindow, d = w.document; return ({code}); }})()")

    def click_launcher(self, i=0):
        self.js(f"{RT}.list()[{i}].launcher.btn.click()")

    def shadow(self, code):
        return self.js(f"(() => {{ const s = {RT}.ui.shadow; return ({code}); }})()")

    def close(self):
        self.ctx.close()


def assert_eq(a, b, msg=''):
    if a != b:
        raise AssertionError(f'{msg}: expected {b!r}, got {a!r}')


# ----------------------------------------------------------------------------- tests

def highlighter_flow(P, label, page_scripts=True):
    # content script ran, in an isolated world
    P.until("document.documentElement.dataset.highlighterReady", msg='content script did not run')
    assert_eq(P.js("typeof window.extensionMarker"), 'undefined', 'content globals leaked into page')
    if page_scripts:
        assert_eq(P.js("window.pageGlobal"), 'from-page', 'page global')
    # launcher title is localized
    assert_eq(P.js(f"{EXT}.launcher.btn.title"), 'Highlight words', 'launcher title')
    # open popup
    P.click_launcher()
    P.until(f"{EXT}.popup && {EXT}.popup.ctx && {EXT}.popup.ctx.alive", msg='popup did not open')
    P.until("(() => { const f = " + EXT + ".popup.panel.iframe; return f.contentDocument.body.dataset.ready === '1' })()", msg='popup script did not run')
    assert_eq(P.popup("d.getElementById('heading').textContent"), 'Highlight a word', 'i18n in popup')
    w = P.popup("d.documentElement.getBoundingClientRect().width")
    assert 270 < w < 340, f'popup auto-size width {w}'
    # highlight through popup -> background -> content script
    P.popup("(d.getElementById('term').value = 'fox', d.getElementById('form').requestSubmit(), 1)")
    P.until("document.querySelectorAll('mark.wh-mark').length === 4", msg='highlight via popup')
    P.until(f"(() => {{ const f = {EXT}.popup.panel.iframe; return f.contentDocument.getElementById('result').textContent === '4 matches' }})()", msg='popup result text')
    assert_eq(P.js(f"{EXT}.launcher.btn.querySelector('.badge').textContent"), '4', 'badge')
    # content css applied via adoptedStyleSheets
    assert P.js("getComputedStyle(document.querySelector('mark.wh-mark')).borderRadius") == '3px', 'content css'
    # scripting.executeScript with func + args
    P.popup("(d.getElementById('count').click(), 1)")
    P.until(f"(() => {{ const t = {EXT}.popup.panel.iframe.contentDocument.getElementById('result').textContent; return /^\\d+ words on “ExtShim test page”$/.test(t) && t }})()", msg='executeScript result')
    # storage.onChanged -> content script recolors
    P.popup("(() => { const c = d.getElementById('color'); c.value = '#00ff00'; c.dispatchEvent(new w.Event('change')); return 1 })()")
    P.until("getComputedStyle(document.querySelector('mark.wh-mark')).backgroundColor === 'rgb(0, 255, 0)'", msg='storage.onChanged recolor')
    # Escape closes popup and destroys its context
    P.popup("(d.dispatchEvent(new w.KeyboardEvent('keydown', {key: 'Escape', bubbles: true})), 1)")
    P.until(f"!{EXT}.popup", msg='popup close on Escape')
    # page <-> content script postMessage with e.source === window
    P.js("window.__got = null; window.addEventListener('message', e => { if (e.data && e.data.type === 'content-did-highlight') window.__got = e.data.count }); window.postMessage({type: 'page-asks-highlight', term: 'dog'}, '*')")
    P.until("window.__got === 2", msg='postMessage page<->content (event.source === window)')
    # keyboard command (Alt+Shift+C) clears highlights
    P.pg.keyboard.press('Alt+Shift+KeyC')
    P.until("document.querySelectorAll('mark.wh-mark').length === 0", msg='command shortcut')
    # context menu: select text + Alt+right-click
    P.js("(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('#p1')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); })()")
    P.js("(() => { const t = document.querySelector('#p1'); const r = t.getBoundingClientRect(); t.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, altKey: true, clientX: r.left + 5, clientY: r.top + 5, button: 2})); })()")
    P.until("(() => { const s = " + RT + ".ui.shadow; return [...s.querySelectorAll('.menu .mi .l')].map(x => x.textContent).join('|') })()", msg='context menu shown')
    labels = P.shadow("[...s.querySelectorAll('.menu .mi .l')].map(x => x.textContent)")
    item = [x for x in labels if x.startswith('Highlight “')]
    assert item, f'context menu labels {labels}'
    P.js("(() => { const s = " + RT + ".ui.shadow; [...s.querySelectorAll('.menu .mi')].find(x => x.textContent.includes('Highlight “')).click(); })()")
    P.until("document.querySelectorAll('mark.wh-mark').length === 1", msg='context menu click -> highlight')
    P.until("(() => { const s = " + RT + ".ui.shadow; const t = s.querySelector('.toast .ms'); return t && t.textContent })()", msg='notification toast')
    # options page via runtime.openOptionsPage
    P.js(f"{EXT}.openOptions()")
    P.until(f"(() => {{ const o = [...{EXT}.overlays.values()][0]; return o && o.ctx && o.ctx.win.document.getElementById('id').textContent === {EXT}.id }})()", msg='options page')
    P.until(f"(() => {{ const o = [...{EXT}.overlays.values()][0]; return o.ctx.win.document.getElementById('color').value === '#00ff00' }})()", msg='options reads storage')
    assert not [e for e in P.errors], f'page errors: {P.errors}'
    bad = [l for l in P.logs if l.startswith('error') and 'ExtShim' in l and 'Content Security Policy' not in l]
    assert not bad, f'{label}: errors logged: {bad}'


def test_highlighter_bundle(B):
    P = Page(B, f'{BASE}/page?boot=/out/highlighter-mv3/highlighter-mv3.js')
    highlighter_flow(P, 'bundle')
    P.close()


def test_reload_and_unload(B):
    P = Page(B, f'{BASE}/page?boot=/out/highlighter-mv3/highlighter-mv3.js')
    P.js(f"(() => {{ window.__oldApi = [...{EXT}.contexts].find(c => c.type === 'content').api; return true }})()")
    P.js(f"{EXT}.reload()")
    P.until(f"{RT}.list().length === 1 && {EXT}.status === 'running' && {EXT}.background", msg='reloaded')
    err = P.js("(() => { try { window.__oldApi.runtime.sendMessage({}); return 'no error' } catch (e) { return e.message } })()")
    assert_eq(err, 'Extension context invalidated.', 'old context invalidated')
    P.click_launcher()
    P.until(f"(() => {{ const p = {EXT}.popup; return p && p.ctx && p.panel.iframe.contentDocument.body.dataset.ready === '1' }})()", msg='popup after reload')
    P.js(f"{EXT}.stop()")
    P.until(f"{RT}.list().length === 0", msg='unloaded')
    assert_eq(P.js(f"!!{RT}.ui.host.isConnected"), False, 'UI removed when last extension unloads')
    assert not P.errors, P.errors
    P.close()


def test_highlighter_strict_csp(B):
    P = Page(B, f'{BASE}/page?csp=strict&boot=/out/highlighter-mv3/highlighter-mv3.js')
    P.js("window.__v = []; document.addEventListener('securitypolicyviolation', e => __v.push(e.violatedDirective + ' ' + e.blockedURI), true)")
    highlighter_flow(P, 'strict CSP')
    v = P.js("window.__v")
    assert not [x for x in v if x.startswith('script-src') or 'eval' in x], f'script CSP violations: {v}'
    P.close()


def test_bookmarklet_on_noscript_csp(B):
    """Simulates a bookmarklet: the page allows no scripts at all."""
    P = Page.__new__(Page)
    P.ctx = B.new_context()
    P.pg = P.ctx.new_page()
    P.logs, P.errors = [], []
    P.pg.on('console', lambda m: P.logs.append(f'{m.type}: {m.text}'))
    P.pg.on('pageerror', lambda e: P.errors.append(str(e)))
    P.pg.goto(f'{BASE}/page?csp=noscript')
    code = open(f'{OUT}/highlighter-mv3/highlighter-mv3.bookmarklet.txt').read()
    from urllib.parse import unquote
    js = unquote(code[len('javascript:'):])
    P.pg.evaluate(js)
    P.wait_ext()
    time.sleep(1)
    assert_eq(P.js("typeof window.pageGlobal"), 'undefined', 'no page scripts ran')
    highlighter_flow(P, 'bookmarklet/noscript', page_scripts=False)
    # running the bookmarklet again toggles the popup instead of loading twice
    P.pg.evaluate(js)
    P.until(f"{RT}.list().length === 1 && !!{EXT}.popup", msg='second run opens popup')
    P.close()


def test_trusted_types(B):
    for mode in ('tt', 'tt-none'):
        P = Page(B, f'{BASE}/page?csp={mode}&boot=/out/highlighter-mv3/highlighter-mv3.js')
        P.until("document.documentElement.dataset.highlighterReady", msg=f'{mode}: content script')
        P.click_launcher()
        P.until("(() => { const p = " + EXT + ".popup; return p && p.ctx && p.panel.iframe.contentDocument.body.dataset.ready === '1' })()", msg=f'{mode}: popup')
        assert_eq(P.popup("d.getElementById('heading').textContent"), 'Highlight a word', f'{mode}: popup DOM')
        P.popup("(d.getElementById('term').value = 'quick', d.getElementById('form').requestSubmit(), 1)")
        P.until("document.querySelectorAll('mark.wh-mark').length === 2", msg=f'{mode}: highlight')
        assert not P.errors, P.errors
        P.close()


def test_storage_persists_and_lifecycle(B):
    P = Page(B, f'{BASE}/page?boot=/out/highlighter-mv3/highlighter-mv3.js')
    assert any('Installed: install' in l for l in P.logs), 'onInstalled(install)'
    P.js(f"{EXT}.storage.areas.sync.set({{color: '#123456'}})")
    time.sleep(0.3)
    P.logs.clear()
    P.pg.reload()
    P.wait_ext()
    time.sleep(0.6)
    assert not any('Installed: install' in l for l in P.logs), f'onInstalled fired again: {P.logs}'
    assert_eq(P.js(f"{EXT}.storage.areas.sync.data.color"), '#123456', 'storage persisted')
    P.close()


def test_classic_mv2(B):
    P = Page(B, f'{BASE}/page?boot=/out/classic-mv2/classic-mv2.js', wait=1.5)
    # content scripts share top-level function $ across files; port round trip
    P.until("document.getElementById('reading-timer-bar') && document.getElementById('reading-timer-bar').textContent.includes('read')", msg='port reply bar')
    assert_eq(P.js("document.getElementById('reading-timer-bar').dataset.sender"), 'tab', 'port.sender.tab')
    assert_eq(P.js("typeof window.$"), 'undefined', '$ leaked to page')
    # getURL for images -> loadable blob URL
    P.until("document.getElementById('reading-timer-logo').naturalWidth === 16", msg='getURL image')
    assert_eq(P.js(f"{EXT}.launcher.btn.querySelector('.badge').textContent"), '1', 'badge')
    # popup reads getBackgroundPage().getStats()
    P.click_launcher()
    P.until(f"(() => {{ const p = {EXT}.popup; return p && p.ctx && p.panel.iframe.contentDocument.getElementById('seen').textContent === '1' }})()", msg='getBackgroundPage stats')
    assert_eq(P.popup("d.getElementById('wpm').textContent"), '230 wpm', 'background var')
    assert_eq(P.popup("d.getElementById('lifetime').textContent"), '1', 'localStorage in background')
    assert_eq(P.popup("d.body.dataset.tab"), 'ExtShim test page', 'tabs.query callback')
    # background localStorage is namespaced, not the page's
    assert_eq(P.js("localStorage.getItem('lifetime')"), None, 'page localStorage untouched')
    # radio submenu via Alt+right-click
    P.js("document.body.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, altKey: true, clientX: 50, clientY: 50}))")
    P.until(RT + ".ui.shadow.querySelector('.menu')", msg='menu')
    P.js("(() => { const s = " + RT + ".ui.shadow; const r = [...s.querySelectorAll('.menu .mi')].find(x => x.textContent.includes('Reading speed')); r.dispatchEvent(new MouseEvent('mouseenter')); })()")
    P.until("(() => { const s = " + RT + ".ui.shadow; return s.querySelectorAll('.menu').length === 2 })()", msg='submenu')
    P.js("(() => { const s = " + RT + ".ui.shadow; [...s.querySelectorAll('.menu')[1].querySelectorAll('.mi')].find(x => x.textContent.includes('300')).click(); })()")
    P.until(f"{EXT}.background.win.WORDS_PER_MINUTE === 300", msg='radio onclick handler')
    assert not P.errors, P.errors
    P.close()


def test_modules_mv3(B):
    P = Page(B, f'{BASE}/page?boot=/out/modules-mv3/modules-mv3.js', wait=1.0)
    assert any('[sw] install 2.0.0-esm' in l for l in P.logs), f'sw install event: {P.logs[:10]}'
    P.click_launcher()
    P.until(f"(() => {{ const p = {EXT}.popup; return p && p.ctx && p.panel.iframe.contentDocument.body.dataset.ready === '1' }})()", msg='module popup')
    who = P.js(f"{EXT}.popup.ctx.api.runtime.sendMessage({{type: 'whoami'}})")
    assert_eq(who['hasWindow'], False, 'SW has no window')
    assert_eq(who['hasDocument'], False, 'SW has no document')
    assert who['url'].endswith('/sw.js'), who
    P.popup("(d.getElementById('text').value = 'hello module world', d.getElementById('add').click(), 1)")
    P.until(f"(() => {{ return {EXT}.popup.panel.iframe.contentDocument.getElementById('out').textContent.startsWith('Saved (1 notes, 3 words)') }})()", msg='add note')
    P.popup("(d.getElementById('side').click(), 1)")
    P.until(f"!{EXT}.popup", msg='window.close() closes popup')
    P.until(f"(() => {{ const o = [...{EXT}.overlays.values()].find(o => o.panel.kind === 'side'); return o && o.ctx && o.ctx.win.document.body.dataset.count === '1' }})()", msg='side panel list')
    P.js(f"[...{EXT}.overlays.values()].find(o => o.panel.kind === 'side').ctx.win.document.getElementById('parse').click()")
    P.until(f"[...{EXT}.overlays.values()].find(o => o.panel.kind === 'side').ctx.win.document.getElementById('parsed').textContent === 'Parsed & fine'", msg='offscreen parse')
    assert not P.errors, P.errors
    P.close()


def test_dynamic_loading(B):
    for src in ('/examples/highlighter-mv3/', '/fixtures/highlighter.zip', '/fixtures/highlighter.crx'):
        P = Page(B, f'{BASE}/page?lib=/dist/extshim.js&boot=/fixtures/load.js?src={src}')
        highlighter_flow(P, 'dynamic ' + src) if src.endswith('/') else P.until("document.documentElement.dataset.highlighterReady", msg=src)
        P.close()


def test_userscript_gm_storage(B):
    P = Page.__new__(Page)
    P.ctx = B.new_context()
    P.pg = P.ctx.new_page()
    P.logs, P.errors = [], []
    P.pg.on('console', lambda m: P.logs.append(f'{m.type}: {m.text}'))
    P.pg.on('pageerror', lambda e: P.errors.append(str(e)))
    P.pg.goto(f'{BASE}/page')
    P.pg.evaluate("""() => { window.__gm = {}; window.GM_getValue = (k, d) => (k in __gm ? __gm[k] : d); window.GM_setValue = (k, v) => { __gm[k] = v };
      window.GM_xmlhttpRequest = (o) => { setTimeout(() => o.onload({ status: 200, statusText: 'OK', responseHeaders: 'content-type: text/plain\\r\\n', response: new TextEncoder().encode('proxied:' + o.url).buffer }), 5) } }""")
    P.pg.evaluate(open(f'{OUT}/highlighter-mv3/highlighter-mv3.user.js').read())
    P.wait_ext()
    assert_eq(P.js(f"{EXT}.storage.backend.name"), 'userscript', 'GM storage backend')
    P.js(f"{EXT}.storage.areas.local.set({{a: 1}})")
    P.until("JSON.parse(window.__gm['extshim:local'] || '{}').a === 1", msg='GM_setValue used')
    # cross-origin fetch from background goes through GM_xmlhttpRequest
    r = P.js(f"{EXT}.background.win.fetch('https://api.example.org/x').then(r => r.text())")
    assert_eq(r, 'proxied:https://api.example.org/x', 'GM fetch adapter')
    P.close()


def test_playground(B):
    """Playground: load a .zip via the file picker, build a bookmarklet in-browser, run it elsewhere."""
    ctx = B.new_context()
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(f'{BASE}/dist/playground.html')
    pg.set_input_files('#fileInput', os.path.join(ROOT, 'test', '.fixtures', 'highlighter.zip'))
    pg.wait_for_function("document.getElementById('status').className === 'ok'", timeout=8000)
    pg.wait_for_function("document.querySelector('#sample mark.wh-mark') || document.documentElement.dataset.highlighterReady", timeout=8000)
    pg.click('.ext button.primary')
    pg.wait_for_selector('.ext a.bm', timeout=8000)
    href = pg.eval_on_selector('.ext a.bm', 'a => a.href')
    assert href.startswith('javascript:'), href[:40]
    assert not errors, errors
    ctx.close()
    from urllib.parse import unquote
    P = Page.__new__(Page)
    P.ctx = B.new_context()
    P.pg = P.ctx.new_page()
    P.logs, P.errors = [], []
    P.pg.on('console', lambda m: P.logs.append(f'{m.type}: {m.text}'))
    P.pg.on('pageerror', lambda e: P.errors.append(str(e)))
    P.pg.goto(f'{BASE}/page?csp=noscript')
    P.pg.evaluate(unquote(href[len('javascript:'):]))
    P.wait_ext()
    time.sleep(0.8)
    highlighter_flow(P, 'playground bookmarklet', page_scripts=False)
    P.close()


COVERAGE_JS = r'''
([entries, root]) => {
  const ns = window[Symbol.for('extshim.runtime')];
  const byName = (n) => ns.list().find((e) => e.manifest.name === n);
  const mv3 = byName('API coverage probe'), mv2 = byName('API coverage probe MV2');
  const ctxOf = (ext, type) => [...ext.contexts].find((c) => c.type === type);
  const missing = [];
  for (const e of entries) {
    const parts = e.path.split('.').slice(1).map((p) => (p === '_debugger' ? 'debugger' : p));
    const top = parts[0];
    let ext = /^(browserAction|pageAction|sidebarAction)$/.test(top) ? mv2 : mv3;
    let ctx = top === 'devtools' ? ctxOf(ext, 'devtools') : ctxOf(ext, 'background');
    if (!ctx) { missing.push(e.path + ' (no context)'); continue; }
    let v = ctx.api;
    let ok = true;
    for (const p of parts) {
      if (v == null || (typeof v !== 'object' && typeof v !== 'function')) { ok = false; break; }
      v = v[p];
    }
    if (ok) {
      if (e.kind === 'function') ok = typeof v === 'function';
      else if (e.kind === 'event') ok = !!v && typeof v.addListener === 'function' && typeof v.removeListener === 'function';
      else if (e.kind === 'setting') ok = !!v && ['get', 'set', 'clear'].every((m) => typeof v[m] === 'function') && !!v.onChange;
      else if (e.kind === 'enum') ok = !!v && typeof v === 'object' && (e.members || []).every((m) => m in v);
      else if (e.kind === 'class') ok = typeof v === 'function';
      else if (e.kind === 'property') ok = v !== undefined || /lastError|tabId$|themeName/.test(e.path);
    }
    if (!ok) missing.push(e.path + ' [' + e.kind + ']');
  }
  return missing;
}
'''


def test_api_coverage(B):
    """Every function/event/setting/enum/class in @types/chrome and @types/firefox-webext-browser exists."""
    inv = json.load(open(os.path.join(ROOT, 'test', 'api-inventory.json')))
    P = Page(B, f'{BASE}/page?lib=/dist/extshim.js&boot=/fixtures/load.js?src=/testext/coverage-ext/&boot=/fixtures/load.js?src=/testext/coverage-ext-mv2/', wait=1.0)
    P.until(f"{RT}.list().length === 2 && {RT}.list().every(e => e.status === 'running')", msg='probes running')
    P.js(f"(() => {{ const e = {RT}.list().find(x => x.manifest.devtools_page); return e.openDevTools && e.openDevTools() }})()")
    time.sleep(0.8)
    report = {}
    for browser in ('chrome', 'firefox'):
        missing = P.js(COVERAGE_JS, [inv[browser], browser])
        total = len(inv[browser])
        report[browser] = missing
        print(f'   {browser}: {total - len(missing)}/{total} API members present')
    for browser, missing in report.items():
        groups = {}
        for m in missing:
            k = '.'.join(m.split(' ')[0].split('.')[1:2])
            groups.setdefault(k, []).append(m)
        for k, v in sorted(groups.items()):
            print(f'     {browser}.{k}: {len(v)} missing, e.g. {", ".join(x for x in v[:3])}')
    bad = [e for e in P.errors]
    assert not bad, bad
    assert not report['chrome'] and not report['firefox'], 'missing API members'
    P.close()


def test_api_behaviour(B):
    """The extended APIs actually work (bundle built by the CLI with per-permission modules)."""
    subprocess.run(['node', 'src/cli/extshim.js', 'build', 'test/api-ext', '-o', f'{OUT}/api-ext', '--name', 'api-ext'], cwd=ROOT, check=True, capture_output=True)
    # Visit /page2 first (same storage): it then shows up in sessions.getRecentlyClosed().
    P = Page.__new__(Page)
    P.ctx = B.new_context()
    P.pg = P.ctx.new_page()
    P.logs, P.errors = [], []
    P.pg.on('console', lambda m: P.logs.append(f'{m.type}: {m.text}'))
    P.pg.on('pageerror', lambda e: P.errors.append(str(e)))
    P.pg.goto(f'{BASE}/page2?boot=/out/api-ext/api-ext.js')
    P.wait_ext()
    time.sleep(0.4)
    P.pg.goto(f'{BASE}/page?boot=/out/api-ext/api-ext.js')
    P.wait_ext()
    time.sleep(0.6)
    P.js("(() => { const h = document.createElement('div'); h.id = 'closed-host'; document.body.append(h); h.attachShadow({mode: 'closed'}).innerHTML = '<span>secret</span>'; })()")
    shadow = P.js(f"[...{EXT}.contexts].find(c => c.type === 'content').world.get('csShadow')()")
    assert_eq(shadow, 'secret', 'chrome.dom.openOrClosedShadowRoot')
    r = P.js(f"{EXT}.background.win.runChecks()")
    expect = {
        'bookmarks': {'found': 1, 'movedTo': '2', 'roots': ['Bookmarks bar', 'Other bookmarks', 'Mobile bookmarks'], 'rootErr': "Can't modify the root bookmark folders.", 'created': 2},
        'history': {'hasPage': True, 'added': 1, 'visits': 1, 'deleted': 0},
        'topSites': True,
        'readingList': {'read': True, 'left': 0},
        'tabGroups': {'title': 'Probe', 'color': 'green', 'tabGroupId': True, 'left': 0},
        'privacy': {'before': False, 'after': True, 'level': 'controlled_by_this_extension', 'events': 2},
        'contentSettings': ['block', 'allow'],
        'fontSettings': ['Arial', 18],
        'browsingData': None,
        'declarativeContent': {'enabled': True, 'rules': 1},
        'theme': '#123456',
        'pageCapture': {'type': 'multipart/related', 'hasTitle': True, 'boundary': True},
        'system': {'cpus': True, 'memory': True, 'storage': 1, 'displays': 1, 'width': True},
        'power': True,
        'publicSuffix': ['example.co.uk', 'github.io'],
        'webAuthenticationProxy': 'cred-AQID/3',
        'inputIme': 'ime-text',
        'audio': True,
        'enterprise': ['user', 'function'],
        'management': True,
        'search': 'Google',
        'containers': ['Personal', 'Work', 'Banking', 'Shopping'],
        'enums': ['install', 'green', 'block'],
    }
    failures = []
    for k, v in expect.items():
        if r.get(k) != v:
            failures.append(f'{k}: expected {v!r}, got {r.get(k)!r}')
    def need(cond, what):
        if not cond:
            failures.append(what)
    need(r['sessions']['value'] == {'v': 1} and any(u and u.endswith('/page2?boot=/out/api-ext/api-ext.js') for u in r['sessions']['closed']), f"sessions: {r['sessions']}")
    c = r['cookies']
    need(c.get('value') == '42' and c.get('inDocument') and c.get('removed') and c.get('foreign') == 0 and c.get('events', 0) >= 1, f'cookies: {c}')
    w = r['webRequest']
    need(w == {'cancel': 'TypeError', 'redirected': '1', 'header': 'hello', 'responseHeader': 'by-extension', 'xhr': 'error', 'completed': True}, f'webRequest: {w}')
    d = r['declarativeNetRequest']
    need(d.get('blocked') == 'TypeError' and d.get('redirected') == 'abc' and d.get('reqHeader') == 'yes' and d.get('resHeader') == 'added' and d.get('img') == 'error'
         and d.get('dynamic') == 1 and d.get('outcome') == [10] and d.get('matched') and d.get('badge') not in ('', None), f'declarativeNetRequest: {d}')
    u = r['userScripts']
    need(u.get('result') == 'ExtShim test page / function' and u.get('registered') == ['probe'], f'userScripts: {u}')
    f = r['find']
    need(f.get('count') == 4 and f.get('ranges') == 4 and f.get('highlighted') is True, f'find: {f}')
    dbg = r['debugger']
    need(dbg.get('value') == 42 and dbg.get('html') and dbg.get('typed') == 'typed-by-cdp' and "wasn't found" in (dbg.get('unknown') or ''), f'debugger: {dbg}')
    need(r['identity'][0].endswith('.chromiumapp.org/cb') and r['identity'][1] == 11 and r['identity'][2] == 'string', f"identity: {r['identity']}")
    need(r['ttsEngine'] == {'spoken': ['hello engine'], 'hasVoice': True}, f"ttsEngine: {r['ttsEngine']}")
    need('manifest.json' in r['packageDir'] and 'bg.js' in r['packageDir'], f"packageDir: {r['packageDir']}")
    # DevTools drawer: devtools page + panel + inspectedWindow.eval + HAR
    P.js(f"{EXT}.openDevTools()")
    P.until(f"(() => {{ const s = {EXT}.state.devtools; const p = s && s.panels[0]; return p && p.ctx && p.ctx.win.document.body.dataset.shown === '1' && p.ctx.win.document.getElementById('t').dataset.tab === String({RT}.tabId) }})()", msg='devtools panel shown')
    dv = P.js(f"{EXT}.storage.areas.session.get(['devtoolsEval', 'harEntries'])")
    need(dv.get('devtoolsEval') == 'ExtShim test page' and dv.get('harEntries', 0) > 0, f'devtools: {dv}')
    assert not failures, '\n  ' + '\n  '.join(failures)
    errs = [e for e in P.errors if 'not supported' not in e]
    assert not errs, errs
    P.close()


def test_samples(B):
    """Build Google's chrome-extensions-samples and boot a selection of them."""
    root = '/tmp/chrome-extensions-samples'
    if not os.path.isdir(root):
        print('   (samples checkout missing, skipped)')
        return
    res = subprocess.run(['node', 'test/build-samples.mjs', root, f'{OUT}/samples'], cwd=ROOT, capture_output=True, text=True)
    print('   ' + res.stdout.strip().replace('\n', '\n   '))
    if res.returncode:
        raise AssertionError(res.stderr)
    built = json.load(open(f'{OUT}/samples/index.json'))
    failures = []
    skipped = []
    for item in built:
        if not item.get('ok'):
            continue
        P = None
        degraded = False
        def problems(P):
            errs = [l for l in P.logs if l.startswith('error') and 'ExtShim' in l and 'not supported by ExtShim' not in l]
            return [e for e in P.errors if 'not supported by ExtShim' not in e] + errs
        try:
            P = Page(B, f"{BASE}/page?boot=/out/samples/{item['slug']}.js", wait=0.6)
            if problems(P) and not degraded:
                failures.append((item['dir'], problems(P)[:3]))
            elif P.js(f"{EXT}.state.action") and P.js(f"!!{EXT}.state.action.get('popup')"):
                P.js(f"window.__popupSeen = false; const e = {EXT}; const t = setInterval(() => {{ if (e.popup) {{ window.__popupSeen = true; clearInterval(t) }} }}, 10)")
                P.click_launcher()
                P.until("window.__popupSeen", timeout=4, msg='popup')
                time.sleep(0.4)
                if problems(P) and not degraded:
                    failures.append((item['dir'] + ' (popup)', problems(P)[:3]))
            if degraded:
                skipped.append(item['dir'])
        except Exception as e:  # noqa: BLE001
            failures.append((item['dir'], [str(e).split('\n')[0]]))
        finally:
            if P:
                P.close()
    booted = len([i for i in built if i.get('ok')])
    print(f'   booted {booted - len(failures)}/{booted} sample extensions with no errors (popups opened where present)')
    for d, e in failures:
        print(f'   ✗ {d}: {e}')
    if failures:
        raise AssertionError(f'{len(failures)} samples failed')


def main():
    flt = sys.argv[1] if len(sys.argv) > 1 else ''
    subprocess.run(['node', 'scripts/build.mjs'], cwd=ROOT, check=True, capture_output=True)
    for n in ('highlighter-mv3', 'classic-mv2', 'modules-mv3'):
        build(n)
    make_fixtures()
    with open(os.path.join(ROOT, 'test', '.fixtures', 'load.js'), 'w') as f:
        f.write("ExtShim.load(new URL(document.currentScript.src).searchParams.get('src'));\n")
    srv = server.start(8765)
    tests = [(k, v) for k, v in globals().items() if k.startswith('test_') and flt in k]
    passed = 0
    with sync_playwright() as p:
        B = p.firefox.launch(headless=True) if BROWSER == 'firefox' else p.chromium.launch(executable_path=CHROME, headless=True)
        print(f'browser: {BROWSER} {B.version}')
        for name, fn in tests:
            t0 = time.time()
            try:
                fn(B)
                passed += 1
                print(f'✓ {name} ({time.time() - t0:.1f}s)')
            except Exception as e:  # noqa: BLE001
                print(f'✗ {name}: {e}')
                if os.environ.get('VERBOSE'):
                    traceback.print_exc()
        B.close()
    srv.shutdown()
    print(f'\n{passed}/{len(tests)} passed')
    sys.exit(0 if passed == len(tests) else 1)


if __name__ == '__main__':
    main()
