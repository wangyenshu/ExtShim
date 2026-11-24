// fetch / XMLHttpRequest shims for extension code:
//  - extension resources (relative URLs in extension pages, getURL() results) are served
//    from the virtual file system without touching the network (no CSP connect-src issues);
//  - cross-origin requests covered by host_permissions can go through a host adapter
//    (userscript GM_xmlhttpRequest) or a CORS proxy, emulating extension privileges.
import { matchesAny } from '../core/match.js';
import { getPermissions } from '../core/manifest.js';
import { mimeType } from '../core/util.js';

function hostAllowed(ext, url) {
  const perms = ext._perms || (ext._perms = getPermissions(ext.manifest));
  return matchesAny(perms.origins, url) || matchesAny(perms.optionalOrigins, url);
}

function crossOriginAdapter(ext, url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.origin === location.origin || !/^https?:$/.test(u.protocol)) return null;
  if (!hostAllowed(ext, u.href)) return null;
  const host = ext.options.host && ext.options.host.fetch;
  if (host) return (init) => host(u.href, init);
  const proxy = ext.options.corsProxy;
  if (proxy) {
    const target = typeof proxy === 'function' ? proxy(u.href) : proxy.includes('{url}') ? proxy.replace('{url}', encodeURIComponent(u.href)) : proxy + encodeURIComponent(u.href);
    return (init) => ext.shim.nativeFetch(target, init);
  }
  return null;
}

/**
 * @param {import('./extension.js').Extension} ext
 * @param {{win: Window, basePath: string|null}} o basePath = extension page path (null for content scripts)
 */
export function createFetch(ext, { win, basePath }) {
  const nativeFetch = win.fetch.bind(win);
  const R = win.Response || Response;
  return async function fetch(input, init) {
    const isReq = input && typeof input === 'object' && 'url' in input;
    const raw = isReq ? input.url : String(input);
    const path = ext.resolvePath(raw, basePath);
    if (path != null) {
      const blob = await ext.vfs.blob(path);
      if (!blob) throw new TypeError('Failed to fetch');
      return new R(blob, { status: 200, statusText: 'OK', headers: { 'Content-Type': mimeType(path), 'Content-Length': String(blob.size) } });
    }
    let abs = raw;
    try { abs = new URL(raw, basePath != null ? ext.virtualUrl(basePath) : win.location.href).href; } catch { /* keep */ }
    if (basePath != null && abs.startsWith(ext.baseUrl)) throw new TypeError('Failed to fetch');
    const adapter = crossOriginAdapter(ext, abs);
    if (adapter) {
      let opts = init || {};
      if (isReq) opts = { method: input.method, headers: Object.fromEntries(input.headers), body: input.method === 'GET' || input.method === 'HEAD' ? undefined : await input.text(), ...opts };
      if (opts.headers && typeof opts.headers.entries === 'function') opts = { ...opts, headers: Object.fromEntries(opts.headers.entries()) };
      try { return await adapter(opts); } catch (e) { throw new TypeError('Failed to fetch', { cause: e }); }
    }
    return nativeFetch(isReq ? input : abs, init);
  };
}

/** XMLHttpRequest subclass that serves extension files / proxied requests itself. */
export function createXHR(ext, { win, basePath }) {
  const Native = win.XMLHttpRequest;
  const fetchImpl = createFetch(ext, { win, basePath });
  const STATE = Symbol('extshim-xhr');
  class XMLHttpRequest extends Native {
    open(method, url, async = true, user, password) {
      const raw = String(url);
      const path = ext.resolvePath(raw, basePath);
      let abs = raw;
      try { abs = new URL(raw, basePath != null ? ext.virtualUrl(basePath) : win.location.href).href; } catch { /* keep */ }
      const virtual = path != null || !!crossOriginAdapter(ext, abs);
      if (!virtual) {
        this[STATE] = null;
        return super.open(method, abs, async, user, password);
      }
      this[STATE] = { method, url: raw, headers: {}, readyState: 1, status: 0, statusText: '', response: null, text: '', responseURL: '', respHeaders: {} };
      this._fire('readystatechange');
    }
    setRequestHeader(k, v) { if (this[STATE]) this[STATE].headers[k] = v; else super.setRequestHeader(k, v); }
    send(body) {
      const st = this[STATE];
      if (!st) return super.send(body);
      const type = this.responseType;
      fetchImpl(st.url, { method: st.method, headers: st.headers, body: body == null ? undefined : body })
        .then(async (r) => {
          st.status = r.status;
          st.statusText = r.statusText;
          st.responseURL = r.url || st.url;
          r.headers.forEach((v, k) => { st.respHeaders[k.toLowerCase()] = v; });
          st.readyState = 2; this._fire('readystatechange');
          if (type === 'arraybuffer') st.response = await r.arrayBuffer();
          else if (type === 'blob') st.response = await r.blob();
          else {
            st.text = await r.text();
            if (type === 'json') { try { st.response = JSON.parse(st.text); } catch { st.response = null; } } else if (type === 'document') {
              st.response = new win.DOMParser().parseFromString(st.text, /xml/.test(st.respHeaders['content-type'] || '') ? 'text/xml' : 'text/html');
            } else st.response = st.text;
          }
          st.readyState = 4;
          this._fire('readystatechange');
          this._fire('load');
          this._fire('loadend');
        })
        .catch(() => {
          st.readyState = 4;
          this._fire('readystatechange');
          this._fire('error');
          this._fire('loadend');
        });
    }
    abort() { if (this[STATE]) { this[STATE].readyState = 0; this._fire('abort'); } else super.abort(); }
    getAllResponseHeaders() {
      const st = this[STATE];
      if (!st) return super.getAllResponseHeaders();
      return Object.entries(st.respHeaders).map(([k, v]) => `${k}: ${v}`).join('\r\n') + (Object.keys(st.respHeaders).length ? '\r\n' : '');
    }
    getResponseHeader(k) { const st = this[STATE]; return st ? st.respHeaders[String(k).toLowerCase()] ?? null : super.getResponseHeader(k); }
    get readyState() { return this[STATE] ? this[STATE].readyState : super.readyState; }
    get status() { return this[STATE] ? this[STATE].status : super.status; }
    get statusText() { return this[STATE] ? this[STATE].statusText : super.statusText; }
    get response() { return this[STATE] ? this[STATE].response : super.response; }
    get responseText() { return this[STATE] ? this[STATE].text : super.responseText; }
    get responseURL() { return this[STATE] ? this[STATE].responseURL : super.responseURL; }
    get responseXML() { return this[STATE] ? (this.responseType === 'document' ? this[STATE].response : null) : super.responseXML; }
    _fire(type) {
      const E = type === 'readystatechange' ? win.Event : win.ProgressEvent || win.Event;
      this.dispatchEvent(new E(type));
    }
  }
  return XMLHttpRequest;
}
