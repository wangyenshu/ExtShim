// One loaded extension: identity, resources, contexts, and lifecycle.
import { computeExtensionId, normalizePath, parseJSONC } from '../core/util.js';
import {
  bidiInfo, formatMessage, getAction, getBackground, getOptionsPage, getSidePanel, localeCandidates,
  localizeManifest, manifestVersion, mergeMessages, pickIcon, replaceMsgTokens,
} from '../core/manifest.js';
import { Bus } from './messaging.js';
import { StorageManager } from './storage.js';
import { canEval, compileUnit } from './scope.js';
import { renderPage } from './pages.js';
import { ContentManager } from './content.js';
import { ActionState, OmniboxState, startCommands } from './api/ui-apis.js';
import { matchUrlFilters } from './api/misc-apis.js';
import { features, startupHooks } from './api/registry.js';
import { groupIdOf, splitIdOf } from './tabgroups.js';
import { manifestPermissions } from './api/index.js';

const DEFAULTS = {
  ui: { launcher: true, position: 'bottom-right' },
  storage: 'auto',
  contentScripts: 'manifest', // 'manifest' | 'all' (ignore match patterns) | false
  background: true,
  urlScheme: 'chrome-extension',
  messageSerialization: 'json',
  contextMenuModifier: 'altKey',
  corsProxy: null,
  locale: null,
  exposeBrowser: true,
  allApis: false,
  log: 'info',
  host: null,
};

function makeLogger(name, level) {
  const tag = `[ExtShim · ${name}]`;
  const silent = () => {};
  const lv = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 }[level] ?? 1;
  return {
    debug: lv <= 0 ? console.debug.bind(console, tag) : silent,
    info: lv <= 1 ? console.info.bind(console, tag) : silent,
    log: lv <= 1 ? console.log.bind(console, tag) : silent,
    warn: lv <= 2 ? console.warn.bind(console, tag) : silent,
    error: lv <= 3 ? console.error.bind(console, tag) : silent,
  };
}

export class Extension {
  constructor(shim, { vfs, manifest, id, options = {} }) {
    this.shim = shim;
    this.vfs = vfs;
    this.manifest = manifest;
    this.options = { ...DEFAULTS, ...options, ui: { ...DEFAULTS.ui, ...(options.ui || {}) } };
    this.id = this.options.id || id || computeExtensionId(manifest);
    this.mv = manifestVersion(manifest);
    this.baseUrl = `${this.options.urlScheme}://${this.id}/`;
    this.origin = `${this.options.urlScheme}://${this.id}`;
    this.log = makeLogger(manifest.name || this.id, this.options.log);
    this.contexts = new Set();
    this.bus = new Bus(this);
    this.storage = new StorageManager(this);
    this.content = new ContentManager(this);
    this.state = {};
    this.overlays = new Map(); // tabId -> {ctx, panel, url}
    this.units = new Map();
    this.cleanups = [];
    this.features = features;
    this.navHooks = new Set(); // (url) => void, called on same-document navigations
    this.frameHooks = new Set(); // (win, ctx) => void, called for every extension page frame
    this.status = 'idle';
    this.background = null;
    this._bgReady = Promise.resolve();
  }

  shared(key, init) {
    if (!(key in this.state)) this.state[key] = init();
    return this.state[key];
  }

  // ------------------------------------------------------------------ lifecycle

