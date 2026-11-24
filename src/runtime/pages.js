// Renders extension HTML pages (background, popup, options, side panel, offscreen, nested
// frames) into same-origin iframes and runs their scripts inside a frame World.
import { World } from './scope.js';
import { Context } from './context.js';
import { createFetch, createXHR } from './net.js';
import { adoptCss, escapeHtml, freshDocument, parseHtml, trustedScriptURL } from './dom.js';
import { normalizePath } from '../core/util.js';
import { NotificationsState } from './api/ui-apis.js';

const RESOURCE_ATTRS = [['img', 'src'], ['source', 'src'], ['video', 'src'], ['video', 'poster'], ['audio', 'src'], ['track', 'src'],
  ['input', 'src'], ['embed', 'src'], ['object', 'data'], ['image', 'href'], ['use', 'href'], ['link', 'href']];

/**
 * @returns {Promise<import('./context.js').Context>}
 */
export async function renderPage(ext, opts) {
  const { type, iframe, path, worker = false, search = '', hash = '', tabId = null, parentWorld = null } = opts;
  let html = opts.html ?? (await ext.vfs.text(path));
  if (html == null) {
    ext.log.error(`Extension page not found: ${path}`);
    html = `<!DOCTYPE html><html><body style="font:13px system-ui;padding:16px;color:#b00">This extension page was not found: ${escapeHtml(path)}</body></html>`;
  }
  const win = await freshDocument(iframe);
  const doc = win.document;
  const loc = { path, search, hash };
  const url = () => ext.virtualUrl(loc.path) + loc.search + loc.hash;
  const world = new World({ kind: 'frame', target: win, log: ext.log, label: path });
  const ctx = new Context(ext, { type, url: url(), tabId, win, world, path });

  // No session history is kept, so location.assign() and location.replace() behave the same.
  const navigate = (target) => {
    const p = ext.resolvePath(target, loc.path);
    if (p == null) { window.open(String(target), '_blank'); return; }
    const q = /\?[^#]*/.exec(target);
    const h = /#.*/.exec(target);
    if (p === loc.path && !q && h) { setHash(h[0]); return; }
    ctx.destroy();
    if (opts.onNavigate) opts.onNavigate(ext.virtualUrl(p) + (q ? q[0] : '') + (h ? h[0] : ''));
    renderPage(ext, { ...opts, html: null, path: p, search: q ? q[0] : '', hash: h ? h[0] : '' }).then((c) => opts.onReplaced && opts.onReplaced(c));
  };
  const setHash = (h) => {
    const oldURL = url();
    loc.hash = h ? (h.startsWith('#') ? h : '#' + h) : '';
    ctx.url = url();
    try { win.dispatchEvent(new win.HashChangeEvent('hashchange', { oldURL, newURL: url() })); } catch { /* ignore */ }
  };

  installFrameGlobals(ext, ctx, world, win, { worker, loc, url, navigate, setHash, opts, parentWorld });
  for (const hook of ext.frameHooks) { try { hook(win, ctx); } catch (e) { ext.log.error(e); } }

  // ---- build the DOM
  const { doc: parsed, manual } = parseHtml(html, win);
  const scripts = [];
  for (const s of parsed.querySelectorAll('script, extshim-script')) {
    scripts.push({ src: s.getAttribute('src'), module: /module/i.test(s.getAttribute('type') || ''), text: s.textContent, type: s.getAttribute('type') || '' });
    s.remove();
  }
  for (const el of parsed.querySelectorAll('noscript, meta[http-equiv="Content-Security-Policy" i], base')) el.remove();
  const cssList = [];
  for (const el of parsed.querySelectorAll('link[rel~="stylesheet" i], style')) {
    if (el.localName === 'style') {
      cssList.push({ css: ext.transformCss(path, el.textContent), media: el.getAttribute('media') || '' });
      el.remove();
    } else {
      const p = ext.resolvePath(el.getAttribute('href'), path);
      if (p == null) continue;
      cssList.push({ css: await ext.cssText(p), media: el.getAttribute('media') || '' });
      el.remove();
    }
  }
  for (const [tag, attr] of RESOURCE_ATTRS) {
    for (const el of parsed.getElementsByTagName(tag)) {
      const v = el.getAttribute(attr) || (attr === 'href' ? el.getAttribute('xlink:href') : null);
      if (!v || (tag === 'link' && !/icon/i.test(el.getAttribute('rel') || ''))) continue;
      const p = ext.resolvePath(v, path);
      if (p != null && ext.vfs.has(p)) {
        const frag = /#.*/.exec(v);
        el.setAttribute(attr, ext.resourceUrl(p) + (frag && tag === 'use' ? frag[0] : ''));
      }
    }
  }
  const styled = [...parsed.querySelectorAll('[style]')].map((el) => [el, ext.transformCss(path, el.getAttribute('style'))]);
  const frames = [];
  for (const f of parsed.querySelectorAll('iframe[src], frame[src]')) {
    const p = ext.resolvePath(f.getAttribute('src'), path);
    if (p != null && /\.html?$/i.test(p)) { frames.push([f, f.getAttribute('src')]); f.removeAttribute('src'); }
    else if (p != null) f.setAttribute('src', ext.resourceUrl(p));
  }
  styled.forEach(([el], i) => { el.setAttribute('data-extshim-style', String(i)); });
  frames.forEach(([el], i) => { el.setAttribute('data-extshim-frame', String(i)); });

  if (manual) {
    // Already built inside a detached document of the same realm: move nodes over.
    doc.documentElement.replaceWith(doc.adoptNode(parsed.documentElement));
  } else {
    doc.replaceChild(doc.importNode(parsed.documentElement, true), doc.documentElement);
  }
  adoptCss(doc, win, cssList.filter((c) => c.css));
  for (const el of doc.querySelectorAll('[data-extshim-style]')) {
    const css = styled[+el.getAttribute('data-extshim-style')][1];
    el.removeAttribute('data-extshim-style');
    try { el.style.cssText = css; } catch { /* ignore */ }
  }
  for (const el of doc.querySelectorAll('[data-extshim-frame]')) {
    const src = frames[+el.getAttribute('data-extshim-frame')][1];
    el.removeAttribute('data-extshim-frame');
    renderPage(ext, { type: 'frame', iframe: el, path: ext.resolvePath(src, path), search: (/\?[^#]*/.exec(src) || [''])[0], hash: (/#.*/.exec(src) || [''])[0], parentWorld: world, tabId })
      .catch((e) => ext.log.error(e));
  }

  // ---- title, links, keyboard
  if (opts.onTitle) {
    opts.onTitle(doc.title);
    const mo = new win.MutationObserver(() => opts.onTitle(doc.title));
    mo.observe(doc.head || doc.documentElement, { subtree: true, childList: true, characterData: true });
  }
  win.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    const a = e.composedPath().find((n) => n && n.localName === 'a' && n.hasAttribute && n.hasAttribute('href'));
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || /^javascript:/i.test(href)) return;
    if (href.startsWith('#')) { e.preventDefault(); setHash(href); const t = doc.getElementById(decodeURIComponent(href.slice(1))); if (t) t.scrollIntoView(); return; }
    e.preventDefault();
    const p = ext.resolvePath(href, loc.path);
    const newTab = a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey || type === 'popup' || type === 'background';
    if (p != null) {
      if (newTab) ext.openTab(ext.virtualUrl(p) + ((/\?[^#]*/.exec(href) || [''])[0]) + ((/#.*/.exec(href) || [''])[0]));
      else navigate(href);
    } else {
      window.open(new URL(href, location.href).href, '_blank', 'noopener');
    }
  });
  if (ext.state.commands) ext.state.commands.attach(win);
  if (opts.onClose && (type === 'popup' || type === 'tab' || type === 'sidepanel')) {
    win.addEventListener('keydown', (e) => { if (e.key === 'Escape' && type === 'popup' && !e.defaultPrevented) opts.onClose(); });
  }
  win.addEventListener('pagehide', () => ctx.destroy());

  // ---- run scripts with emulated parser timing
  let readyState = 'loading';
  try { Object.defineProperty(doc, 'readyState', { get: () => readyState, configurable: true }); } catch { /* ignore */ }
  for (const s of scripts) {
    if (!ctx.alive) break;
    if (s.type && !/^(module|text\/javascript|application\/javascript|javascript)$/i.test(s.type)) continue;
    if (!s.src) {
      if (s.text.trim()) ext.log.warn(`Ignored inline <script> in ${path} (extension pages do not allow inline scripts).`);
      continue;
    }
    const p = ext.resolvePath(s.src, path);
    try {
      if (p == null) await loadExternalScript(win, new URL(s.src, location.href).href, s.module);
      else if (s.module) {
        const u = await ext.unit(p, { module: true });
        if (u) world.run(u, ext.virtualUrl(p));
        else await loadModuleNative(ext, win, p);
      } else {
        world.run(await ext.unit(p), ext.virtualUrl(p));
      }
    } catch (e) {
      ext.log.error(`Failed to run ${s.src} in ${path}:`, e);
    }
  }
  if (worker) await activateWorker(ext, win);
  readyState = 'interactive';
  fire(doc, win, 'readystatechange');
  fire(doc, win, 'DOMContentLoaded', true);
  await Promise.resolve();
  readyState = 'complete';
  try { delete doc.readyState; } catch { /* ignore */ }
  fire(doc, win, 'readystatechange');
  try { win.dispatchEvent(new win.Event('load')); } catch { /* ignore */ }
  try { win.dispatchEvent(new win.PageTransitionEvent('pageshow', { persisted: false })); } catch { /* ignore */ }

  if (opts.onResize) autoSize(win, opts.onResize);
  ctx.markReady();
  return ctx;
}

function fire(doc, win, type, bubbles = false) {
  try { doc.dispatchEvent(new win.Event(type, { bubbles })); } catch { /* ignore */ }
}

function loadExternalScript(win, src, module) {
  return new Promise((res) => {
    const s = win.document.createElement('script');
    if (module) s.type = 'module';
    s.onload = s.onerror = () => res();
    s.src = trustedScriptURL(src);
    (win.document.head || win.document.documentElement).appendChild(s);
  });
}

/** Dynamic mode, no precompiled bundle: load an ES module graph natively in the iframe. */
async function loadModuleNative(ext, win, path) {
  let src;
  if (ext.vfs.kind === 'http') src = ext.vfs.url(path);
  else src = await moduleBlobUrl(ext, path, new Map());
  await loadExternalScript(win, src, true);
}

async function moduleBlobUrl(ext, path, seen) {
  if (seen.has(path)) return seen.get(path);
  seen.set(path, ext.resourceUrl(path));
  let code = await ext.vfs.text(path);
  if (code == null) throw new Error('Module not found: ' + path);
  const specs = new Set();
  const re = /(\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|\bexport\s*(?:\*|\{[^}]*\})\s*from\s*|\bimport\s*\(\s*)(['"])([^'"]+)\2/g;
  let m;
  while ((m = re.exec(code))) specs.add(m[3]);
  const map = new Map();
  for (const sp of specs) {
    if (!/^(\.{0,2}\/)/.test(sp)) continue;
    const dep = normalizePath(sp, path);
    if (ext.vfs.has(dep)) map.set(sp, await moduleBlobUrl(ext, dep, seen));
  }
  code = code.replace(re, (all, pre, q, sp) => (map.has(sp) ? pre + q + map.get(sp) + q : all));
  code = code.replace(/\bimport\.meta\.url\b/g, JSON.stringify(ext.virtualUrl(path)));
  const u = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  seen.set(path, u);
  return u;
}

async function activateWorker(ext, win) {
  for (const type of ['install', 'activate']) {
    const waits = [];
    try {
      const ev = new win.Event(type);
      ev.waitUntil = (p) => waits.push(Promise.resolve(p).catch((e) => ext.log.error(`${type} waitUntil rejected:`, e)));
      win.dispatchEvent(ev);
    } catch (e) { ext.log.error(e); }
    await Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, 5000))]);
  }
}

function autoSize(win, onResize) {
  const doc = win.document;
  const html = doc.documentElement;
  html.style.setProperty('width', 'max-content');
  html.style.setProperty('max-width', '800px');
  html.style.setProperty('min-width', '25px');
  let last = '';
  const measure = () => {
    if (!doc.documentElement) return;
    const r = html.getBoundingClientRect();
    const w = Math.min(800, Math.max(25, Math.ceil(r.width)));
    // The popup starts tiny and grows to fit (like Chrome). scrollHeight never drops below the
    // viewport, so prefer the box height when content is smaller than the current viewport.
    const vh = win.innerHeight;
    const content = r.height < vh - 1 ? r.height : Math.max(r.height, html.scrollHeight);
    const h = Math.min(600, Math.max(25, Math.ceil(content)));
    const key = w + 'x' + h;
    if (key !== last) { last = key; onResize(w, h); }
  };
  measure();
  try {
    const ro = new win.ResizeObserver(measure);
    ro.observe(html);
    if (doc.body) ro.observe(doc.body);
  } catch { setInterval(measure, 300); }
  doc.addEventListener('load', measure, true);
}

function namespacedStorage(getReal, prefix) {
  let real = null;
  try { real = getReal(); real.length; } catch { real = null; }
  const mem = new Map();
  const S = real ? {
    get: (k) => real.getItem(prefix + k), set: (k, v) => real.setItem(prefix + k, v), del: (k) => real.removeItem(prefix + k),
    keys: () => { const out = []; for (let i = 0; i < real.length; i++) { const k = real.key(i); if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length)); } return out; },
  } : { get: (k) => (mem.has(k) ? mem.get(k) : null), set: (k, v) => mem.set(k, v), del: (k) => mem.delete(k), keys: () => [...mem.keys()] };
  const api = {
    getItem: (k) => S.get(String(k)),
    setItem: (k, v) => S.set(String(k), String(v)),
    removeItem: (k) => S.del(String(k)),
    clear: () => S.keys().forEach((k) => S.del(k)),
    key: (i) => S.keys()[i] ?? null,
  };
  return new Proxy(api, {
    get(t, k) {
      if (k === 'length') return S.keys().length;
      if (typeof k === 'symbol' || k in t) return t[k];
      const v = S.get(k);
      return v === null ? undefined : v;
    },
    set(t, k, v) { S.set(String(k), String(v)); return true; },
    deleteProperty(t, k) { S.del(String(k)); return true; },
    has(t, k) { return k in t || S.get(String(k)) !== null; },
    ownKeys() { return S.keys(); },
    getOwnPropertyDescriptor(t, k) {
      if (typeof k === 'symbol') return undefined;
      const v = S.get(k);
      return v === null ? undefined : { value: v, writable: true, enumerable: true, configurable: true };
    },
  });
}

function namespacedIDB(real, prefix) {
  if (!real) return real;
  return {
    open: (name, v) => (v === undefined ? real.open(prefix + name) : real.open(prefix + name, v)),
    deleteDatabase: (name) => real.deleteDatabase(prefix + name),
    databases: async () => (await real.databases()).filter((d) => d.name.startsWith(prefix)).map((d) => ({ ...d, name: d.name.slice(prefix.length) })),
    cmp: (a, b) => real.cmp(a, b),
  };
}

function makeLocation(ext, loc, url, navigate, setHash) {
  const u = () => new URL(url());
  const L = {
    get href() { return url(); }, set href(v) { navigate(String(v)); },
    get protocol() { return ext.options.urlScheme + ':'; },
    get host() { return ext.id; }, get hostname() { return ext.id; }, get port() { return ''; },
    get origin() { return ext.origin; },
    get pathname() { return '/' + loc.path; }, set pathname(v) { navigate(String(v)); },
    get search() { return loc.search; }, set search(v) { v = String(v); navigate('/' + loc.path + (v && !v.startsWith('?') ? '?' + v : v)); },
    get hash() { return loc.hash; }, set hash(v) { setHash(String(v)); },
    get ancestorOrigins() { return []; },
    assign: (v) => navigate(String(v)),
    replace: (v) => navigate(String(v)),
    reload: () => navigate('/' + loc.path + loc.search + loc.hash),
    toString: () => url(),
    valueOf() { return L; },
  };
  void u;
  return L;
}

function makeHistory(win, loc, url, navigate) {
  const real = win.history;
  let state = null;
  const update = (s, t, u) => {
    state = s;
    if (u != null) {
      const q = /\?[^#]*/.exec(String(u));
      const h = /#.*/.exec(String(u));
      if (q) loc.search = q[0];
      loc.hash = h ? h[0] : '';
    }
  };
  return {
    get length() { return real.length; },
    get state() { return state; },
    get scrollRestoration() { return real.scrollRestoration; }, set scrollRestoration(v) { try { real.scrollRestoration = v; } catch { /* ignore */ } },
    pushState: update,
    replaceState: update,
    back: () => {}, forward: () => {}, go: (n) => { if (!n) navigate(url()); },
  };
}

function installFrameGlobals(ext, ctx, world, win, { worker, loc, url, navigate, setHash, opts, parentWorld }) {
  const api = ctx.api;
  const lsPrefix = `extshim:${ext.id}:ls:`;
  const fetch = createFetch(ext, { win, basePath: loc.path });
  const XHR = createXHR(ext, { win, basePath: loc.path });
  const localStorage = namespacedStorage(() => win.localStorage, lsPrefix);
  const sessionStorage = namespacedStorage(() => win.sessionStorage, lsPrefix);
  const indexedDB = namespacedIDB((() => { try { return win.indexedDB; } catch { return null; } })(), `extshim:${ext.id}:`);
  const close = () => { if (opts.onClose) opts.onClose(); };
  const open = (u, target, features) => {
    if (u == null || u === '') return null;
    const p = ext.resolvePath(String(u), loc.path);
    if (p != null) { ext.openTab(ext.virtualUrl(p) + ((/\?[^#]*/.exec(u) || [''])[0]) + ((/#.*/.exec(u) || [''])[0])); return null; }
    return window.open(new URL(String(u), location.href).href, target, features);
  };
  const realGlobals = { chrome: api, fetch, XMLHttpRequest: XHR, localStorage, sessionStorage, indexedDB, close, open };
  if (ext.options.exposeBrowser) realGlobals.browser = api;
  for (const [k, v] of Object.entries(realGlobals)) {
    try { Object.defineProperty(win, k, { value: v, writable: true, configurable: true, enumerable: k !== 'chrome' && k !== 'browser' }); } catch { /* locals cover it */ }
  }
  const proxy = world.proxy;
  world.define({
    ...realGlobals,
    location: makeLocation(ext, loc, url, navigate, setHash),
    history: makeHistory(win, loc, url, navigate),
    origin: ext.origin,
    top: parentWorld ? parentWorld.get('top') : proxy,
    parent: parentWorld ? parentWorld.proxy : proxy,
    opener: null,
    frameElement: null,
  });
  if (worker) {
    const registration = {
      scope: ext.baseUrl, active: { state: 'activated', scriptURL: url() }, installing: null, waiting: null,
      showNotification: async (title, o = {}) => {
        ext.shared('notifications', () => new NotificationsState(ext)).create(null, { type: 'basic', title, message: o.body || '', iconUrl: o.icon, requireInteraction: o.requireInteraction, buttons: (o.actions || []).map((a) => ({ title: a.title })) }, ctx);
      },
      getNotifications: async () => [], unregister: async () => false, update: async () => registration,
      addEventListener() {}, removeEventListener() {},
    };
    world.define({
      window: undefined,
      document: undefined,
      localStorage: undefined,
      sessionStorage: undefined,
      XMLHttpRequest: undefined,
      registration,
      serviceWorker: registration.active,
      skipWaiting: async () => {},
      clients: {
        claim: async () => {}, matchAll: async () => [], get: async () => undefined,
        openWindow: async (u) => { await api.tabs.create({ url: u }); return null; },
      },
      importScripts: (...urls) => {
        for (const u of urls) {
          const p = ext.resolvePath(String(u), loc.path);
          if (p == null) throw new Error(`importScripts: cannot load external script ${u}`);
          const unit = ext.unitSync(p);
          if (!world.run(unit, ext.virtualUrl(p))) throw new Error(`importScripts: ${p} failed`);
        }
      },
    });
  }
  void proxy;
}
