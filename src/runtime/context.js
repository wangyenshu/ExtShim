// A Context is one place where extension code runs: the background, a popup, an options
// page, a content script frame... Each has its own API object and event listeners.
import { ExtEvent } from './events.js';
import { buildApi } from './api/index.js';

let nextDocId = 1;

export class Context {
  /**
   * @param {import('./extension.js').Extension} ext
   * @param {object} o
   * @param {'background'|'popup'|'options'|'tab'|'sidepanel'|'offscreen'|'frame'|'content'} o.type
   * @param {string} o.url virtual URL of the page or document
   * @param {number|null} [o.tabId]
   * @param {number} [o.frameId]
   * @param {Window|null} [o.win] window the context runs in
   * @param {import('./scope.js').World|null} [o.world]
   * @param {string} [o.path] extension path of the page ('' for content scripts)
   */
  constructor(ext, { type, url, tabId = null, frameId = 0, win = null, world = null, path = '' }) {
    this.ext = ext;
    this.type = type;
    this.url = url;
    this.path = path;
    this.tabId = tabId;
    this.frameId = frameId;
    this.win = win;
    this.world = world;
    this.documentId = 'D' + (nextDocId++).toString(16).padStart(8, '0').toUpperCase();
    this.alive = true;
    this.events = new Map();
    this.ports = new Set();
    this.cleanups = [];
    this.lastError = undefined;
    this._leChecked = true;
    this.log = ext.log;
    this.isExtensionPage = type !== 'content';
    let resolveReady;
    this.ready = new Promise((r) => { resolveReady = r; });
    this.markReady = () => resolveReady();
    this.api = buildApi(this);
    ext.contexts.add(this);
  }

  event(key) {
    let e = this.events.get(key);
    if (!e) { e = new ExtEvent(key, this.log); this.events.set(key, e); }
    return e;
  }

  assertAlive() {
    if (!this.alive) throw new Error('Extension context invalidated.');
  }

  /** MessageSender describing this context. */
  sender() {
    const s = { id: this.ext.id, url: this.url, origin: this.type === 'content' ? safeOrigin(this.url) : this.ext.origin };
    if (this.type === 'content') {
      s.tab = this.ext.pageTab();
      s.frameId = this.frameId;
      s.documentId = this.documentId;
      s.documentLifecycle = 'active';
    } else if (this.tabId != null) {
      s.tab = (this.tabId === this.ext.shim.tabId ? this.ext.pageTab() : this.ext.overlayTab(this.tabId)) || undefined;
      s.frameId = 0;
    }
    return s;
  }

  /** Run fn with runtime.lastError set (and warn if the callback never reads it). */
  withLastError(err, fn) {
    const message = err && err.message ? err.message : String(err);
    this.lastError = { message };
    this._leChecked = false;
    try { fn(); } catch (e) { this.log.error('Error in callback:', e); } finally {
      if (!this._leChecked) this.log.warn('Unchecked runtime.lastError:', message);
      this.lastError = undefined;
      this._leChecked = true;
    }
  }

  callback(cb, err, ...results) {
    if (!this.alive) return;
    if (err) this.withLastError(err, () => cb());
    else {
      try { cb(...results); } catch (e) { this.log.error('Error in callback:', e); }
    }
  }

  onDestroy(fn) { this.cleanups.push(fn); }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    for (const p of [...this.ports]) p.disconnect();
    for (const fn of this.cleanups.splice(0)) { try { fn(); } catch (e) { this.log.error(e); } }
    for (const e of this.events.values()) e.clear();
    this.ext.contexts.delete(this);
  }
}

function safeOrigin(url) {
  try { return new URL(url).origin; } catch { return 'null'; }
}
