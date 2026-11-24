// chrome.events.Event emulation.

export class ExtEvent {
  constructor(name, log) {
    this._name = name;
    this._log = log;
    this._listeners = [];
    this.addListener = this.addListener.bind(this);
    this.removeListener = this.removeListener.bind(this);
    this.hasListener = this.hasListener.bind(this);
    this.hasListeners = this.hasListeners.bind(this);
  }
  addListener(fn, ...extra) {
    if (typeof fn !== 'function') throw new TypeError(`Error in invocation of ${this._name}.addListener: listener must be a function`);
    if (!this.hasListener(fn)) this._listeners.push({ fn, extra });
  }
  removeListener(fn) {
    this._listeners = this._listeners.filter((l) => l.fn !== fn);
  }
  hasListener(fn) {
    return this._listeners.some((l) => l.fn === fn);
  }
  hasListeners() {
    return this._listeners.length > 0;
  }
  // Declarative-event API surface (unused but present so feature checks pass).
  addRules(rules, cb) { if (cb) cb(rules || []); }
  getRules(ids, cb) { const f = typeof ids === 'function' ? ids : cb; if (f) f([]); }
  removeRules(ids, cb) { const f = typeof ids === 'function' ? ids : cb; if (f) f(); }

  /** Call every listener; returns their return values. Errors are logged, not thrown. */
  dispatch(...args) {
    const results = [];
    for (const l of [...this._listeners]) {
      try {
        results.push(l.fn(...args));
      } catch (e) {
        results.push(undefined);
        (this._log || console).error(`Error in event handler for ${this._name}:`, e);
      }
    }
    return results;
  }
  /** Like dispatch, but each listener can filter itself with its extra addListener args. */
  dispatchFiltered(filter, ...args) {
    const results = [];
    for (const l of [...this._listeners]) {
      if (filter && !filter(l.extra)) continue;
      try { results.push(l.fn(...args)); } catch (e) { (this._log || console).error(`Error in event handler for ${this._name}:`, e); }
    }
    return results;
  }
  clear() { this._listeners = []; }
}

/** Run fn in a later task (simulates IPC between extension processes). */
const queue = [];
let channel = null;
export function nextTask(fn) {
  queue.push(fn);
  if (queue.length > 1) return;
  if (!channel && typeof MessageChannel === 'function') {
    channel = new MessageChannel();
    channel.port1.onmessage = flush;
  }
  if (channel) channel.port2.postMessage(0);
  else setTimeout(flush, 0);
}
function flush() {
  const jobs = queue.splice(0);
  for (const j of jobs) {
    try { j(); } catch (e) { console.error(e); }
  }
}
