// Page-level APIs: declarativeContent, userScripts, contentScripts (Firefox), find, theme,
// dom, pageCapture, tabCapture, desktopCapture, power, system.*, clipboard, captivePortal,
// printing / printerProvider / printingMetrics, publicSuffix, systemLog.
import { defineNamespace, defineStartup } from './registry.js';
import { matchUrlFilters } from './misc-apis.js';
import { contentScriptMatches } from '../../core/match.js';
import { normalizePath } from '../../core/util.js';
import { captureVisibleTab, displayStream, registerStream, wrapGetUserMedia } from '../capture.js';
import { World, compileUnit, canEval } from '../scope.js';
import { Context } from '../context.js';
import { chromeSetting } from './settings.js';
import { publicSuffix, registrableDomain, isIp } from '../psl.js';
import { adoptCss } from '../dom.js';

const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// ------------------------------------------------------------------ declarativeContent

class PageStateMatcher { constructor(o = {}) { this.instanceType = 'declarativeContent.PageStateMatcher'; Object.assign(this, clone(o)); } }
class ShowAction { constructor() { this.instanceType = 'declarativeContent.ShowAction'; } }
class ShowPageAction { constructor() { this.instanceType = 'declarativeContent.ShowPageAction'; } }
class SetIcon { constructor(o = {}) { this.instanceType = 'declarativeContent.SetIcon'; if (o.imageData) this.imageData = o.imageData; if (o.path) this.path = o.path; } }
class RequestContentScript { constructor(o = {}) { this.instanceType = 'declarativeContent.RequestContentScript'; Object.assign(this, clone(o)); } }

class DeclarativeContent {
  constructor(ext) {
    this.ext = ext;
    this.internal = ext.storage.internal();
    this.rules = (this.internal.data['dc:rules'] || []).map((r) => ({ ...r }));
    this.next = 1;
    this.injected = new Set();
    this.shown = false;
    this.mo = null;
    this.timer = null;
    ext.navHooks.add(() => this.evaluate());
    ext.whenBackgroundReady().then(() => this.evaluate());
  }
  dispose() { if (this.mo) this.mo.disconnect(); }
  save() { this.internal.set({ 'dc:rules': this.rules.map((r) => ({ ...r, actions: r.actions.map((a) => (a.imageData ? { instanceType: a.instanceType } : a)) })) }); }
  condition(c) {
    if (c.pageUrl && !matchUrlFilters([c.pageUrl], location.href)) return false;
    if (c.css && !c.css.every((sel) => { try { return !!document.querySelector(sel); } catch { return false; } })) return false;
    if (c.isBookmarked != null) {
      const b = this.ext.state['profile:bookmarks'];
      const marked = !!b && Object.values(b.data.nodes).some((n) => n.url === location.href);
      if (marked !== c.isBookmarked) return false;
    }
    return true;
  }
  evaluate() {
    const ext = this.ext;
    const active = this.rules.filter((r) => r.conditions.some((c) => this.condition(c)));
    const show = active.some((r) => r.actions.some((a) => /Show(Page)?Action$/.test(a.instanceType)));
    const st = ext.state.action;
    if (st && this.rules.some((r) => r.actions.some((a) => /Show(Page)?Action$/.test(a.instanceType)))) {
      if (show) st.set('enabled', true, ext.shim.tabId);
      else if (this.shown) st.set('enabled', null, ext.shim.tabId);
    }
    this.shown = show;
    for (const r of active) {
      for (const a of r.actions) {
        if (a.instanceType === 'declarativeContent.SetIcon' && st) st.set('icon', a.imageData ? { imageData: a.imageData } : { path: a.path }, ext.shim.tabId);
        if (a.instanceType === 'declarativeContent.RequestContentScript' && !this.injected.has(r.id)) {
          this.injected.add(r.id);
          const f = ext.content.frame(window);
          if (a.css && a.css.length) ext.content.insertCss(f, { files: a.css });
          if (a.js && a.js.length) ext.content.injectEntry(f, { js: a.js.map((p) => normalizePath(p)), world: 'ISOLATED' });
        }
      }
    }
    const needDom = this.rules.some((r) => r.conditions.some((c) => c.css));
    if (needDom && !this.mo && document.documentElement) {
      this.mo = new MutationObserver(() => { clearTimeout(this.timer); this.timer = setTimeout(() => this.evaluate(), 250); });
      this.mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'id'] });
    }
  }
}