  async start() {
    this.status = 'starting';
    await this._loadLocales();
    this.localized = localizeManifest(this.manifest, (n) => this.getMessage(n));
    this.name = this.localized.name || this.id;
    this.log = makeLogger(this.name, this.options.log);
    this.vfs.transform = (path, css) => this.transformCss(path, css);
    this.action = getAction(this.localized);
    this.state.action = new ActionState(this);
    await this.storage.init();

    this.launcher = this.shim.ui.addExtension(this);
    this.state.action.refresh();
    this.cleanups.push(() => { this.launcher.remove(); this.shim.ui.destroyIfEmpty(); });
    this.cleanups.push(startCommands(this));
    const perms = manifestPermissions(this.manifest);
    for (const s of startupHooks()) {
      const c = s.cond;
      const ok = typeof c === 'function' ? c(this) : !c.length || this.options.allApis || c.some((p) => perms.has(p));
      if (!ok) continue;
      try { await s.fn(this); } catch (e) { this.log.error('Startup hook failed:', e); }
    }

    let resolveBg;
    this._bgReady = new Promise((r) => { resolveBg = r; });
    if (this.options.background) {
      this._startBackground().then(resolveBg, (e) => { this.log.error('Background failed to start:', e); resolveBg(); });
    } else resolveBg();

    if (this.options.contentScripts !== false) this.content.start();
    await this._bgReady;
    await this._lifecycleEvents();
    this.status = 'running';
    this.log.debug('running', this.id);
    return this;
  }

  whenBackgroundReady() { return this._bgReady; }

  async _startBackground() {
    const bg = getBackground(this.manifest);
    if (!bg) return;
    if (this.options.dynamic && this.vfs.kind === 'http' && bg.files) await this.vfs.prefetch(bg.files);
    const frame = this.shim.ui.hiddenFrame(this, 'background');
    this.cleanups.push(() => frame.remove());
    const ctx = await renderPage(this, {
      type: 'background',
      iframe: frame,
      path: bg.page || (bg.kind === 'worker' ? bg.files[0] : '_generated_background_page.html'),
      html: bg.page ? null : this._generatedBackgroundHtml(bg),
      worker: bg.kind === 'worker',
      module: bg.module,
    });
    this.background = ctx;
  }

  _generatedBackgroundHtml(bg) {
    const type = bg.module ? ' type="module"' : '';
    return '<!DOCTYPE html><html><head></head><body>' + bg.files.map((f) => `<script${type} src="/${f}"></script>`).join('') + '</body></html>';
  }

  async _lifecycleEvents() {
    const internal = this.storage.internal();
    const meta = (await internal.get('install')).install;
    const version = this.manifest.version || '0';
    if (!meta) {
      this.dispatch('runtime.onInstalled', [{ reason: 'install' }]);
    } else if (meta.version !== version) {
      this.dispatch('runtime.onInstalled', [{ reason: 'update', previousVersion: meta.version }]);
    } else {
      this.dispatch('runtime.onStartup', []);
    }
    await internal.set({ install: { version, time: (meta && meta.time) || Date.now() } });
  }

  async stop() {
    if (this.status === 'stopped') return;
    this.status = 'stopped';
    if (this.popup) this.popup.panel.close();
    for (const o of [...this.overlays.values()]) o.panel.close();
    for (const c of [...this.contexts]) c.destroy();
    for (const fn of this.cleanups.splice(0)) { try { fn(); } catch (e) { this.log.error(e); } }
    this.content.stop();
    for (const t of Object.values(this.state)) { if (t && typeof t.dispose === 'function') t.dispose(); }
    this.storage.close();
    if (this.vfs.dispose) this.vfs.dispose();
    this.shim.instances.delete(this.id);
  }

  async reload() {
    const { vfs, manifest, options } = this;
    await this.stop();
    return this.shim._start({ vfs, manifest, id: this.id, options });
  }

  // ------------------------------------------------------------------ i18n

