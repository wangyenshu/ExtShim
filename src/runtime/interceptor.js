// Page network interceptor behind webRequest / declarativeNetRequest / devtools.network.
//
// Installed only when an extension needs it. It sees what a page can see of its own traffic:
//  - fetch() and XMLHttpRequest: full lifecycle, blocking, redirects, header rewriting,
//    response header rewriting and (Firefox) filterResponseData body rewriting;
//  - navigator.sendBeacon and WebSocket: blocking / redirecting;
//  - resource URLs assigned by scripts (img.src, script.src, iframe.src, link.href, ...):
//    blocking / redirecting before the request starts;
//  - everything else the page loads (parser-inserted resources): observed through
//    PerformanceObserver and reported as completed requests.

const K = Symbol('extshim-xhr');
const nativeToString = (name) => () => `function ${name}() { [native code] }`;

export function headersToArray(h) {
  const out = [];
  if (!h) return out;
  if (typeof h.forEach === 'function' && !Array.isArray(h)) h.forEach((value, name) => out.push({ name, value }));
  else if (Array.isArray(h)) for (const x of h) out.push(Array.isArray(x) ? { name: x[0], value: x[1] } : { name: x.name, value: x.value });
  else for (const k of Object.keys(h)) out.push({ name: k, value: String(h[k]) });
  return out;
}
export function arrayToHeaders(arr) {
  const h = new Headers();
  for (const x of arr || []) { try { h.append(x.name, x.value != null ? x.value : x.binaryValue ? new TextDecoder().decode(new Uint8Array(x.binaryValue)) : ''); } catch { /* forbidden header */ } }
  return h;
}
function parseRawHeaders(raw) {
  return String(raw || '').trim().split(/\r?\n/).filter(Boolean).map((l) => {
    const i = l.indexOf(':');
    return { name: l.slice(0, i).trim(), value: l.slice(i + 1).trim() };
  });
}

const INITIATOR_TYPES = { img: 'image', image: 'image', script: 'script', link: 'stylesheet', css: 'image', iframe: 'sub_frame', frame: 'sub_frame', video: 'media', audio: 'media', track: 'media', beacon: 'ping', ping: 'ping', embed: 'object', object: 'object', font: 'font', navigation: 'main_frame', other: 'other', 'icon': 'image' };

export function getInterceptor(shim) {
  if (!shim.net) shim.net = new Interceptor(shim);
  return shim.net;
}

class Interceptor {
  constructor(shim) {
    this.shim = shim;
    this.clients = new Set();
    this.nextId = 1;
    this.installed = false;
    this.log = [];
    this.seen = new Set();
    this.listeners = new Set(); // (entry) => void, for devtools.network
  }

  addClient(client) {
    this.clients.add(client);
    this.install();
    return () => this.clients.delete(client);
  }

  active() { return this.clients.size > 0; }

  base(url, method, type) {
    let thirdParty = false;
    try { thirdParty = new URL(url).hostname.split('.').slice(-2).join('.') !== location.hostname.split('.').slice(-2).join('.'); } catch { /* ignore */ }
    return {
      requestId: String(this.nextId++), url, method: String(method || 'GET').toUpperCase(), frameId: 0, parentFrameId: -1, tabId: this.shim.tabId,
      windowId: this.shim.windowId, type, timeStamp: Date.now(), initiator: location.origin, originUrl: location.href, documentUrl: location.href,
      documentLifecycle: 'active', frameType: 'outermost_frame', incognito: false, thirdParty, cookieStoreId: 'firefox-default',
      urlClassification: { firstParty: [], thirdParty: [] }, frameAncestors: [],
    };
  }

  static combine(out, r, d) {
    if (!r) return;
    if (r.cancel) out.cancel = true;
    if (r.upgradeToSecure && !out.redirectUrl) out.redirectUrl = d.url.replace(/^http:/, 'https:').replace(/^ws:/, 'wss:');
    if (r.redirectUrl) out.redirectUrl = r.redirectUrl;
    if (r.requestHeaders) { out.requestHeaders = r.requestHeaders; d.requestHeaders = r.requestHeaders; }
    if (r.responseHeaders) { out.responseHeaders = r.responseHeaders; d.responseHeaders = r.responseHeaders; }
    if (r.filters) (out.filters = out.filters || []).push(...r.filters);
    if (r.authCredentials) out.authCredentials = r.authCredentials;
  }