export function declarativeContentApi(h) {
  const { ext } = h;
  const st = ext.shared('declarativeContent', () => new DeclarativeContent(ext));
  const ev = h.event('declarativeContent.onPageChanged');
  const done = (cb, v) => { if (typeof cb === 'function') setTimeout(() => h.ctx.callback(cb, null, v), 0); return Promise.resolve(v); };
  ev.addRules = (rules = [], cb) => {
    const added = rules.map((r) => ({ id: r.id || `_${st.next++}_`, priority: r.priority || 100, tags: r.tags || [], conditions: clone(r.conditions || []), actions: (r.actions || []).map((a) => (a.imageData ? { instanceType: a.instanceType, imageData: a.imageData } : clone(a))) }));
    for (const r of added) { st.rules = st.rules.filter((x) => x.id !== r.id); st.rules.push(r); }
    st.save();
    st.evaluate();
    return done(cb, clone(added.map((r) => ({ ...r, actions: r.actions.map((a) => (a.imageData ? { instanceType: a.instanceType } : a)) }))));
  };
  ev.removeRules = (ids, cb) => {
    if (typeof ids === 'function') { cb = ids; ids = null; }
    st.rules = ids ? st.rules.filter((r) => !ids.includes(r.id)) : [];
    st.save();
    st.evaluate();
    return done(cb);
  };
  ev.getRules = (ids, cb) => {
    if (typeof ids === 'function') { cb = ids; ids = null; }
    return done(cb, clone(st.rules.filter((r) => !ids || ids.includes(r.id)).map((r) => ({ ...r, actions: r.actions.map((a) => (a.imageData ? { instanceType: a.instanceType } : a)) }))));
  };
  return { PageStateMatcher, ShowAction, ShowPageAction, SetIcon, RequestContentScript, onPageChanged: ev };
}

// ------------------------------------------------------------------ userScripts / contentScripts

function userScriptState(ext) {
  return ext.shared('userScripts', () => {
    const internal = ext.storage.internal();
    return {
      scripts: new Map((internal.data['us:scripts'] || []).map((s) => [s.id, s])),
      worlds: internal.data['us:worlds'] || {},
      saveScripts() { internal.set({ 'us:scripts': [...this.scripts.values()] }); },
      saveWorlds() { internal.set({ 'us:worlds': this.worlds }); },
      worldsById: new Map(),
    };
  });
}

/** An isolated world for user scripts, with only runtime messaging when enabled. */
function userScriptWorld(ext, worldId = '') {
  const st = userScriptState(ext);
  if (st.worldsById.has(worldId)) return st.worldsById.get(worldId);
  const cfg = st.worlds[worldId] || st.worlds[''] || {};
  const world = new World({ kind: 'content', target: window, log: ext.log, label: 'user script' });
  const ctx = new Context(ext, { type: 'content', url: location.href, tabId: ext.shim.tabId, frameId: 0, win: window, world });
  ctx.userScript = true;
  const api = {};
  if (cfg.messaging) {
    api.runtime = {
      get id() { return ext.id; },
      sendMessage: (...a) => ctx.api.runtime.sendMessage(...a),
      connect: (...a) => ctx.api.runtime.connect(...a),
      get lastError() { return ctx.api.runtime.lastError; },
    };
  }
  world.define({ chrome: api, browser: api });
  ctx.markReady();
  st.worldsById.set(worldId, world);
  return world;
}

async function runUserScript(ext, script, opts = {}) {
  const world = script.world === 'MAIN' ? ext.content.main(ext.content.frame(window)) : userScriptWorld(ext, script.worldId || '');
  const results = [];
  for (const src of script.js || []) {
    try {
      if (src.file) world.run(await ext.unit(normalizePath(src.file)), ext.virtualUrl(src.file));
      else if (src.code != null) {
        if (!canEval()) throw new Error('User scripts given as code need eval, which this page\'s CSP blocks.');
        if (opts.collect) results.push(world.evaluate(String(src.code)));
        else world.run(compileUnit(String(src.code), `userscript:${script.id || 'anonymous'}`), 'user script ' + (script.id || ''));
      }
    } catch (e) { ext.log.error('User script failed:', e); results.push(undefined); }
  }
  return results;
}

defineStartup(async (ext) => {
  const st = userScriptState(ext);
  const url = location.href;
  for (const s of st.scripts.values()) {
    const entry = { matches: s.matches || [], exclude_matches: s.excludeMatches || [], include_globs: s.includeGlobs || [], exclude_globs: s.excludeGlobs || [] };
    if (!contentScriptMatches(entry, url)) continue;
    const go = () => runUserScript(ext, s);
    const when = s.runAt || 'document_idle';
    if (when === 'document_start' || document.readyState === 'complete' || (when === 'document_end' && document.readyState !== 'loading')) go();
    else document.addEventListener(when === 'document_end' ? 'DOMContentLoaded' : 'readystatechange', function f() { if (when === 'document_end' || document.readyState === 'complete') { document.removeEventListener('readystatechange', f); go(); } });
  }
}, ['userScripts']);

