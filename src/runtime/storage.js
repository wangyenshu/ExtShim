// chrome.storage emulation with pluggable persistence.
//
// A backend is { name, load(area) -> Promise<object>, save(area, object) -> Promise, subscribe?(area, cb) }.
// Built-ins: IndexedDB, localStorage, memory. Userscripts plug in GM_* storage (shared across sites).

export const QUOTAS = {
  local: { QUOTA_BYTES: 10485760 },
  sync: { QUOTA_BYTES: 102400, QUOTA_BYTES_PER_ITEM: 8192, MAX_ITEMS: 512, MAX_WRITE_OPERATIONS_PER_HOUR: 1800, MAX_WRITE_OPERATIONS_PER_MINUTE: 120, MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE: 1000000 },
  session: { QUOTA_BYTES: 10485760 },
  managed: {},
};

function jsonClone(v) {
  if (v === undefined) return undefined;
  const s = JSON.stringify(v);
  return s === undefined ? undefined : JSON.parse(s);
}

export function memoryBackend() {
  const data = {};
  return { name: 'memory', load: async (a) => jsonClone(data[a] || {}), save: async (a, o) => { data[a] = jsonClone(o); } };
}

export function localStorageBackend(prefix) {
  const ls = window.localStorage;
  ls.getItem('__extshim_probe__');
  return {
    name: 'localStorage',
    load: async (a) => { try { return JSON.parse(ls.getItem(prefix + a) || '{}'); } catch { return {}; } },
    save: async (a, o) => { ls.setItem(prefix + a, JSON.stringify(o)); },
  };
}

export function indexedDBBackend(dbName) {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('areas');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('IndexedDB blocked'));
  }));
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('areas', mode);
      const req = fn(t.objectStore('areas'));
      t.oncomplete = () => res(req && req.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  };
  return {
    name: 'indexedDB',
    probe: () => open(),
    load: async (a) => (await tx('readonly', (s) => s.get(a))) || {},
    save: (a, o) => tx('readwrite', (s) => s.put(o, a)),
  };
}

export async function pickBackend(ext) {
  const opt = ext.options.storage;
  if (opt && typeof opt === 'object' && typeof opt.load === 'function') return opt;
  const host = ext.options.host && ext.options.host.storage;
  if (host && (opt === 'auto' || opt === 'host' || !opt)) return host;
  const prefix = `extshim:${ext.id}:`;
  const tries = opt === 'memory' ? ['memory'] : opt === 'localStorage' ? ['localStorage', 'memory'] : opt === 'indexedDB' ? ['indexedDB', 'memory'] : ['indexedDB', 'localStorage', 'memory'];
  for (const t of tries) {
    try {
      if (t === 'indexedDB') { const b = indexedDBBackend(prefix.slice(0, -1)); await b.probe(); return b; }
      if (t === 'localStorage') return localStorageBackend(prefix);
      return memoryBackend();
    } catch { /* try next */ }
  }
  return memoryBackend();
}