  async _loadLocales() {
    const def = this.manifest.default_locale;
    this.messages = Object.create(null);
    this.uiLocale = (this.options.locale || navigator.language || 'en').replace('-', '_');
    if (!def) return;
    const prefs = this.options.locale ? [this.options.locale] : (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en']);
    const loaded = [];
    for (const l of localeCandidates(prefs, def)) {
      const t = await this.vfs.text(`_locales/${l}/messages.json`);
      if (t) {
        try { loaded.push(parseJSONC(t)); } catch (e) { this.log.warn(`Invalid _locales/${l}/messages.json:`, e.message); }
      }
    }
    this.messages = mergeMessages(loaded);
  }

  getMessage(name, subs) {
    return formatMessage(this.messages, name, subs, {
      '@@extension_id': this.id,
      '@@ui_locale': this.uiLocale,
      ...bidiInfo(this.uiLocale),
    });
  }

  // ------------------------------------------------------------------ URLs & resources

  virtualUrl(path) {
    return this.baseUrl + String(path || '').replace(/^\/+/, '');
  }

  /** chrome.runtime.getURL: a URL the page can actually load. */
  getURL(path) {
    path = String(path ?? '');
    const m = /^([^?#]*)(.*)$/.exec(path);
    const p = normalizePath(m[1]);
    const suffix = m[2];
    if (!p) return this.baseUrl + suffix.replace(/^\?/, '?');
    if (this.vfs.kind === 'http') return this.vfs.url(p) + suffix;
    if (this.vfs.has(p) && !/\.html?$/i.test(p) && !suffix.startsWith('?')) return this.vfs.url(p) + suffix;
    return this.virtualUrl(p) + suffix;
  }

  /** Map a URL (virtual, blob, http, or relative to an extension page) to an extension path. */
  resolvePath(url, fromPath = null) {
    if (url == null) return null;
    url = String(url).trim();
    if (!url) return null;
    if (url.startsWith(this.baseUrl)) return this._decode(url.slice(this.baseUrl.length));
    const m = /^(?:chrome|moz|ms-browser|safari-web)-extension:\/\/([^/]+)\/?(.*)$/i.exec(url);
    if (m) return m[1] === this.id || m[1] === '__MSG_@@extension_id__' ? this._decode(m[2]) : null;
    if (url.startsWith('blob:')) return this.vfs.pathForBlobUrl(url);
    if (this.vfs.kind === 'http') {
      try {
        const p = this.vfs.pathForHttpUrl(new URL(url, fromPath != null ? this.vfs.base + fromPath : location.href).href);
        if (p != null) return p;
      } catch { /* ignore */ }
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) return null;
    if (fromPath == null) return null;
    return normalizePath(url, fromPath);
  }

  _decode(s) {
    return normalizePath(s.split(/[?#]/)[0]);
  }

  /** Resource URL for a path (for <img src>, CSS url(), etc). */
  resourceUrl(path) {
    return this.vfs.url(path) || this.virtualUrl(path);
  }

  /** __MSG_ replacement and url() rewriting for extension CSS. */
  transformCss(path, css) {
    if (css == null) return '';
    if (css.includes('__MSG_')) css = replaceMsgTokens(css, (n) => this.getMessage(n));
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (all, q, u) => {
      if (/^(data|blob|https?|about):/i.test(u) || u.startsWith('#')) return all;
      const p = this.resolvePath(u, path);
      if (p == null || p === path || !this.vfs.has(p)) return all;
      return `url("${this.resourceUrl(p)}")`;
    });
  }

  /** CSS text with imported extension stylesheets inlined (constructable stylesheets reject CSS imports). */
  async cssText(path, seen = new Set()) {
    if (seen.has(path)) return '';
    seen.add(path);
    const raw = await this.vfs.text(path);
    if (raw == null) return '';
    let css = this.transformCss(path, raw);
    const imports = [];
    css = css.replace(/@import\s+(?:url\()?\s*(['"]?)([^'")\s;]+)\1\s*\)?([^;]*);/g, (all, q, u, media) => {
      const p = this.resolvePath(u, path) ?? this.vfs.pathForBlobUrl(u);
      if (p == null) return all;
      imports.push([p, media.trim()]);
      return '';
    });
    let pre = '';
    for (const [p, media] of imports) {
      const t = await this.cssText(p, seen);
      pre += media ? `@media ${media}{${t}}\n` : t + '\n';
    }
    return pre + css;
  }

  /** Get a runnable unit for a classic script (precompiled in bundles, compiled on the fly otherwise). */
  async unit(path, { module = false } = {}) {
    const key = module ? 'module:' + path : path;
    const pre = this.vfs.unit(key) || (module ? null : this.vfs.unit(path));
    if (pre) return pre;
    if (module) return null;
    if (this.units.has(path)) return this.units.get(path);
    const text = await this.vfs.text(path);
    if (text == null) throw new Error(`Script not found: ${path}`);
    if (!canEval()) throw new Error(`Cannot run ${path}: this page's Content-Security-Policy blocks eval. Build a bundle with the ExtShim CLI to run here.`);
    const u = compileUnit(text, this.virtualUrl(path));
    this.units.set(path, u);
    return u;
  }

  unitSync(path) {
    const pre = this.vfs.unit(path);
    if (pre) return pre;
    if (this.units.has(path)) return this.units.get(path);
    const text = this.vfs.textSync(path);
    if (text == null) throw new Error(`Script not found: ${path}`);
    if (!canEval()) throw new Error(`Cannot run ${path}: eval is blocked by CSP.`);
    const u = compileUnit(text, this.virtualUrl(path));
    this.units.set(path, u);
    return u;
  }

  iconPath(size = 32) {
    return pickIcon(this.action && this.action.icon, size) || pickIcon(this.manifest.icons, size);
  }

  // ------------------------------------------------------------------ contexts & events

  /**
   * Dispatch an extension event to every live context listening for it.
   * @param {string} key e.g. 'alarms.onAlarm'
   * @param {any[]|(() => any[])} args (a factory gives each context fresh objects)
   */
  dispatch(key, args, { includeContent = false, only = null, exclude = null, urlFilter = null } = {}) {
    const results = [];
    for (const c of [...this.contexts]) {
      if (!c.alive || (!includeContent && !c.isExtensionPage) || (only && !only(c)) || c === exclude) continue;
      const ev = c.events.get(key);
      if (!ev || !ev.hasListeners()) continue;
      const a = typeof args === 'function' ? args() : args;
      c.ready.then(() => {
        if (!c.alive) return;
        if (urlFilter != null) ev.dispatchFiltered((extra) => matchUrlFilters(extra[0] && extra[0].url, urlFilter), ...a);
        else ev.dispatch(...a);
      });
      results.push(c);
    }
    return results;
  }

  hasListeners(key) {
    for (const c of this.contexts) { const e = c.events.get(key); if (c.alive && e && e.hasListeners()) return true; }
    return false;
  }

  views(filter = {}) {
    return [...this.contexts].filter((c) => c.alive && c.isExtensionPage && c.win && c.type !== 'offscreen' &&
      (!filter.type || c.type === filter.type || (filter.type === 'tab' && c.type === 'options') ||
        (filter.type === 'popup' && c.type === 'popup')) &&
      (filter.tabId == null || c.tabId === filter.tabId));
  }

  // ------------------------------------------------------------------ tabs

  pageTab() { return this.shim.pageTab(); }

  overlayTab(tabId) {
    const o = this.overlays.get(tabId);
    if (!o) return null;
    return {
      id: tabId, index: 1, windowId: this.shim.windowId, highlighted: false, active: false, pinned: false, audible: false,
      discarded: false, autoDiscardable: true, mutedInfo: { muted: false }, incognito: false, selected: false,
      status: 'complete', url: o.url, title: o.title || this.name, groupId: groupIdOf(this.shim, tabId), splitViewId: splitIdOf(this.shim, tabId), width: innerWidth, height: innerHeight,
    };
  }

  /** Open an extension page as an overlay "tab". */
  async openTab(url, { kind = 'tab', title = '', width, height } = {}) {
    const path = this.resolvePath(url, '') ?? normalizePath(url);
    const tabId = this.shim.nextTabId();
    const q = /\?[^#]*/.exec(url);
    const h = /#.*/.exec(url);
    const panel = this.shim.ui.openPanel(this, kind, {
      title: title || this.name,
      width, height,
      onClose: () => {
        const tab = this.overlayTab(tabId);
        this.overlays.delete(tabId);
        if (o.ctx) o.ctx.destroy();
        this.dispatch('tabs.onRemoved', [tabId, { windowId: this.shim.windowId, isWindowClosing: false }]);
        if (tab && features.noteClosedTab) features.noteClosedTab(this, tab);
      },
    });
    const o = { panel, url: this.virtualUrl(path) + (q ? q[0] : '') + (h ? h[0] : ''), ctx: null, title };
    this.overlays.set(tabId, o);
    o.ctx = await renderPage(this, {
      type: kind === 'side' ? 'sidepanel' : 'tab', iframe: panel.iframe, path, search: q ? q[0] : '', hash: h ? h[0] : '', tabId,
      onClose: () => panel.close(),
      onTitle: (t) => { o.title = t; panel.setTitle(t || this.name); },
      onNavigate: (u) => { o.url = u; },
    });
    this.dispatch('tabs.onCreated', () => [this.overlayTab(tabId)]);
    return this.overlayTab(tabId);
  }

  closeOverlay(tabId) {
    const o = this.overlays.get(tabId);
    if (!o) return false;
    o.panel.close();
    return true;
  }

  /** Show the toolbar popup (or fire action.onClicked when there is none). */
  async clickAction() {
    const st = this.state.action;
    const popup = st.get('popup');
    const enabled = st.get('enabled');
    if (!enabled) return;
    if (popup) return this.togglePopup(popup);
    const sp = this.state.sidePanel;
    if (sp && sp.behavior.openPanelOnActionClick) return this.openSidePanel();
    this.dispatch('action.onClicked', () => [this.pageTab()]);
    this.dispatch('browserAction.onClicked', () => [this.pageTab()]);
    this.dispatch('pageAction.onClicked', () => [this.pageTab()]);
  }

  async togglePopup(popupPath, { forceOpen = false } = {}) {
    if (this.popup) {
      if (forceOpen) return;
      this.popup.panel.close();
      return;
    }
    const path = this.resolvePath(popupPath, '') ?? normalizePath(popupPath);
    const panel = this.shim.ui.openPanel(this, 'popup', {
      anchor: this.launcher,
      onClose: () => { if (this.popup && this.popup.panel === panel) { const c = this.popup.ctx; this.popup = null; if (c) c.destroy(); } },
    });
    this.popup = { panel, ctx: null };
    const ctx = await renderPage(this, {
      type: 'popup', iframe: panel.iframe, path,
      onClose: () => panel.close(),
      onResize: (w, h) => panel.resize(w, h),
    });
    if (this.popup && this.popup.panel === panel) this.popup.ctx = ctx;
    else ctx.destroy();
  }

  async openOptions() {
    const o = getOptionsPage(this.localized);
    if (!o) throw new Error('Could not create an options page.');
    for (const [tabId, ov] of this.overlays) {
      if (this.resolvePath(ov.url) === o.path) { ov.panel.focus(); return tabId; }
    }
    await this.openTab(this.virtualUrl(o.path), { kind: o.openInTab ? 'tab' : 'dialog', title: this.name + ' — Options' });
  }

  async openDevTools() {
    if (features.openDevTools) return features.openDevTools(this);
    this.log.warn('DevTools support is not included in this build.');
  }

  openOmnibox() {
    if (!this.manifest.omnibox) return;
    this.shared('omnibox', () => new OmniboxState(this)).open();
  }

  async openSidePanel(path) {
    const sp = this.state.sidePanel;
    path = path || (sp && sp.options.path) || getSidePanel(this.localized);
    if (!path) throw new Error('No side panel is configured.');
    for (const [, ov] of this.overlays) if (ov.panel.kind === 'side') { ov.panel.close(); }
    return this.openTab(this.virtualUrl(path), { kind: 'side', title: this.name });
  }
}