  async decide(stage, d) {
    const out = {};
    for (const c of [...this.clients]) {
      let r;
      try { r = c.decide(stage, d, false); if (r && typeof r.then === 'function') r = await r; } catch (e) { c.ext.log.error(`webRequest ${stage}:`, e); }
      Interceptor.combine(out, r, d);
      if (out.cancel) break;
    }
    return out;
  }

  decideSync(stage, d) {
    const out = {};
    for (const c of [...this.clients]) {
      let r;
      try { r = c.decide(stage, d, true); } catch (e) { c.ext.log.error(`webRequest ${stage}:`, e); }
      if (r && typeof r.then === 'function') continue;
      Interceptor.combine(out, r, d);
      if (out.cancel) break;
    }
    return out;
  }

  notify(event, d) {
    for (const c of [...this.clients]) { try { c.notify(event, d); } catch (e) { c.ext.log.error(e); } }
    if (event === 'onCompleted' || event === 'onErrorOccurred') {
      const entry = { ...d, event, endTime: Date.now() };
      this.log.push(entry);
      if (this.log.length > 1000) this.log.shift();
      for (const fn of this.listeners) { try { fn(entry); } catch { /* ignore */ } }
    }
  }

  // ---------------------------------------------------------------- install

  install() {
    if (this.installed) return;
    this.installed = true;
    this.patchFetch();
    this.patchXHR();
    this.patchBeaconAndSockets();
    this.patchElements();
    this.observeResources();
  }

  patchFetch() {
    const self = this;
    const nativeFetch = this.shim.nativeFetch;
    const f = function fetch(input, init) { return self.handleFetch(nativeFetch, input, init); };
    Object.defineProperty(f, 'toString', { value: nativeToString('fetch') });
    try { window.fetch = f; } catch { /* non-writable */ }
  }

  async handleFetch(nativeFetch, input, init, depth = 0) {
    if (!this.active()) return nativeFetch(input, init);
    let req;
    try { req = new Request(input, init); } catch { return nativeFetch(input, init); }
    if (!/^(https?):/i.test(req.url)) return nativeFetch(req);
    const d = this.base(req.url, req.method, 'xmlhttprequest');
    d.requestHeaders = headersToArray(req.headers);
    if (init && typeof init.body === 'string') d.requestBody = { raw: [{ bytes: new TextEncoder().encode(init.body).buffer }] };
    else if (init && init.body instanceof URLSearchParams) d.requestBody = { formData: Object.fromEntries([...init.body].map(([k, v]) => [k, [v]])) };
    else if (init && typeof FormData !== 'undefined' && init.body instanceof FormData) {
      const fd = {};
      for (const [k, v] of init.body) (fd[k] = fd[k] || []).push(typeof v === 'string' ? v : v.name);
      d.requestBody = { formData: fd };
    }
    const fail = (error) => { this.notify('onErrorOccurred', { ...d, error, fromCache: false }); return new TypeError('Failed to fetch'); };
    const r1 = await this.decide('beforeRequest', d);
    if (r1.cancel) throw fail('net::ERR_BLOCKED_BY_CLIENT');
    let url = req.url;
    if (r1.redirectUrl && r1.redirectUrl !== url) {
      this.notify('onBeforeRedirect', { ...d, redirectUrl: r1.redirectUrl, statusCode: 307, statusLine: 'HTTP/1.1 307 Internal Redirect', fromCache: false, responseHeaders: [] });
      url = r1.redirectUrl;
      d.url = url;
    }
    const r2 = await this.decide('beforeSendHeaders', d);
    if (r2.cancel) throw fail('net::ERR_BLOCKED_BY_CLIENT');
    const headers = r2.requestHeaders ? arrayToHeaders(r2.requestHeaders) : req.headers;
    this.notify('onSendHeaders', { ...d, requestHeaders: headersToArray(headers) });
    let res;
    try {
      if (url === req.url && !r2.requestHeaders) res = await nativeFetch(req);
      else {
        const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.body;
        res = await nativeFetch(new Request(url, {
          method: req.method, headers, body: hasBody ? req.body : undefined, mode: req.mode === 'navigate' ? 'cors' : req.mode,
          credentials: req.credentials, cache: req.cache, redirect: req.redirect, referrer: req.referrer, referrerPolicy: req.referrerPolicy,
          integrity: req.integrity, keepalive: req.keepalive, signal: req.signal, ...(hasBody ? { duplex: 'half' } : {}),
        }));
      }
    } catch (e) {
      this.notify('onErrorOccurred', { ...d, error: e && e.name === 'AbortError' ? 'net::ERR_ABORTED' : 'net::ERR_FAILED', fromCache: false });
      throw e;
    }
    const rd = { ...d, statusCode: res.status, statusLine: `HTTP/1.1 ${res.status} ${res.statusText}`.trim(), responseHeaders: headersToArray(res.headers), fromCache: false, ip: undefined };
    const r3 = await this.decide('headersReceived', rd);
    if (r3.cancel) throw fail('net::ERR_BLOCKED_BY_CLIENT');
    if (r3.redirectUrl && depth < 5) {
      this.notify('onBeforeRedirect', { ...rd, redirectUrl: r3.redirectUrl });
      return this.handleFetch(nativeFetch, r3.redirectUrl, { method: 'GET', credentials: req.credentials, signal: req.signal }, depth + 1);
    }
    let filters = r1.filters || [];
    if (r3.responseHeaders || filters.length) res = rebuild(res, r3.responseHeaders ? arrayToHeaders(r3.responseHeaders) : null, filters);
    this.notify('onResponseStarted', rd);
    this.notify('onCompleted', rd);
    return res;
  }