export class StorageArea {
  constructor(manager, name, { persistent = true, readOnly = false } = {}) {
    this.m = manager;
    this.name = name;
    this.persistent = persistent;
    this.readOnly = readOnly;
    this.data = {};
    this.ready = null;
    this.chain = Promise.resolve();
  }
  load() {
    if (!this.ready) {
      this.ready = (this.persistent ? this.m.backend.load(this.name) : Promise.resolve({}))
        .then((d) => { this.data = d && typeof d === 'object' ? d : {}; })
        .catch((e) => { this.m.ext.log.warn(`storage.${this.name}: could not load (${e && e.message})`); this.data = {}; });
    }
    return this.ready;
  }
  async get(keys) {
    await this.load();
    const d = this.data;
    const out = {};
    if (keys == null) Object.assign(out, d);
    else if (typeof keys === 'string') { if (keys in d) out[keys] = d[keys]; }
    else if (Array.isArray(keys)) { for (const k of keys) if (k in d) out[k] = d[k]; }
    else if (typeof keys === 'object') { for (const k of Object.keys(keys)) out[k] = k in d ? d[k] : keys[k]; }
    else throw new TypeError('Error in invocation of storage.get: invalid keys');
    return jsonClone(out);
  }
  async getKeys() { await this.load(); return Object.keys(this.data); }
  async getBytesInUse(keys) {
    await this.load();
    const list = keys == null ? Object.keys(this.data) : typeof keys === 'string' ? [keys] : keys;
    let n = 0;
    for (const k of list) if (k in this.data) n += k.length + JSON.stringify(this.data[k]).length;
    return n;
  }
  _check(next) {
    const q = QUOTAS[this.name] || {};
    if (q.QUOTA_BYTES_PER_ITEM) {
      for (const k of Object.keys(next)) if (k.length + JSON.stringify(next[k]).length > q.QUOTA_BYTES_PER_ITEM) throw new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
    }
    if (q.MAX_ITEMS && Object.keys(next).length > q.MAX_ITEMS) throw new Error('MAX_ITEMS quota exceeded');
    if (q.QUOTA_BYTES && JSON.stringify(next).length > q.QUOTA_BYTES) throw new Error('QUOTA_BYTES quota exceeded');
  }
  async _mutate(fn) {
    if (this.readOnly) throw new Error('This is a read-only store.');
    await this.load();
    const run = async () => {
      const next = { ...this.data };
      const changes = fn(next);
      if (!Object.keys(changes).length) return;
      this._check(next);
      this.data = next;
      this.m.notify(this.name, changes, true);
      if (this.persistent) {
        try { await this.m.backend.save(this.name, next); } catch (e) { this.m.ext.log.warn(`storage.${this.name}: could not persist (${e && e.message})`); }
      }
    };
    this.chain = this.chain.then(run, run);
    return this.chain;
  }
  set(items) {
    if (!items || typeof items !== 'object' || Array.isArray(items)) return Promise.reject(new TypeError('Error in invocation of storage.set: items must be an object'));
    const values = jsonClone(items);
    return this._mutate((next) => {
      const changes = {};
      for (const k of Object.keys(values)) {
        if (values[k] === undefined) continue;
        const oldValue = next[k];
        if (JSON.stringify(oldValue) === JSON.stringify(values[k])) continue;
        changes[k] = oldValue === undefined ? { newValue: values[k] } : { oldValue, newValue: values[k] };
        next[k] = values[k];
      }
      return changes;
    });
  }
  remove(keys) {
    const list = typeof keys === 'string' ? [keys] : keys || [];
    return this._mutate((next) => {
      const changes = {};
      for (const k of list) if (k in next) { changes[k] = { oldValue: next[k] }; delete next[k]; }
      return changes;
    });
  }
  clear() {
    return this._mutate((next) => {
      const changes = {};
      for (const k of Object.keys(next)) { changes[k] = { oldValue: next[k] }; delete next[k]; }
      return changes;
    });
  }
  /** Apply a change made elsewhere (another tab / userscript instance). */
  applyRemote(all) {
    const changes = {};
    const keys = new Set([...Object.keys(this.data), ...Object.keys(all)]);
    for (const k of keys) {
      const o = this.data[k], n = all[k];
      if (JSON.stringify(o) === JSON.stringify(n)) continue;
      changes[k] = {};
      if (o !== undefined) changes[k].oldValue = o;
      if (n !== undefined) changes[k].newValue = n;
    }
    this.data = jsonClone(all);
    if (Object.keys(changes).length) this.m.notify(this.name, changes, false);
  }
}

export class StorageManager {
  constructor(ext) {
    this.ext = ext;
    this.backend = null;
    this.areas = {};
    this.channel = null;
  }
  async init() {
    this.backend = await pickBackend(this.ext);
    this.areas.local = new StorageArea(this, 'local');
    this.areas.sync = new StorageArea(this, 'sync');
    this.areas.session = new StorageArea(this, 'session', { persistent: false });
    this.areas.managed = new StorageArea(this, 'managed', { persistent: false, readOnly: true });
    this.areas.__extshim = new StorageArea(this, '__extshim');
    await Promise.all(Object.values(this.areas).map((a) => a.load()));
    if (this.backend.subscribe) {
      for (const a of ['local', 'sync', '__extshim']) this.backend.subscribe(a, (all) => this.areas[a].applyRemote(all));
    } else if (typeof BroadcastChannel === 'function' && this.backend.name !== 'memory') {
      // Keep several tabs of the same site in sync.
      try {
        this.channel = new BroadcastChannel('extshim:' + this.ext.id);
        this.channel.onmessage = (e) => {
          const { area, data } = e.data || {};
          if (this.areas[area]) this.areas[area].applyRemote(data);
        };
      } catch { this.channel = null; }
    }
  }
  notify(area, changes, local) {
    if (area === '__extshim') return;
    if (local && this.channel && this.areas[area].persistent) {
      try { this.channel.postMessage({ area, data: this.areas[area].data }); } catch { /* ignore */ }
    }
    this.ext.dispatch('storage.onChanged', () => [jsonClone(changes), area], { includeContent: true });
    this.ext.dispatch(`storage.${area}.onChanged`, () => [jsonClone(changes)], { includeContent: true });
  }
  internal() { return this.areas.__extshim; }
  async exportAll() {
    const out = {};
    for (const a of ['local', 'sync']) out[a] = await this.areas[a].get(null);
    return out;
  }
  async importAll(data) {
    for (const a of ['local', 'sync']) {
      if (data && data[a] && typeof data[a] === 'object') { await this.areas[a].clear(); await this.areas[a].set(data[a]); }
    }
  }
  close() { try { this.channel && this.channel.close(); } catch { /* ignore */ } }
}