export function userScriptsApi(h) {
  const { ext, fn } = h;
  const st = userScriptState(ext);
  const norm = (s) => {
    if (!s.id || String(s.id).startsWith('_')) throw new Error('User script id must be a non-empty string not starting with "_".');
    if (!s.js || !s.js.length) throw new Error(`User script with ID '${s.id}' must specify at least one js source.`);
    return { id: s.id, matches: s.matches || [], excludeMatches: s.excludeMatches || [], includeGlobs: s.includeGlobs || [], excludeGlobs: s.excludeGlobs || [], js: clone(s.js), runAt: s.runAt || 'document_idle', allFrames: !!s.allFrames, world: s.world || 'USER_SCRIPT', worldId: s.worldId };
  };
  const firefoxRegister = (o) => {
    // Firefox MV2: userScripts.register(options) -> RegisteredUserScript; applies right away.
    const s = norm({ id: 'ff-' + Math.random().toString(36).slice(2), ...o });
    const entry = { matches: s.matches, exclude_matches: s.excludeMatches, include_globs: s.includeGlobs, exclude_globs: s.excludeGlobs };
    if (contentScriptMatches(entry, location.href)) runUserScript(ext, s);
    return { unregister: fn(() => {}) };
  };
  return {
    register: fn(async (scripts) => {
      if (!Array.isArray(scripts)) return firefoxRegister(scripts || {});
      const list = scripts.map(norm);
      for (const s of list) if (st.scripts.has(s.id)) throw new Error(`Duplicate script ID '${s.id}'`);
      for (const s of list) st.scripts.set(s.id, s);
      st.saveScripts();
    }),
    update: fn(async (scripts = []) => {
      for (const s of scripts) {
        const cur = st.scripts.get(s.id);
        if (!cur) throw new Error(`Script with ID '${s.id}' does not exist or is not fully registered`);
        st.scripts.set(s.id, norm({ ...cur, ...s }));
      }
      st.saveScripts();
    }),
    getScripts: fn(async (f = {}) => [...st.scripts.values()].filter((s) => !f.ids || f.ids.includes(s.id)).map(clone)),
    unregister: fn(async (f = {}) => { for (const id of f.ids || [...st.scripts.keys()]) st.scripts.delete(id); st.saveScripts(); }),
    execute: fn(async (inj = {}) => {
      if (!inj.target || inj.target.tabId !== ext.shim.tabId) throw new Error('Cannot access contents of the page.');
      const out = await runUserScript(ext, { id: 'execute', js: inj.js, world: inj.world, worldId: inj.worldId }, { collect: true });
      const last = out[out.length - 1];
      let result;
      try { result = last === undefined ? null : clone(await last); } catch { result = null; }
      return [{ frameId: 0, documentId: 'D' + ext.shim.tabId, result }];
    }),
    configureWorld: fn((cfg = {}) => {
      st.worlds[cfg.worldId || ''] = { csp: cfg.csp, messaging: !!cfg.messaging, worldId: cfg.worldId };
      st.worldsById.delete(cfg.worldId || '');
      st.saveWorlds();
    }),
    getWorldConfigurations: fn(() => Object.values(st.worlds).map(clone)),
    resetWorldConfiguration: fn((worldId) => { delete st.worlds[worldId || '']; st.worldsById.delete(worldId || ''); st.saveWorlds(); }),
    onBeforeScript: h.event('userScripts.onBeforeScript'),
  };
}

export function contentScriptsApi(h) {
  const { ext, fn } = h;
  return {
    register: fn(async (o = {}) => {
      const entry = { index: 'ff:' + Date.now(), matches: o.matches || [], exclude_matches: o.excludeMatches || [], include_globs: o.includeGlobs || [], exclude_globs: o.excludeGlobs || [], js: (o.js || []).map((x) => x.file && normalizePath(x.file)).filter(Boolean), css: (o.css || []).map((x) => x.file && normalizePath(x.file)).filter(Boolean), run_at: o.runAt || 'document_idle', world: o.world || 'ISOLATED' };
      const code = (o.js || []).filter((x) => x.code != null).map((x) => x.code);
      const cssCode = (o.css || []).filter((x) => x.code != null).map((x) => x.code).join('\n');
      const f = ext.content.frame(window);
      if (ext.options.contentScripts === 'all' || contentScriptMatches(entry, location.href)) {
        if (entry.css.length || cssCode) ext.content.insertCss(f, { files: entry.css, css: cssCode, key: entry.index });
        await ext.content.injectEntry(f, entry);
        if (code.length) { const w = ext.content.isolated(f); for (const c of code) w.run(compileUnit(c, 'contentScripts.register'), 'registered content script'); }
      }
      return { unregister: fn(() => { const rm = ext.content.css.get(entry.index); if (rm) { rm(); ext.content.css.delete(entry.index); } }) };
    }),
  };
}

