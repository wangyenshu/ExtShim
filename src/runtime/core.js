// ExtShim: run WebExtensions inside an ordinary web page.
//
//   ExtShim.load('/extensions/my-ext/')        unpacked directory served over HTTP
//   ExtShim.load('/extensions/my-ext.zip')     .zip / .crx / .xpi (URL, File, Blob, ArrayBuffer)
//   ExtShim.load(input.files)                  <input type=file webkitdirectory>
//   ExtShim.boot(bundleData)                   used by bundles generated with the CLI
import { Extension } from './extension.js';
import { UI } from './ui.js';
import { HttpVFS, MemoryVFS } from './vfs.js';
import { readZip, rootFiles } from '../core/zip.js';
import { parseJSONC } from '../core/util.js';
import { canEval } from './scope.js';
import { groupIdOf, splitIdOf } from './tabgroups.js';

const VERSION = '1.0.0';
const KEY = Symbol.for('extshim.runtime');

class ExtShimRuntime {
  constructor() {
    this.version = VERSION;
    this.instances = new Map();
    this.ui = new UI(this);
    this.tabId = 1 + Math.floor(Math.random() * 1e6);
    this.windowId = 1 + Math.floor(Math.random() * 1e3);
    this._tabCounter = this.tabId + 1;
    this.nativeFetch = window.fetch.bind(window);
    this.contextMenuModifier = 'altKey';
    this.defaultPosition = 'bottom-right';
    this._navWatching = false;
  }

  nextTabId() { return this._tabCounter++; }

  pageTab() {
    const icon = document.querySelector('link[rel~="icon" i]');
    return {
      id: this.tabId, index: 0, windowId: this.windowId, highlighted: true, active: true, pinned: false, audible: false,
      discarded: false, autoDiscardable: true, frozen: false, mutedInfo: { muted: false }, incognito: false, selected: true,
      width: innerWidth, height: innerHeight, status: document.readyState === 'complete' ? 'complete' : 'loading',
      url: location.href, title: document.title || location.href, favIconUrl: icon ? icon.href : location.origin + '/favicon.ico',
      groupId: groupIdOf(this, this.tabId), splitViewId: splitIdOf(this, this.tabId), lastAccessed: Date.now(),
    };
  }

  list() { return [...this.instances.values()]; }
  get(id) { return this.instances.get(id) || null; }
  async unload(id) { const e = this.instances.get(id); if (e) await e.stop(); }
  async unloadAll() { for (const e of this.list()) await e.stop(); }

  /** Entry point for CLI-generated bundles (precompiled units; no eval needed). */
  boot(data, options = {}) {
    const existing = window[KEY];
    if (existing && existing !== this && typeof existing.boot === 'function') return existing.boot(data, options);
    const id = (options && options.id) || data.id;
    const running = this.instances.get(id);
    if (running) {
      // Running the bookmarklet again acts like clicking the toolbar button.
      if (running.launcher) running.launcher.setVisible(true);
      if (options.reload) return running.reload();
      running.clickAction();
      return Promise.resolve(running);
    }
    const vfs = MemoryVFS.fromBundle(data.files, data.units || {});
    return this._start({ vfs, manifest: data.manifest, id: data.id, options });
  }

