// tabs, windows, scripting (the page ExtShim runs in is "the" tab; extension pages opened
// with tabs.create/windows.create become overlay tabs).
import { messageSender } from './core-apis.js';
import { matchesAny } from '../../core/match.js';
import { normalizePath } from '../../core/util.js';
import { captureVisibleTab } from '../capture.js';
import { groupTabs, tabGroupState, ungroupTabs } from '../tabgroups.js';

function readerMode(on) {
  const id = 'extshim-reader';
  const old = document.getElementById(id);
  if (old || on === false) { if (old) old.remove(); document.documentElement.style.overflow = ''; return false; }
  const main = document.querySelector('article, main, [role=main]') || [...document.querySelectorAll('div, section')].sort((a, b) => b.innerText.length - a.innerText.length)[0] || document.body;
  const box = document.createElement('div');
  box.id = id;
  box.style.cssText = 'position:fixed;inset:0;z-index:2147483646;overflow:auto;background:#fbfbf8;color:#222;font:19px/1.65 Georgia,serif;padding:48px 8vw';
  const close = document.createElement('button');
  close.textContent = 'Close reader view';
  close.style.cssText = 'position:fixed;top:12px;right:16px;font:13px system-ui;padding:6px 10px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer';
  close.onclick = () => readerMode(false);
  const h = document.createElement('h1');
  h.textContent = document.title;
  h.style.cssText = 'font:700 32px/1.2 system-ui,sans-serif;max-width:720px;margin:0 auto 24px';
  const content = main.cloneNode(true);
  content.querySelectorAll('script,style,nav,aside,footer,iframe,form,button,[aria-hidden=true]').forEach((n) => n.remove());
  content.style.cssText = 'max-width:720px;margin:0 auto';
  content.querySelectorAll('img').forEach((i) => { i.style.maxWidth = '100%'; i.style.height = 'auto'; });
  box.append(close, h, content);
  document.documentElement.style.overflow = 'hidden';
  document.documentElement.appendChild(box);
  return true;
}

const NO_RECEIVER = 'Could not establish connection. Receiving end does not exist.';