// ------------------------------------------------------------------ find (Firefox)

function findState(ext) {
  return ext.shared('find', () => ({ ranges: [], sheet: null, dispose() { clearHighlight(); } }));
}
function clearHighlight() {
  if (window.CSS && CSS.highlights) { CSS.highlights.delete('extshim-find'); CSS.highlights.delete('extshim-find-active'); }
}

export function findApi(h) {
  const { ext, fn } = h;
  const st = findState(ext);
  const host = () => ext.shim.ui && ext.shim.ui.host;
  return {
    find: fn((query, o = {}) => {
      query = String(query || '');
      st.ranges = [];
      const texts = [];
      const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement && (n.parentElement.closest('script,style,noscript,template') || (host() && host().contains(n))) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      while (walker.nextNode()) texts.push(walker.currentNode);
      const fold = (s) => (o.matchDiacritics ? s : s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      const flags = o.caseSensitive ? 'g' : 'gi';
      const esc = fold(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(o.entireWord ? `(?<![\\p{L}\\p{N}_])${esc}(?![\\p{L}\\p{N}_])` : esc, flags + 'u');
      const rangeData = [];
      const rectData = [];
      texts.forEach((node, i) => {
        const value = fold(node.nodeValue);
        if (!query || value.length !== node.nodeValue.length) return;
        let m;
        re.lastIndex = 0;
        while ((m = re.exec(value))) {
          const r = document.createRange();
          r.setStart(node, m.index);
          r.setEnd(node, m.index + m[0].length);
          st.ranges.push(r);
          if (o.includeRangeData) rangeData.push({ framePos: 0, startTextNodePos: i, endTextNodePos: i, startOffset: m.index, endOffset: m.index + m[0].length, text: node.nodeValue.slice(m.index, m.index + m[0].length) });
          if (o.includeRectData) {
            const rects = [...r.getClientRects()].map((x) => ({ top: x.top + scrollY, left: x.left + scrollX, bottom: x.bottom + scrollY, right: x.right + scrollX }));
            rectData.push({ rectsAndTexts: { rectList: rects, textList: [m[0]] }, textList: m[0] });
          }
          if (!m[0].length) re.lastIndex++;
        }
      });
      const out = { count: st.ranges.length };
      if (o.includeRangeData) out.rangeData = rangeData;
      if (o.includeRectData) out.rectData = rectData;
      return out;
    }),
    highlightResults: fn((o = {}) => {
      if (!st.ranges.length) throw new Error('No search results to highlight.');
      const idx = o.rangeIndex == null ? 0 : o.rangeIndex;
      if (window.CSS && CSS.highlights && typeof Highlight === 'function') {
        if (!st.sheet) { st.sheet = true; adoptCss(document, window, [{ css: '::highlight(extshim-find){background:#ff0;color:#000}::highlight(extshim-find-active){background:#38d878;color:#000}' }]); }
        CSS.highlights.set('extshim-find', new Highlight(...st.ranges));
        if (st.ranges[idx]) CSS.highlights.set('extshim-find-active', new Highlight(st.ranges[idx]));
      } else {
        const sel = getSelection();
        sel.removeAllRanges();
        if (st.ranges[idx]) sel.addRange(st.ranges[idx]);
      }
      if (!o.noScroll && st.ranges[idx]) { const el = st.ranges[idx].startContainer.parentElement; if (el) el.scrollIntoView({ block: 'center' }); }
    }),
    removeHighlighting: fn(() => { clearHighlight(); }),
  };
}

// ------------------------------------------------------------------ theme (Firefox)

export function themeApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('theme', () => ({ current: ext.storage.internal().data.theme || null }));
  const apply = () => ext.shim.ui.setTheme(st.current && st.current.colors);
  if (st.current) apply();
  return {
    getCurrent: fn(() => clone(st.current || {})),
    update: fn(async (a, b) => {
      const theme = b === undefined ? a : b;
      st.current = clone(theme || {});
      await ext.storage.internal().set({ theme: st.current });
      apply();
      ext.dispatch('theme.onUpdated', () => [{ theme: clone(st.current), windowId: typeof a === 'number' ? a : undefined }]);
    }),
    reset: fn(async () => {
      st.current = null;
      await ext.storage.internal().remove('theme');
      apply();
      ext.dispatch('theme.onUpdated', () => [{ theme: {} }]);
    }),
    onUpdated: h.event('theme.onUpdated'),
  };
}

// ------------------------------------------------------------------ pageCapture

export function pageCaptureApi(h) {
  const { fn } = h;
  return {
    saveAsMHTML: fn(async () => {
      const boundary = '----MultipartBoundary--' + Math.random().toString(36).slice(2);
      const parts = [];
      const qp = (s) => s.replace(/[^\t\n\r\x20-\x3c\x3e-\x7e]/g, (c) => '=' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
      const html = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
      parts.push(`Content-Type: text/html\r\nContent-ID: <frame-main@mhtml.blink>\r\nContent-Transfer-Encoding: quoted-printable\r\nContent-Location: ${location.href}\r\n\r\n${qp(unescape(encodeURIComponent(html)))}`);
      for (const sheet of document.styleSheets) {
        let css;
        try { css = [...sheet.cssRules].map((r) => r.cssText).join('\n'); } catch { continue; }
        parts.push(`Content-Type: text/css\r\nContent-Transfer-Encoding: quoted-printable\r\nContent-Location: ${sheet.href || location.href + '#inline-style'}\r\n\r\n${qp(unescape(encodeURIComponent(css)))}`);
      }
      const head = `From: <Saved by ExtShim>\r\nSnapshot-Content-Location: ${location.href}\r\nSubject: ${document.title}\r\nDate: ${new Date().toUTCString()}\r\nMIME-Version: 1.0\r\nContent-Type: multipart/related;\r\n\ttype="text/html";\r\n\tboundary="${boundary}"\r\n\r\n`;
      return new Blob([head + parts.map((p) => `--${boundary}\r\n${p}\r\n`).join('') + `--${boundary}--\r\n`], { type: 'multipart/related' });
    }),
  };
}

// ------------------------------------------------------------------ tabCapture / desktopCapture

export function tabCaptureApi(h) {
  const { ext, fn, ctx } = h;
  const st = ext.shared('tabCapture', () => ({ captured: new Map() }));
  const track = (stream) => {
    const info = { tabId: ext.shim.tabId, status: 'active', fullscreen: false };
    st.captured.set(stream, info);
    ext.dispatch('tabCapture.onStatusChanged', [{ ...info }]);
    stream.getTracks().forEach((t) => t.addEventListener('ended', () => {
      if (!st.captured.has(stream)) return;
      st.captured.delete(stream);
      ext.dispatch('tabCapture.onStatusChanged', [{ ...info, status: 'stopped' }]);
    }));
  };
  return {
    capture(options = {}, cb) {
      displayStream({ video: options.video !== false && (options.videoConstraints || true), audio: !!options.audio, currentTab: true })
        .then((s) => { track(s); cb && cb(s); })
        .catch((e) => cb && ctx.withLastError(e, () => cb(null)));
    },
    getMediaStreamId: fn(async () => {
      const s = await displayStream({ video: true, audio: true, currentTab: true });
      track(s);
      return registerStream(s);
    }),
    getCapturedTabs: fn(() => [...st.captured.values()].map((x) => ({ ...x }))),
    onStatusChanged: h.event('tabCapture.onStatusChanged'),
  };
}

export function desktopCaptureApi(h) {
  const { ctx } = h;
  const pending = new Map();
  let n = 0;
  return {
    chooseDesktopMedia(sources, targetTab, cb) {
      if (typeof targetTab === 'function') cb = targetTab;
      const id = ++n;
      const wantAudio = (sources || []).includes('audio');
      const onlyTab = (sources || []).length && sources.every((s) => s === 'tab' || s === 'audio');
      pending.set(id, true);
      displayStream({ video: true, audio: wantAudio, currentTab: onlyTab })
        .then((s) => { if (!pending.delete(id)) { s.getTracks().forEach((t) => t.stop()); return; } cb && cb(registerStream(s), { canRequestAudioTrack: s.getAudioTracks().length > 0 }); })
        .catch(() => { if (pending.delete(id) && cb) ctx.callback(cb, null, '', { canRequestAudioTrack: false }); });
      return id;
    },
    cancelChooseDesktopMedia(id) { pending.delete(id); },
  };
}

// ------------------------------------------------------------------ power

export function powerApi(h) {
  const { ext } = h;
  const st = ext.shared('power', () => ({ lock: null, want: false, dispose() { if (this.lock) this.lock.release().catch(() => {}); } }));
  const acquire = async () => {
    if (!navigator.wakeLock || !st.want) return;
    try { st.lock = await navigator.wakeLock.request('screen'); st.lock.addEventListener('release', () => { st.lock = null; }); } catch (e) { ext.log.debug('wake lock:', e.message); }
  };
  if (!st.vis) { st.vis = () => { if (document.visibilityState === 'visible' && st.want && !st.lock) acquire(); }; document.addEventListener('visibilitychange', st.vis); }
  return {
    requestKeepAwake: () => { st.want = true; acquire(); },
    releaseKeepAwake: () => { st.want = false; if (st.lock) st.lock.release().catch(() => {}); st.lock = null; },
    reportActivity: h.fn(() => {}),
  };
}

// ------------------------------------------------------------------ system.*

export function systemCpuApi(h) {
  return {
    getInfo: h.fn(() => {
      const n = navigator.hardwareConcurrency || 4;
      const ua = navigator.userAgent;
      return {
        numOfProcessors: n, archName: /arm|aarch64/i.test(ua) ? 'arm64' : 'x86_64', modelName: '', features: [],
        processors: Array.from({ length: n }, () => ({ usage: { user: 0, kernel: 0, idle: 0, total: 0 } })), temperatures: [],
      };
    }),
  };
}
export function systemMemoryApi(h) {
  return {
    getInfo: h.fn(() => {
      const cap = (navigator.deviceMemory || 8) * 1073741824;
      const used = performance.memory ? performance.memory.usedJSHeapSize : 0;
      return { capacity: cap, availableCapacity: Math.max(0, cap - used) };
    }),
  };
}
export function systemStorageApi(h) {
  const est = async () => (navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : { quota: 0, usage: 0 });
  return {
    getInfo: h.fn(async () => { const e = await est(); return [{ id: 'browser-storage', name: 'Browser storage', type: 'fixed', capacity: e.quota || 0 }]; }),
    ejectDevice: h.fn(() => 'no_such_device'),
    getAvailableCapacity: h.fn(async (id) => { const e = await est(); return { id, availableCapacity: Math.max(0, (e.quota || 0) - (e.usage || 0)) }; }),
    onAttached: h.event('system.storage.onAttached'),
    onDetached: h.event('system.storage.onDetached'),
  };
}
export function systemDisplayApi(h) {
  const { ext, fn } = h;
  ext.shared('systemDisplay', () => {
    const fire = () => ext.dispatch('system.display.onDisplayChanged', []);
    if (screen.addEventListener) screen.addEventListener('change', fire);
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener && mq.addEventListener('change', fire);
    return { dispose() { if (screen.removeEventListener) screen.removeEventListener('change', fire); } };
  });
  const no = () => fn(() => { throw new Error('Not supported on this platform.'); });
  const info = () => {
    const s = screen;
    const bounds = { left: s.left || 0, top: s.top || 0, width: s.width, height: s.height };
    const workArea = { left: s.availLeft || 0, top: s.availTop || 0, width: s.availWidth, height: s.availHeight };
    const dpi = 96 * (window.devicePixelRatio || 1);
    const mode = { width: s.width, height: s.height, widthInNativePixels: Math.round(s.width * devicePixelRatio), heightInNativePixels: Math.round(s.height * devicePixelRatio), deviceScaleFactor: devicePixelRatio, refreshRate: 60, isNative: true, isSelected: true, isInterlaced: false };
    return {
      id: '0', name: 'Display', mirroringSourceId: '', mirroringDestinationIds: [], isPrimary: true, isInternal: !!(s.isInternal), isEnabled: true, isUnified: false,
      dpiX: dpi, dpiY: dpi, rotation: (s.orientation && s.orientation.angle) || 0, bounds, overscan: { left: 0, top: 0, right: 0, bottom: 0 }, workArea,
      modes: [mode], hasTouchSupport: navigator.maxTouchPoints > 0, hasAccelerometerSupport: false, availableDisplayZoomFactors: [1], displayZoomFactor: 1, activeState: 'active',
    };
  };
  return {
    getInfo: fn(() => [info()]), getDisplayLayout: fn(() => []),
    setDisplayProperties: no(), setDisplayLayout: no(), enableUnifiedDesktop: () => {}, overscanCalibrationStart: () => {}, overscanCalibrationAdjust: () => {},
    overscanCalibrationReset: () => {}, overscanCalibrationComplete: () => {}, showNativeTouchCalibration: no(), startCustomTouchCalibration: () => {},
    completeCustomTouchCalibration: () => {}, clearTouchCalibration: () => {}, setMirrorMode: no(),
    onDisplayChanged: h.event('system.display.onDisplayChanged'),
  };
}

// ------------------------------------------------------------------ clipboard (Firefox), captivePortal (Firefox)

export function clipboardApi(h) {
  return {
    setImageData: h.fn(async (data, type) => {
      let blob = new Blob([data], { type: type === 'jpeg' ? 'image/jpeg' : 'image/png' });
      if (type === 'jpeg') {
        const bmp = await createImageBitmap(blob);
        const c = document.createElement('canvas');
        c.width = bmp.width; c.height = bmp.height;
        c.getContext('2d').drawImage(bmp, 0, 0);
        blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    }),
  };
}

export function captivePortalApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('captivePortal', () => {
    const s = { checked: Date.now() };
    const fire = () => {
      s.checked = Date.now();
      ext.dispatch('captivePortal.onStateChanged', [{ state: navigator.onLine ? 'not_captive' : 'unknown' }]);
      if (navigator.onLine) ext.dispatch('captivePortal.onConnectivityAvailable', ['clear']);
    };
    window.addEventListener('online', fire);
    window.addEventListener('offline', fire);
    s.dispose = () => { window.removeEventListener('online', fire); window.removeEventListener('offline', fire); };
    return s;
  });
  return {
    getState: fn(() => (navigator.onLine ? 'not_captive' : 'unknown')),
    getLastChecked: fn(() => Date.now() - st.checked),
    onStateChanged: h.event('captivePortal.onStateChanged'),
    onConnectivityAvailable: h.event('captivePortal.onConnectivityAvailable'),
    canonicalURL: chromeSetting(h, 'captivePortal.canonicalURL', 'http://detectportal.firefox.com/canonical.html'),
  };
}

// ------------------------------------------------------------------ printing

function printJobs(ext) { return ext.shared('printJobs', () => ({ jobs: new Map(), n: 1 })); }

function printBlob(blob, title) {
  return new Promise((resolve) => {
    const f = document.createElement('iframe');
    f.setAttribute('data-extshim', 'print');
    f.style.cssText = 'position:fixed;width:0;height:0;border:0;left:-9999px';
    f.src = URL.createObjectURL(blob);
    f.title = title || 'print';
    f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { window.open(f.src, '_blank'); } setTimeout(() => { f.remove(); resolve(); }, 1000); };
    document.documentElement.appendChild(f);
  });
}

export function printingApi(h) {
  const { ext, fn } = h;
  const st = printJobs(ext);
  const printer = { id: 'extshim-print-dialog', name: 'Browser print dialog', description: 'Prints through the browser\'s print dialog', uri: 'browser://print', source: 'USER', isDefault: true, recentlyUsedRank: 0 };
  return {
    MAX_SUBMIT_JOB_CALLS_PER_MINUTE: 40, MAX_GET_PRINTER_INFO_CALLS_PER_MINUTE: 20,
    getPrinters: fn(() => [{ ...printer }]),
    getPrinterInfo: fn(() => ({ status: 'AVAILABLE', capabilities: { version: '1.0', printer: { supported_content_type: [{ content_type: 'application/pdf' }], color: { option: [{ type: 'STANDARD_COLOR', is_default: true }, { type: 'STANDARD_MONOCHROME' }] }, copies: { default: 1, max: 99 }, media_size: { option: [{ name: 'ISO_A4', width_microns: 210000, height_microns: 297000, is_default: true }, { name: 'NA_LETTER', width_microns: 215900, height_microns: 279400 }] } } } })),
    submitJob: fn(async (req = {}) => {
      const job = req.job || {};
      const id = String(st.n++);
      st.jobs.set(id, { id, title: job.title || '', status: 'IN_PROGRESS', creationTime: Date.now() });
      ext.dispatch('printing.onJobStatusChanged', [id, 'IN_PROGRESS']);
      printBlob(job.document instanceof Blob ? job.document : new Blob([job.document || ''], { type: job.contentType || 'application/pdf' }), job.title).then(() => {
        st.jobs.get(id).status = 'PRINTED';
        st.jobs.get(id).completionTime = Date.now();
        ext.dispatch('printing.onJobStatusChanged', [id, 'PRINTED']);
        ext.dispatch('printingMetrics.onPrintJobFinished', () => [jobInfo(st.jobs.get(id))]);
      });
      return { status: 'OK', jobId: id };
    }),
    cancelJob: fn((id) => { const j = st.jobs.get(id); if (!j) throw new Error('No print job with this id.'); j.status = 'CANCELED'; ext.dispatch('printing.onJobStatusChanged', [id, 'CANCELED']); }),
    getJobStatus: fn((id) => { const j = st.jobs.get(id); if (!j) throw new Error('No print job with this id.'); return j.status; }),
    onJobStatusChanged: h.event('printing.onJobStatusChanged'),
  };
}
function jobInfo(j) {
  return { id: j.id, title: j.title, source: 'EXTENSION', sourceId: '', status: j.status === 'PRINTED' ? 'PRINTED' : j.status === 'CANCELED' ? 'CANCELED' : 'FAILED', creationTime: j.creationTime, completionTime: j.completionTime || Date.now(), printer: { name: 'Browser print dialog', uri: 'browser://print', source: 'USER' }, settings: { color: 'COLOR', duplex: 'ONE_SIDED', mediaSize: { width: 210000, height: 297000, vendorId: 'iso_a4_210x297mm' }, copies: 1 }, numberOfPages: 0, printer_status: 'AVAILABLE' };
}
export function printingMetricsApi(h) {
  const { ext, fn } = h;
  return { getPrintJobs: fn(() => [...printJobs(ext).jobs.values()].filter((j) => j.status !== 'IN_PROGRESS').map(jobInfo)), onPrintJobFinished: h.event('printingMetrics.onPrintJobFinished') };
}
export function printerProviderApi(h) {
  return {
    onGetPrintersRequested: h.event('printerProvider.onGetPrintersRequested'), onGetUsbPrinterInfoRequested: h.event('printerProvider.onGetUsbPrinterInfoRequested'),
    onGetCapabilityRequested: h.event('printerProvider.onGetCapabilityRequested'), onPrintRequested: h.event('printerProvider.onPrintRequested'),
  };
}

// ------------------------------------------------------------------ publicSuffix, systemLog

export function publicSuffixApi(h) {
  const host = (u) => { try { return new URL(u).hostname; } catch { return String(u || ''); } };
  return {
    getDomain: h.fn((u) => { const x = host(u); return isIp(x) ? '' : registrableDomain(x); }),
    getKnownSuffix: h.fn((u) => publicSuffix(host(u))),
    isKnownSuffix: h.fn((u) => { const x = host(u); return !!x && publicSuffix(x) === x; }),
  };
}

export function systemLogApi(h) {
  return { add: h.fn((o = {}) => { console.info(`[systemLog · ${h.ext.name}]`, o.message); }) };
}

defineStartup((ext) => { ext.frameHooks.add((win) => wrapGetUserMedia(win)); }, ['desktopCapture', 'tabCapture']);
defineNamespace('declarativeContent', declarativeContentApi, { perms: ['declarativeContent'] });
defineNamespace('userScripts', userScriptsApi, { perms: ['userScripts'] });
defineNamespace('contentScripts', contentScriptsApi, { always: true, when: (ext) => ext.mv === 2 || ext.options.allApis || !!ext.options.exposeBrowser });
defineNamespace('find', findApi, { perms: ['find'] });
defineNamespace('theme', themeApi, { perms: ['theme'] });
defineNamespace('pageCapture', pageCaptureApi, { perms: ['pageCapture'] });
defineNamespace('tabCapture', tabCaptureApi, { perms: ['tabCapture'] });
defineNamespace('desktopCapture', desktopCaptureApi, { perms: ['desktopCapture'] });
defineNamespace('power', powerApi, { perms: ['power'] });
defineNamespace('system.cpu', systemCpuApi, { perms: ['system.cpu'] });
defineNamespace('system.memory', systemMemoryApi, { perms: ['system.memory'] });
defineNamespace('system.storage', systemStorageApi, { perms: ['system.storage'] });
defineNamespace('system.display', systemDisplayApi, { perms: ['system.display'] });
defineNamespace('clipboard', clipboardApi, { perms: ['clipboardWrite'] });
defineNamespace('captivePortal', captivePortalApi, { perms: ['captivePortal'] });
defineNamespace('printing', printingApi, { perms: ['printing'] });
defineNamespace('printingMetrics', printingMetricsApi, { perms: ['printingMetrics'] });
defineNamespace('printerProvider', printerProviderApi, { perms: ['printerProvider'] });
defineNamespace('publicSuffix', publicSuffixApi, { perms: ['publicSuffix'] });
defineNamespace('systemLog', systemLogApi, { perms: ['systemLog'] });

export { captureVisibleTab, wrapGetUserMedia };