  /** Load an extension at runtime (needs eval to be allowed, since scripts are compiled on the fly). */
  async load(source, options = {}) {
    const existing = window[KEY];
    if (existing && existing !== this) return existing.load(source, options);
    if (!canEval()) throw new Error('ExtShim.load() needs eval, which this page\'s Content-Security-Policy blocks. Build a bundle with the ExtShim CLI instead.');
    let vfs;
    if (typeof source === 'string' || source instanceof URL) {
      const url = new URL(String(source), location.href);
      if (/\.(zip|crx|xpi)$/i.test(url.pathname)) {
        const r = await this.nativeFetch(url.href);
        if (!r.ok) throw new Error(`Could not fetch ${url.href}: HTTP ${r.status}`);
        vfs = new MemoryVFS(rootFiles(await readZip(new Uint8Array(await r.arrayBuffer()))));
      } else {
        const base = /manifest\.json$/i.test(url.pathname) ? url.href.replace(/manifest\.json(\?.*)?$/i, '') : url.href.replace(/\/?(\?.*)?$/, '/');
        vfs = new HttpVFS(base);
      }
    } else if (typeof Blob !== 'undefined' && source instanceof Blob && !(source.webkitRelativePath)) {
      vfs = new MemoryVFS(rootFiles(await readZip(new Uint8Array(await source.arrayBuffer()))));
    } else if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
      vfs = new MemoryVFS(rootFiles(await readZip(new Uint8Array(source.buffer || source))));
    } else if (source && (typeof source.length === 'number') && source[0] && typeof source[0].arrayBuffer === 'function') {
      const m = new Map();
      for (const f of Array.from(source)) m.set(f.webkitRelativePath || f.relativePath || f.name, new Uint8Array(await f.arrayBuffer()));
      vfs = new MemoryVFS(rootFiles(m));
    } else if (source instanceof Map || (source && typeof source === 'object')) {
      const m = new Map();
      const entries = source instanceof Map ? source : Object.entries(source.files || source);
      for (const [k, v] of entries) m.set(k, typeof v === 'string' ? new TextEncoder().encode(v) : v instanceof Uint8Array ? v : new Uint8Array(v));
      vfs = new MemoryVFS(rootFiles(m));
    } else throw new TypeError('ExtShim.load: unsupported source');
    const text = await vfs.text('manifest.json');
    if (text == null) throw new Error('manifest.json not found');
    const manifest = parseJSONC(text);
    return this._start({ vfs, manifest, options: { ...options, dynamic: true } });
  }

  async _start({ vfs, manifest, id, options }) {
    const ext = new Extension(this, { vfs, manifest, id, options });
    const running = this.instances.get(ext.id);
    if (running) await running.stop();
    this.instances.set(ext.id, ext);
    if (options && options.contextMenuModifier) this.contextMenuModifier = options.contextMenuModifier;
    if (options && options.ui && options.ui.position) this.defaultPosition = options.ui.position;
    this._watchNavigation();
    try {
      await ext.start();
    } catch (e) {
      ext.log.error('Failed to start:', e);
      throw e;
    }
    return ext;
  }

  _watchNavigation() {
    if (this._navWatching) return;
    this._navWatching = true;
    let url = location.href;
    let title = document.title;
    const changed = (info) => {
      for (const ext of this.instances.values()) {
        if (ext.status !== 'running') continue;
        const tab = this.pageTab();
        ext.dispatch('tabs.onUpdated', () => [this.tabId, { ...info }, { ...tab }]);
      }
    };
    const nav = () => {
      if (location.href === url) return;
      const prev = url;
      url = location.href;
      changed({ url });
      for (const ext of this.instances.values()) for (const h of ext.navHooks) { try { h(url); } catch (e) { ext.log.error(e); } }
      const hashOnly = prev.split('#')[0] === url.split('#')[0];
      for (const ext of this.instances.values()) {
        if (ext.status !== 'running') continue;
        const details = { tabId: this.tabId, frameId: 0, parentFrameId: -1, url, timeStamp: Date.now(), transitionType: 'link', transitionQualifiers: [], documentLifecycle: 'active', frameType: 'outermost_frame' };
        ext.dispatch(hashOnly ? 'webNavigation.onReferenceFragmentUpdated' : 'webNavigation.onHistoryStateUpdated', () => [{ ...details }], { urlFilter: url });
      }
    };
    const titleCheck = () => { if (document.title !== title) { title = document.title; changed({ title }); } };
    if (window.navigation && typeof window.navigation.addEventListener === 'function') window.navigation.addEventListener('navigatesuccess', () => setTimeout(nav, 0));
    window.addEventListener('popstate', nav);
    window.addEventListener('hashchange', nav);
    setInterval(() => { nav(); titleCheck(); }, 1000);
    if (document.readyState !== 'complete') {
      const fire = (key) => {
        for (const ext of this.instances.values()) {
          ext.dispatch(key, () => [{ tabId: this.tabId, frameId: 0, parentFrameId: -1, url: location.href, timeStamp: Date.now(), documentLifecycle: 'active', frameType: 'outermost_frame' }], { urlFilter: location.href });
        }
      };
      document.addEventListener('DOMContentLoaded', () => fire('webNavigation.onDOMContentLoaded'), { once: true });
      window.addEventListener('load', () => { changed({ status: 'complete' }); fire('webNavigation.onCompleted'); }, { once: true });
    }
  }
}

function getRuntime() {
  if (!window[KEY]) {
    try { Object.defineProperty(window, KEY, { value: new ExtShimRuntime(), configurable: true }); } catch { window[KEY] = new ExtShimRuntime(); }
  }
  return window[KEY];
}

const runtime = getRuntime();

// <script src="extshim.js" data-extension="./my-extension/"></script>
try {
  const cs = document.currentScript;
  if (cs && cs.dataset && cs.dataset.extension) {
    const opts = cs.dataset.options ? JSON.parse(cs.dataset.options) : {};
    runtime.load(cs.dataset.extension, opts).catch((e) => console.error('[ExtShim]', e));
  }
} catch (e) { console.error('[ExtShim]', e); }

export default runtime;
export { VERSION as version };