  patchXHR() {
    const self = this;
    const P = XMLHttpRequest.prototype;
    const oOpen = P.open, oSend = P.send, oSet = P.setRequestHeader;
    P.open = function open(method, url, async, user, password) {
      let abs = String(url);
      try { abs = new URL(abs, location.href).href; } catch { /* keep */ }
      this[K] = { method: String(method).toUpperCase(), url: abs, async: arguments.length < 3 || async !== false, user, password, headers: [] };
      return oOpen.apply(this, arguments);
    };
    P.setRequestHeader = function setRequestHeader(name, value) {
      if (this[K]) this[K].headers.push({ name: String(name), value: String(value) });
      return oSet.call(this, name, value);
    };
    P.send = function send(body) {
      const st = this[K];
      if (!st || !self.active() || !/^https?:/i.test(st.url)) return oSend.call(this, body);
      const xhr = this;
      const d = self.base(st.url, st.method, 'xmlhttprequest');
      d.requestHeaders = st.headers.slice();
      if (typeof body === 'string') d.requestBody = { raw: [{ bytes: new TextEncoder().encode(body).buffer }] };
      const failed = () => {
        self.notify('onErrorOccurred', { ...d, error: 'net::ERR_BLOCKED_BY_CLIENT', fromCache: false });
        for (const [k, v] of [['readyState', 4], ['status', 0], ['statusText', ''], ['responseText', ''], ['response', xhr.responseType === '' || xhr.responseType === 'text' ? '' : null]]) {
          try { Object.defineProperty(xhr, k, { value: v, configurable: true }); } catch { /* ignore */ }
        }
        setTimeout(() => {
          xhr.dispatchEvent(new Event('readystatechange'));
          xhr.dispatchEvent(new ProgressEvent('error'));
          xhr.dispatchEvent(new ProgressEvent('loadend'));
        }, 0);
      };
      const watch = () => {
        xhr.addEventListener('readystatechange', () => {
          if (xhr.readyState !== 2) return;
          const hd = { ...d, statusCode: xhr.status, statusLine: `HTTP/1.1 ${xhr.status} ${xhr.statusText}`.trim(), responseHeaders: parseRawHeaders(xhr.getAllResponseHeaders()) };
          const r = self.decideSync('headersReceived', hd);
          if (r.cancel) { xhr.abort(); return; }
          if (r.responseHeaders) {
            const map = r.responseHeaders;
            xhr.getAllResponseHeaders = () => map.map((x) => `${x.name.toLowerCase()}: ${x.value}`).join('\r\n') + '\r\n';
            xhr.getResponseHeader = (n) => { const v = map.filter((x) => x.name.toLowerCase() === String(n).toLowerCase()).map((x) => x.value); return v.length ? v.join(', ') : null; };
          }
          self.notify('onResponseStarted', hd);
        });
        xhr.addEventListener('loadend', () => {
          const rd = { ...d, statusCode: xhr.status, statusLine: `HTTP/1.1 ${xhr.status} ${xhr.statusText}`.trim(), responseHeaders: parseRawHeaders(xhr.getAllResponseHeaders()), fromCache: false };
          if (xhr.status === 0) self.notify('onErrorOccurred', { ...rd, error: 'net::ERR_FAILED' });
          else self.notify('onCompleted', rd);
        }, { once: true });
      };
      const proceed = (url, headers) => {
        if (url !== st.url || headers) {
          oOpen.call(xhr, st.method, url, st.async, st.user, st.password);
          for (const x of headers || st.headers) { try { oSet.call(xhr, x.name, x.value); } catch { /* forbidden */ } }
        }
        self.notify('onSendHeaders', { ...d, url, requestHeaders: headers || st.headers });
        watch();
        try { oSend.call(xhr, body); } catch (e) { if (!st.async) throw e; }
      };
      if (!st.async) {
        const r1 = self.decideSync('beforeRequest', d);
        if (r1.cancel) { failed(); throw new DOMException('Failed to execute \'send\' on \'XMLHttpRequest\': Failed to load.', 'NetworkError'); }
        const url = r1.redirectUrl || st.url;
        const r2 = self.decideSync('beforeSendHeaders', { ...d, url });
        if (r2.cancel) { failed(); throw new DOMException('Network error', 'NetworkError'); }
        return proceed(url, r2.requestHeaders);
      }
      (async () => {
        const r1 = await self.decide('beforeRequest', d);
        if (r1.cancel) return failed();
        let url = st.url;
        if (r1.redirectUrl && r1.redirectUrl !== url) {
          self.notify('onBeforeRedirect', { ...d, redirectUrl: r1.redirectUrl, statusCode: 307, statusLine: 'HTTP/1.1 307 Internal Redirect' });
          url = r1.redirectUrl;
          d.url = url;
        }
        const r2 = await self.decide('beforeSendHeaders', d);
        if (r2.cancel) return failed();
        if (xhr.readyState !== 1) return; // aborted meanwhile
        proceed(url, r2.requestHeaders);
      })();
    };
  }