function tabMatches(tab, q) {
  for (const k of ['active', 'pinned', 'audible', 'muted', 'highlighted', 'discarded', 'autoDiscardable', 'status', 'index', 'windowId', 'groupId']) {
    if (q[k] === undefined || q[k] === null) continue;
    const v = k === 'muted' ? tab.mutedInfo.muted : tab[k];
    if (k === 'windowId' && q[k] === -2) continue;
    if (v !== q[k]) return false;
  }
  if (q.title && !new RegExp('^' + q.title.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(tab.title || '')) return false;
  if (q.url && !matchesAny(Array.isArray(q.url) ? q.url : [q.url], tab.url)) return false;
  return true;
}

export function tabsApi(h) {
  const { ctx, ext, fn } = h;
  const shim = ext.shim;
  const all = () => [ext.pageTab(), ...[...ext.overlays.keys()].map((id) => ext.overlayTab(id))];
  const get = (id) => {
    if (id === shim.tabId) return ext.pageTab();
    const t = ext.overlayTab(id);
    if (!t) throw new Error(`No tab with id: ${id}.`);
    return t;
  };
  const tabIdArg = (args) => (typeof args[0] === 'number' || args[0] == null ? args.shift() ?? shim.tabId : shim.tabId);
  const content = ext.content;
  const frameOf = (tabId) => {
    if (tabId != null && tabId !== shim.tabId) throw new Error(`Cannot access contents of the page. Tab ${tabId} is not scriptable.`);
    return tabId;
  };

  const api = {
    TAB_ID_NONE: -1, TAB_INDEX_NONE: -1, MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND: 2,
    query: fn((q = {}) => all().filter((t) => {
      if (q.currentWindow === false || q.lastFocusedWindow === false) return false;
      if (q.active === true && t.id !== shim.tabId) return false;
      return tabMatches(t, q);
    })),
    get: fn((id) => get(id)),
    getCurrent: fn(() => (ctx.tabId != null && ctx.tabId !== shim.tabId ? ext.overlayTab(ctx.tabId) || undefined : undefined)),
    create: fn(async (p = {}) => {
      const url = p.url || 'about:newtab';
      const path = ext.resolvePath(url, ctx.isExtensionPage ? ctx.path : null);
      if (path != null) return ext.openTab(url.startsWith(ext.baseUrl) ? url : ext.virtualUrl(path) + ((/[?#].*/.exec(url) || [''])[0]));
      const abs = new URL(url, location.href).href;
      const w = window.open(abs, '_blank');
      if (!w) ext.log.warn(`tabs.create: the browser blocked opening ${abs} (pop-up blocker).`);
      const id = shim.nextTabId();
      return { id, index: 1, windowId: shim.windowId, active: p.active !== false, highlighted: false, pinned: false, incognito: false, status: 'loading', url: abs, pendingUrl: abs, title: '', groupId: -1, discarded: false, autoDiscardable: true, mutedInfo: { muted: false }, audible: false, selected: false };
    }),
    duplicate: fn((id) => { if (id === shim.tabId) window.open(location.href, '_blank'); return get(id); }),
    update: fn((...args) => {
      const id = typeof args[0] === 'number' ? args.shift() : (ctx.tabId ?? shim.tabId);
      const props = args[0] || {};
      if (id === shim.tabId) {
        if (props.url) {
          const p = ext.resolvePath(props.url);
          if (p != null) return ext.openTab(props.url);
          setTimeout(() => { location.href = props.url; }, 0);
        }
        if (props.active) window.focus();
        return { ...ext.pageTab(), ...(props.url ? { url: props.url, pendingUrl: props.url, status: 'loading' } : {}) };
      }
      const o = ext.overlays.get(id);
      if (!o) throw new Error(`No tab with id: ${id}.`);
      if (props.active) o.panel.focus();
      return ext.overlayTab(id);
    }),
    remove: fn((ids) => {
      for (const id of Array.isArray(ids) ? ids : [ids]) {
        if (id === shim.tabId) { window.close(); continue; }
        if (!ext.closeOverlay(id)) throw new Error(`No tab with id: ${id}.`);
      }
    }),
    reload: fn((...args) => { const id = tabIdArg(args); if (id === shim.tabId) setTimeout(() => location.reload(), 0); }),
    sendMessage: messageSender(ctx, (args) => {
      const [tabId, message, options = {}] = args;
      if (typeof tabId !== 'number') throw new TypeError('Error in invocation of tabs.sendMessage: tabId must be an integer.');
      if (tabId !== shim.tabId) return Promise.reject(new Error(NO_RECEIVER));
      return ext.bus.send(ctx, message, { tabId, frameId: options.frameId, documentId: options.documentId });
    }),
    sendRequest: (...a) => api.sendMessage(...a),
    connect: (tabId, info = {}) => {
      ctx.assertAlive();
      return ext.bus.connect(ctx, { name: info.name || '', tabId: tabId === shim.tabId ? tabId : -999, frameId: info.frameId });
    },
    executeScript: fn(async (...args) => {
      const tabId = frameOf(tabIdArg(args));
      void tabId;
      const d = args[0] || {};
      const res = await content.execute(ctx, { target: { allFrames: d.allFrames, frameIds: d.frameId != null ? [d.frameId] : null }, files: d.file ? [d.file] : null, code: d.code });
      return res.map((r) => r.result);
    }),
    insertCSS: fn(async (...args) => {
      frameOf(tabIdArg(args));
      const d = args[0] || {};
      for (const f of content.targetFrames({ allFrames: d.allFrames })) await content.insertCss(f, { files: d.file ? [d.file] : [], css: d.code || '', origin: d.cssOrigin });
    }),
    removeCSS: fn(async (...args) => {
      frameOf(tabIdArg(args));
      const d = args[0] || {};
      for (const f of content.targetFrames({ allFrames: d.allFrames })) content.removeCss(f, { files: d.file ? [d.file] : [], css: d.code || '' });
    }),
    detectLanguage: fn(() => document.documentElement.lang || 'und'),
    getZoom: fn(() => 1),
    setZoom: fn(() => {}),
    getZoomSettings: fn(() => ({ mode: 'automatic', scope: 'per-origin', defaultZoomFactor: 1 })),
    setZoomSettings: fn(() => {}),
    highlight: fn(() => ({ id: shim.windowId, focused: true, type: 'normal' })),
    move: fn((id) => get(id)),
    discard: fn((id) => get(id)),
    goBack: fn(() => { history.back(); }),
    goForward: fn(() => { history.forward(); }),
    getSelected: fn(() => ext.pageTab()),
    getAllInWindow: fn(() => all()),
    captureVisibleTab: fn((a, b) => captureVisibleTab((typeof a === 'object' && a) || b || {})),
    captureTab: fn((a, b) => captureVisibleTab((typeof a === 'object' && a) || b || {})),
    group: fn((o = {}) => groupTabs(ext, o)),
    ungroup: fn((ids) => ungroupTabs(ext, ids)),
    SPLIT_VIEW_ID_NONE: -1,
    createSplit: fn((o = {}) => {
      const gs = tabGroupState(shim);
      const ids = (o.tabIds || []).slice(0, 2);
      if (ids.length !== 2) throw new Error('A split view needs exactly two tabs.');
      const id = gs.nextSplit++;
      gs.splits.set(id, ids);
      return id;
    }),
    unsplit: fn((id) => { tabGroupState(shim).splits.delete(id); }),
    warmup: fn(() => {}),
    toggleReaderMode: fn(() => { readerMode(); }),
    print: fn(() => { window.print(); }),
    printPreview: fn(() => { window.print(); }),
    saveAsPDF: fn(() => { window.print(); return 'saved'; }),
    hide: fn((ids) => (Array.isArray(ids) ? ids : [ids]).filter((id) => id !== shim.tabId)),
    show: fn(() => {}),
    moveInSuccession: fn(() => {}),
    onCreated: h.event('tabs.onCreated'),
    onUpdated: h.event('tabs.onUpdated'),
    onActivated: h.event('tabs.onActivated'),
    onActiveChanged: h.event('tabs.onActiveChanged'),
    onHighlighted: h.event('tabs.onHighlighted'),
    onHighlightChanged: h.event('tabs.onHighlightChanged'),
    onRemoved: h.event('tabs.onRemoved'),
    onReplaced: h.event('tabs.onReplaced'),
    onMoved: h.event('tabs.onMoved'),
    onAttached: h.event('tabs.onAttached'),
    onDetached: h.event('tabs.onDetached'),
    onZoomChange: h.event('tabs.onZoomChange'),
    onSelectionChanged: h.event('tabs.onSelectionChanged'),
    TabStatus: { UNLOADED: 'unloaded', LOADING: 'loading', COMPLETE: 'complete' },
    WindowType: { NORMAL: 'normal', POPUP: 'popup', PANEL: 'panel', APP: 'app', DEVTOOLS: 'devtools' },
    MutedInfoReason: { USER: 'user', CAPTURE: 'capture', EXTENSION: 'extension' },
    ZoomSettingsMode: { AUTOMATIC: 'automatic', MANUAL: 'manual', DISABLED: 'disabled' },
    ZoomSettingsScope: { PER_ORIGIN: 'per-origin', PER_TAB: 'per-tab' },
  };
  return api;
}

export function windowsApi(h) {
  const { ext, fn } = h;
  const shim = ext.shim;
  const win = (populate) => {
    const w = {
      id: shim.windowId, focused: document.hasFocus(), top: window.screenY | 0, left: window.screenX | 0,
      width: window.outerWidth || innerWidth, height: window.outerHeight || innerHeight, incognito: false, type: 'normal',
      state: document.fullscreenElement ? 'fullscreen' : 'normal', alwaysOnTop: false, sessionId: undefined,
    };
    if (populate) w.tabs = [ext.pageTab(), ...[...ext.overlays.keys()].map((id) => ext.overlayTab(id))];
    return w;
  };
  return {
    WINDOW_ID_NONE: -1, WINDOW_ID_CURRENT: -2,
    get: fn((id, o = {}) => { if (id !== shim.windowId && id !== -2) throw new Error(`No window with id: ${id}.`); return win(o && o.populate); }),
    getCurrent: fn((o = {}) => win(o && o.populate)),
    getLastFocused: fn((o = {}) => win(o && o.populate)),
    getAll: fn((o = {}) => [win(o && o.populate)]),
    create: fn(async (o = {}) => {
      const urls = o.url ? (Array.isArray(o.url) ? o.url : [o.url]) : [];
      const tabs = [];
      for (const u of urls) {
        const p = ext.resolvePath(u, '');
        if (p != null) tabs.push(await ext.openTab(ext.virtualUrl(p) + ((/[?#].*/.exec(u) || [''])[0]), { kind: o.type === 'popup' || o.type === 'panel' ? 'window' : 'tab', width: o.width, height: o.height }));
        else {
          const features = o.type === 'popup' ? `popup,width=${o.width || 600},height=${o.height || 500}${o.left != null ? ',left=' + o.left : ''}${o.top != null ? ',top=' + o.top : ''}` : '';
          window.open(new URL(u, location.href).href, '_blank', features);
        }
      }
      return { ...win(false), id: shim.nextTabId(), type: o.type || 'normal', tabs };
    }),
    update: fn(() => win(false)),
    remove: fn(() => {
      for (const [tabId, o] of ext.overlays) if (o.panel.kind === 'window') ext.closeOverlay(tabId);
    }),
    onCreated: h.event('windows.onCreated'),
    onRemoved: h.event('windows.onRemoved'),
    onFocusChanged: h.event('windows.onFocusChanged'),
    onBoundsChanged: h.event('windows.onBoundsChanged'),
    WindowType: { NORMAL: 'normal', POPUP: 'popup', PANEL: 'panel', APP: 'app', DEVTOOLS: 'devtools' },
    WindowState: { NORMAL: 'normal', MINIMIZED: 'minimized', MAXIMIZED: 'maximized', FULLSCREEN: 'fullscreen', LOCKED_FULLSCREEN: 'locked-fullscreen' },
    CreateType: { NORMAL: 'normal', POPUP: 'popup', PANEL: 'panel' },
  };
}

export function scriptingApi(h) {
  const { ctx, ext, fn } = h;
  const content = ext.content;
  const shim = ext.shim;
  const check = (target) => {
    if (!target || typeof target.tabId !== 'number') throw new TypeError('Error in invocation of scripting: target.tabId is required.');
    if (target.tabId !== shim.tabId) throw new Error(`Cannot access contents of the page. Extension manifest must request permission to access the respective host.`);
  };
  const reg = ext.shared('registeredScripts', () => ({ map: new Map(), loaded: null }));
  const internal = ext.storage.internal();
  const load = () => reg.loaded || (reg.loaded = internal.get('registeredScripts').then((r) => {
    for (const s of r.registeredScripts || []) reg.map.set(s.id, s);
  }));
  const save = () => internal.set({ registeredScripts: [...reg.map.values()].filter((s) => s.persistAcrossSessions !== false) });
  const norm = (s) => ({
    id: s.id, matches: s.matches || [], excludeMatches: s.excludeMatches || [], js: s.js || [], css: s.css || [],
    runAt: s.runAt || 'document_idle', allFrames: !!s.allFrames, world: s.world || 'ISOLATED', persistAcrossSessions: s.persistAcrossSessions !== false, matchOriginAsFallback: !!s.matchOriginAsFallback,
  });
  return {
    executeScript: fn(async (inj = {}) => {
      check(inj.target);
      if (!inj.func && !inj.files && !inj.function) throw new Error('Exactly one of \'func\' and \'files\' must be specified');
      return content.execute(ctx, {
        target: inj.target, func: inj.func || inj.function, args: inj.args || [], files: inj.files && inj.files.map((p) => normalizePath(p)), world: inj.world,
      });
    }),
    insertCSS: fn(async (inj = {}) => {
      check(inj.target);
      for (const f of content.targetFrames(inj.target)) await content.insertCss(f, { files: inj.files || [], css: inj.css || '', origin: inj.origin });
    }),
    removeCSS: fn(async (inj = {}) => {
      check(inj.target);
      for (const f of content.targetFrames(inj.target)) content.removeCss(f, { files: inj.files || [], css: inj.css || '' });
    }),
    registerContentScripts: fn(async (scripts = []) => {
      await load();
      for (const s of scripts) {
        if (!s.id || s.id.startsWith('_')) throw new Error('Invalid content script id.');
        if (reg.map.has(s.id)) throw new Error(`Duplicate script ID '${s.id}'`);
      }
      for (const s of scripts) reg.map.set(s.id, norm(s));
      await save();
    }),
    updateContentScripts: fn(async (scripts = []) => {
      await load();
      for (const s of scripts) {
        const cur = reg.map.get(s.id);
        if (!cur) throw new Error(`Content script with ID '${s.id}' does not exist or is not fully registered`);
        reg.map.set(s.id, norm({ ...cur, ...s }));
      }
      await save();
    }),
    getRegisteredContentScripts: fn(async (filter = {}) => {
      await load();
      return [...reg.map.values()].filter((s) => !filter.ids || filter.ids.includes(s.id)).map((s) => JSON.parse(JSON.stringify(s)));
    }),
    unregisterContentScripts: fn(async (filter = {}) => {
      await load();
      for (const id of filter.ids || [...reg.map.keys()]) reg.map.delete(id);
      await save();
    }),
    ExecutionWorld: { ISOLATED: 'ISOLATED', MAIN: 'MAIN' },
    StyleOrigin: { AUTHOR: 'AUTHOR', USER: 'USER' },
    RunAt: { DOCUMENT_START: 'document_start', DOCUMENT_END: 'document_end', DOCUMENT_IDLE: 'document_idle' },
  };
}
