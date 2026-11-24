// Virtual file systems for extension resources.
//  - MemoryVFS: files embedded in a bundle, or unpacked from a .zip/.crx/folder upload
//  - HttpVFS:   an unpacked extension directory served over HTTP

import { unwrapClassicScript } from '../core/bundle.js';
import { base64ToBytes, mimeType, utf8 } from '../core/util.js';

class BaseVFS {
  constructor() {
    this.blobUrls = new Map(); // path -> blob: URL
    this.blobPaths = new Map(); // blob: URL -> path
    this.transform = null; // (path, text) => text, for CSS i18n + url() rewriting
  }
  pathForBlobUrl(url) { return this.blobPaths.get(url.split('#')[0]) ?? null; }
  /**
   * File contents, or null if missing. Implemented by subclasses.
   * @param {string} path
   * @returns {Promise<Uint8Array|null>}
   */
  async bytes(path) { throw new Error(`${this.constructor.name}.bytes(${path}) is not implemented`); }
  async blob(path) {
    const b = await this.bytes(path);
    if (!b) return null;
    if (this.transform && /\.css$/i.test(path)) return new Blob([this.transform(path, utf8.decode(b))], { type: 'text/css' });
    return new Blob([b], { type: mimeType(path) });
  }
  unit() { return null; }
}

export class MemoryVFS extends BaseVFS {
  /**
   * @param {Map<string, Uint8Array|string|null>} files
   * @param {Record<string, Function>} [units] precompiled units (bundle mode)
   */
  constructor(files, units = {}) {
    super();
    this.kind = 'memory';
    this.files = new Map();
    for (const [p, v] of files) this.files.set(p, v);
    this.units = units;
    this._text = new Map();
  }
  static fromBundle(files, units) {
    const m = new Map();
    for (const p of Object.keys(files)) m.set(p, files[p]);
    return new MemoryVFS(m, units);
  }
  paths() { return [...this.files.keys()]; }
  has(path) { return this.files.has(path); }
  async exists(path) { return this.files.has(path); }
  unit(key) { return this.units[key] || null; }

  textSync(path) {
    if (this._text.has(path)) return this._text.get(path);
    if (!this.files.has(path)) return null;
    let v = this.files.get(path);
    let t;
    if (v === 0 || v === null) {
      const u = this.units[path];
      t = u ? unwrapClassicScript(Function.prototype.toString.call(u)) : null;
    } else if (typeof v === 'string') t = v;
    else if (v && v.b64 != null) t = utf8.decode(base64ToBytes(v.b64));
    else t = utf8.decode(v);
    this._text.set(path, t);
    return t;
  }
  bytesSync(path) {
    if (!this.files.has(path)) return null;
    const v = this.files.get(path);
    if (v instanceof Uint8Array) return v;
    if (v && v.b64 != null) { const b = base64ToBytes(v.b64); this.files.set(path, b); return b; }
    const t = this.textSync(path);
    return t == null ? null : utf8.encode(t);
  }
  async text(path) { return this.textSync(path); }
  async bytes(path) { return this.bytesSync(path); }

  /** Synchronous URL for a resource (blob: URL created on first use). */
  url(path) {
    if (this.blobUrls.has(path)) return this.blobUrls.get(path);
    if (!this.files.has(path)) return null;
    let blob;
    if (this.transform && /\.css$/i.test(path)) blob = new Blob([this.transform(path, this.textSync(path))], { type: 'text/css' });
    else blob = new Blob([this.bytesSync(path)], { type: mimeType(path) });
    const u = URL.createObjectURL(blob);
    this.blobUrls.set(path, u);
    this.blobPaths.set(u, path);
    return u;
  }
  dispose() {
    for (const u of this.blobUrls.values()) URL.revokeObjectURL(u);
    this.blobUrls.clear();
    this.blobPaths.clear();
  }
}

export class HttpVFS extends BaseVFS {
  constructor(baseUrl) {
    super();
    this.kind = 'http';
    this.base = new URL(baseUrl, location.href).href.replace(/[^/]*$/, '');
    this.cache = new Map(); // path -> Uint8Array | null (missing)
  }
  paths() { return [...this.cache.keys()].filter((p) => this.cache.get(p)); }
  has(path) { return this.cache.get(path) !== null; } // unknown files are assumed to exist
  async bytes(path) {
    if (this.cache.has(path)) return this.cache.get(path);
    let data = null;
    try {
      const r = await fetch(this.base + path.split('/').map(encodeURIComponent).join('/'));
      if (r.ok) data = new Uint8Array(await r.arrayBuffer());
    } catch { /* missing */ }
    this.cache.set(path, data);
    return data;
  }
  async exists(path) { return !!(await this.bytes(path)); }
  async text(path) { const b = await this.bytes(path); return b ? utf8.decode(b) : null; }
  async prefetch(paths) { await Promise.all(paths.map((p) => this.bytes(p))); }
  textSync(path) {
    if (this.cache.has(path)) { const b = this.cache.get(path); return b ? utf8.decode(b) : null; }
    try {
      const x = new XMLHttpRequest();
      x.open('GET', this.base + path, false);
      x.send();
      const ok = x.status >= 200 && x.status < 300;
      this.cache.set(path, ok ? utf8.encode(x.responseText) : null);
      return ok ? x.responseText : null;
    } catch { return null; }
  }
  bytesSync(path) { return this.cache.get(path) || (this.textSync(path) != null ? this.cache.get(path) : null); }
  url(path) {
    if (this.transform && /\.css$/i.test(path) && this.cache.get(path)) {
      if (this.blobUrls.has(path)) return this.blobUrls.get(path);
      const u = URL.createObjectURL(new Blob([this.transform(path, utf8.decode(this.cache.get(path)))], { type: 'text/css' }));
      this.blobUrls.set(path, u);
      this.blobPaths.set(u, path);
      return u;
    }
    return this.base + path;
  }
  pathForHttpUrl(url) {
    return url.startsWith(this.base) ? decodeURIComponent(url.slice(this.base.length).split(/[?#]/)[0]) : null;
  }
  dispose() { for (const u of this.blobUrls.values()) URL.revokeObjectURL(u); }
}