  patchBeaconAndSockets() {
    const self = this;
    if (navigator.sendBeacon) {
      const o = navigator.sendBeacon.bind(navigator);
      const f = function sendBeacon(url, data) {
        if (!self.active()) return o(url, data);
        let abs = String(url);
        try { abs = new URL(abs, location.href).href; } catch { return o(url, data); }
        const d = self.base(abs, 'POST', 'ping');
        const r = self.decideSync('beforeRequest', d);
        if (r.cancel) { self.notify('onErrorOccurred', { ...d, error: 'net::ERR_BLOCKED_BY_CLIENT' }); return true; }
        self.notify('onCompleted', { ...d, statusCode: 200, fromCache: false });
        return o(r.redirectUrl || abs, data);
      };
      Object.defineProperty(f, 'toString', { value: nativeToString('sendBeacon') });
      try { Navigator.prototype.sendBeacon = f; } catch { /* ignore */ }
    }
    if (window.WebSocket) {
      const WS = window.WebSocket;
      const Wrapped = function WebSocket(url, protocols) {
        if (!new.target) throw new TypeError("Failed to construct 'WebSocket': Please use the 'new' operator.");
        let abs = String(url);
        try { abs = new URL(abs, location.href).href.replace(/^http/, 'ws'); } catch { /* keep */ }
        if (self.active()) {
          const d = self.base(abs, 'GET', 'websocket');
          const r = self.decideSync('beforeRequest', d);
          if (r.cancel) {
            self.notify('onErrorOccurred', { ...d, error: 'net::ERR_BLOCKED_BY_CLIENT' });
            const ws = Reflect.construct(WS, ['wss://blocked.invalid/'], new.target);
            return ws;
          }
          if (r.redirectUrl) abs = r.redirectUrl;
        }
        return protocols === undefined ? Reflect.construct(WS, [abs], new.target) : Reflect.construct(WS, [abs, protocols], new.target);
      };
      Wrapped.prototype = WS.prototype;
      Object.setPrototypeOf(Wrapped, WS);
      Object.defineProperty(Wrapped, 'toString', { value: nativeToString('WebSocket') });
      try { window.WebSocket = Wrapped; } catch { /* ignore */ }
    }
  }

  isOurs(el) {
    if (!el || el.hasAttribute && el.hasAttribute('data-extshim')) return true;
    try { const root = el.getRootNode && el.getRootNode(); return !!root && root === (this.shim.ui && this.shim.ui.shadow); } catch { return false; }
  }

  /** Decide on a URL a script assigns to a resource attribute. Returns null (ok), false (block) or a new URL. */
  elementDecision(el, value, type) {
    if (!this.active() || this.isOurs(el)) return null;
    let abs;
    try { abs = new URL(String(value), document.baseURI).href; } catch { return null; }
    if (!/^https?:/i.test(abs)) return null;
    const d = this.base(abs, 'GET', type);
    const r = this.decideSync('beforeRequest', d);
    this.seen.add(abs);
    if (r.cancel) {
      this.notify('onErrorOccurred', { ...d, error: 'net::ERR_BLOCKED_BY_CLIENT', fromCache: false });
      setTimeout(() => { try { el.dispatchEvent(new Event('error')); } catch { /* ignore */ } }, 0);
      return false;
    }
    if (r.redirectUrl) { this.seen.add(r.redirectUrl); return r.redirectUrl; }
    return null;
  }

  patchElements() {
    const self = this;
    const linkType = (el) => {
      const rel = (el.getAttribute('rel') || '').toLowerCase();
      if (rel.includes('stylesheet')) return 'stylesheet';
      if (rel.includes('icon')) return 'image';
      const as = (el.getAttribute('as') || '').toLowerCase();
      return { script: 'script', style: 'stylesheet', font: 'font', image: 'image', fetch: 'xmlhttprequest' }[as] || 'other';
    };
    const targets = [
      ['HTMLScriptElement', 'src', () => 'script'], ['HTMLImageElement', 'src', () => 'image'], ['HTMLIFrameElement', 'src', () => 'sub_frame'],
      ['HTMLFrameElement', 'src', () => 'sub_frame'], ['HTMLLinkElement', 'href', linkType], ['HTMLSourceElement', 'src', () => 'media'],
      ['HTMLMediaElement', 'src', () => 'media'], ['HTMLEmbedElement', 'src', () => 'object'], ['HTMLObjectElement', 'data', () => 'object'],
      ['HTMLTrackElement', 'src', () => 'media'], ['HTMLInputElement', 'src', () => 'image'],
    ];
    const byTag = new Map();
    for (const [cls, attr, typeOf] of targets) {
      const C = window[cls];
      if (!C) continue;
      const desc = Object.getOwnPropertyDescriptor(C.prototype, attr);
      if (!desc || !desc.set) continue;
      byTag.set(cls, [attr, typeOf]);
      Object.defineProperty(C.prototype, attr, {
        ...desc,
        set(v) {
          const r = self.elementDecision(this, v, typeOf(this));
          if (r === false) { if (this instanceof HTMLIFrameElement) desc.set.call(this, 'about:blank'); return; }
          desc.set.call(this, r || v);
        },
      });
    }
    const attrOf = (el) => {
      for (const [cls, [attr, typeOf]] of byTag) { const C = window[cls]; if (C && el instanceof C) return [attr, typeOf]; }
      return null;
    };
    const oSet = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function setAttribute(name, value) {
      const a = attrOf(this);
      if (a && String(name).toLowerCase() === a[0]) {
        const r = self.elementDecision(this, value, a[1](this));
        if (r === false) return undefined;
        if (r) value = r;
      }
      return oSet.call(this, name, value);
    };
    Object.defineProperty(Element.prototype.setAttribute, 'toString', { value: nativeToString('setAttribute') });
    // Elements inserted with markup (innerHTML, parser): neutralize blocked ones as they appear.
    const mo = new MutationObserver((muts) => {
      if (!self.active()) return;
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        const els = [n, ...(n.querySelectorAll ? n.querySelectorAll('img[src],script[src],iframe[src],link[href],video[src],audio[src],source[src],embed[src],object[data]') : [])];
        for (const el of els) {
          const a = attrOf(el);
          if (!a || self.isOurs(el)) continue;
          const v = el.getAttribute(a[0]);
          if (!v) continue;
          let abs;
          try { abs = new URL(v, document.baseURI).href; } catch { continue; }
          if (self.seen.has(abs)) continue;
          const r = self.elementDecision(el, v, a[1](el));
          if (r === false) {
            if (el.localName === 'iframe') el.src = 'about:blank';
            else if (el.localName === 'img') { el.removeAttribute('srcset'); oSet.call(el, 'src', 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA='); }
            else el.remove();
          } else if (r) oSet.call(el, a[0], r);
        }
      }
    });
    const start = () => mo.observe(document.documentElement, { childList: true, subtree: true });
    if (document.documentElement) start(); else document.addEventListener('readystatechange', start, { once: true });
    // Links: main_frame / sub_frame rules apply to navigations started from the page.
    document.addEventListener('click', (e) => {
      if (!self.active() || e.defaultPrevented || e.button !== 0) return;
      const a = e.composedPath().find((x) => x && x.localName === 'a' && x.href);
      if (!a || self.isOurs(a) || !/^https?:/i.test(a.href)) return;
      const d = self.base(a.href, 'GET', 'main_frame');
      const r = self.decideSync('beforeRequest', d);
      if (r.cancel) { e.preventDefault(); self.notify('onErrorOccurred', { ...d, error: 'net::ERR_BLOCKED_BY_CLIENT' }); }
      else if (r.redirectUrl) { e.preventDefault(); if (a.target === '_blank') window.open(r.redirectUrl, '_blank', 'noopener'); else location.href = r.redirectUrl; }
    }, true);
  }

  observeResources() {
    if (typeof PerformanceObserver !== 'function') return;
    const report = (e) => {
      if (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest' || !/^https?:/.test(e.name)) return;
      const type = INITIATOR_TYPES[e.initiatorType] || 'other';
      const d = this.base(e.name, 'GET', type);
      d.timeStamp = Math.round(performance.timeOrigin + e.startTime);
      if (!this.seen.has(e.name)) this.notify('onBeforeRequest', d);
      this.seen.delete(e.name);
      const rd = { ...d, statusCode: e.responseStatus || 200, statusLine: `HTTP/1.1 ${e.responseStatus || 200}`, fromCache: e.transferSize === 0 && e.decodedBodySize > 0, responseHeaders: [] };
      this.notify('onResponseStarted', rd);
      this.notify('onCompleted', rd);
    };
    try {
      new PerformanceObserver((list) => list.getEntries().forEach(report)).observe({ type: 'resource' });
    } catch { /* ignore */ }
    // Resources loaded before ExtShim started are only recorded (for devtools.network), not reported.
    try {
      for (const e of performance.getEntriesByType('resource')) {
        this.log.push({ ...this.base(e.name, 'GET', INITIATOR_TYPES[e.initiatorType] || 'other'), event: 'onCompleted', statusCode: e.responseStatus || 200, timeStamp: Math.round(performance.timeOrigin + e.startTime), endTime: Math.round(performance.timeOrigin + e.responseEnd), size: e.decodedBodySize });
      }
    } catch { /* ignore */ }
  }
}

/** Rebuild a Response with new headers and/or a Firefox StreamFilter chain on its body. */
function rebuild(res, headers, filters) {
  if (res.type === 'opaque' || res.type === 'opaqueredirect' || res.status === 0) return res;
  let body = res.body;
  const h = new Headers(headers || res.headers);
  if (filters.length && body) {
    for (const f of filters) body = f._pipe(body);
    h.delete('content-length');
    h.delete('content-encoding');
  }
  const out = new Response(res.status === 204 || res.status === 304 ? null : body, { status: res.status, statusText: res.statusText, headers: h });
  for (const k of ['url', 'redirected', 'type']) { try { Object.defineProperty(out, k, { value: res[k] }); } catch { /* ignore */ } }
  return out;
}

/** Firefox webRequest.filterResponseData() stream filter. */
export class StreamFilter {
  constructor(requestId) {
    this.requestId = requestId;
    this.status = 'uninitialized';
    this.error = '';
    this.ondata = null; this.onstart = null; this.onstop = null; this.onerror = null;
    this._ctrl = null;
    this._closed = false;
    this._disconnected = false;
  }
  _pipe(src) {
    const f = this;
    return new ReadableStream({
      async start(ctrl) {
        f._ctrl = ctrl;
        f.status = 'transferringdata';
        try { if (f.onstart) f.onstart({}); } catch (e) { console.error(e); }
        const reader = src.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (f._disconnected || !f.ondata) { if (!f._closed) ctrl.enqueue(value); continue; }
            const data = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
            try { f.ondata({ data }); } catch (e) { console.error(e); }
          }
          f.status = 'finishedtransferringdata';
          if (f.onstop && !f._disconnected) { try { f.onstop({}); } catch (e) { console.error(e); } }
          if (!f.onstop || f._disconnected) f.close();
        } catch (e) {
          f.status = 'failed';
          f.error = String(e);
          if (f.onerror) f.onerror({});
          try { ctrl.error(e); } catch { /* ignore */ }
        }
      },
    });
  }
  write(data) {
    if (this._closed || !this._ctrl) throw new Error('StreamFilter is not ready for writing');
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    this._ctrl.enqueue(bytes);
  }
  close() { if (this._closed) return; this._closed = true; this.status = 'closed'; try { this._ctrl && this._ctrl.close(); } catch { /* ignore */ } }
  disconnect() { this._disconnected = true; this.status = 'disconnected'; }
  suspend() { this.status = 'suspended'; }
  resume() { this.status = 'transferringdata'; }
}
