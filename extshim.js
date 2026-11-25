/*! ExtShim — run WebExtensions in a web page. MIT License. */
var ExtShim = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/runtime/index.js
  var index_exports = {};
  __export(index_exports, {
    default: () => index_default
  });

  // src/core/util.js
  var te = new TextEncoder();
  var td = new TextDecoder();
  var utf8 = {
    encode: (s) => te.encode(s),
    decode: (b) => td.decode(b)
  };
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  function base64ToBytes(str) {
    str = str.replace(/[^A-Za-z0-9+/]/g, "");
    const out = new Uint8Array(Math.floor(str.length * 3 / 4));
    let o = 0;
    for (let i = 0; i < str.length; i += 4) {
      const a = B64.indexOf(str[i]), b = B64.indexOf(str[i + 1]);
      const c = i + 2 < str.length ? B64.indexOf(str[i + 2]) : 0;
      const d = i + 3 < str.length ? B64.indexOf(str[i + 3]) : 0;
      const n = a << 18 | b << 12 | c << 6 | d;
      out[o++] = n >> 16;
      if (i + 2 < str.length) out[o++] = n >> 8 & 255;
      if (i + 3 < str.length) out[o++] = n & 255;
    }
    return out.subarray(0, o);
  }
  var K = new Uint32Array([
    1116352408,
    1899447441,
    3049323471,
    3921009573,
    961987163,
    1508970993,
    2453635748,
    2870763221,
    3624381080,
    310598401,
    607225278,
    1426881987,
    1925078388,
    2162078206,
    2614888103,
    3248222580,
    3835390401,
    4022224774,
    264347078,
    604807628,
    770255983,
    1249150122,
    1555081692,
    1996064986,
    2554220882,
    2821834349,
    2952996808,
    3210313671,
    3336571891,
    3584528711,
    113926993,
    338241895,
    666307205,
    773529912,
    1294757372,
    1396182291,
    1695183700,
    1986661051,
    2177026350,
    2456956037,
    2730485921,
    2820302411,
    3259730800,
    3345764771,
    3516065817,
    3600352804,
    4094571909,
    275423344,
    430227734,
    506948616,
    659060556,
    883997877,
    958139571,
    1322822218,
    1537002063,
    1747873779,
    1955562222,
    2024104815,
    2227730452,
    2361852424,
    2428436474,
    2756734187,
    3204031479,
    3329325298
  ]);
  function sha256(bytes) {
    if (typeof bytes === "string") bytes = utf8.encode(bytes);
    const len = bytes.length;
    const padded = new Uint8Array(len + 9 + 63 >> 6 << 6);
    padded.set(bytes);
    padded[len] = 128;
    const bitLen = len * 8;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 4, bitLen >>> 0);
    dv.setUint32(padded.length - 8, Math.floor(bitLen / 4294967296));
    const H = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225]);
    const W = new Uint32Array(64);
    const rotr = (x, n) => x >>> n | x << 32 - n;
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ W[i - 15] >>> 3;
        const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ W[i - 2] >>> 10;
        W[i] = W[i - 16] + s0 + W[i - 7] + s1 >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = e & f ^ ~e & g;
        const t1 = h + S1 + ch + K[i] + W[i] >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = a & b ^ a & c ^ b & c;
        const t2 = S0 + maj >>> 0;
        h = g;
        g = f;
        f = e;
        e = d + t1 >>> 0;
        d = c;
        c = b;
        b = a;
        a = t1 + t2 >>> 0;
      }
      H[0] += a;
      H[1] += b;
      H[2] += c;
      H[3] += d;
      H[4] += e;
      H[5] += f;
      H[6] += g;
      H[7] += h;
    }
    const out = new Uint8Array(32);
    const odv = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i]);
    return out;
  }
  function computeExtensionId(manifest) {
    let input;
    if (manifest && typeof manifest.key === "string") {
      try {
        input = base64ToBytes(manifest.key);
      } catch {
        input = null;
      }
    }
    if (!input) input = utf8.encode("extshim:" + (manifest && manifest.name || "extension"));
    const digest = sha256(input);
    let id = "";
    for (let i = 0; i < 16; i++) {
      id += String.fromCharCode(97 + (digest[i] >> 4)) + String.fromCharCode(97 + (digest[i] & 15));
    }
    return id;
  }
  var MIME = {
    html: "text/html",
    htm: "text/html",
    js: "text/javascript",
    mjs: "text/javascript",
    cjs: "text/javascript",
    css: "text/css",
    json: "application/json",
    map: "application/json",
    txt: "text/plain",
    md: "text/markdown",
    xml: "application/xml",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    ico: "image/x-icon",
    bmp: "image/bmp",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    eot: "application/vnd.ms-fontobject",
    wasm: "application/wasm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    mp4: "video/mp4",
    webm: "video/webm",
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    yaml: "text/yaml",
    yml: "text/yaml",
    wat: "text/plain"
  };
  function extname(path) {
    const m = /\.([^./]+)$/.exec(path);
    return m ? m[1].toLowerCase() : "";
  }
  function mimeType(path) {
    return MIME[extname(path)] || "application/octet-stream";
  }
  function normalizePath(path, from = "") {
    if (path == null) return "";
    path = String(path).split("#")[0].split("?")[0];
    try {
      path = decodeURIComponent(path);
    } catch {
    }
    const base = path.startsWith("/") ? [] : from.split("/").slice(0, -1);
    const parts = [...base];
    for (const seg of path.split("/")) {
      if (!seg || seg === ".") continue;
      if (seg === "..") parts.pop();
      else parts.push(seg);
    }
    return parts.join("/");
  }
  function parseJSONC(text) {
    if (text.charCodeAt(0) === 65279) text = text.slice(1);
    try {
      return JSON.parse(text);
    } catch {
    }
    let out = "";
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        let j = i + 1;
        while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
        out += text.slice(i, j + 1);
        i = j;
      } else if (c === "/" && text[i + 1] === "/") {
        while (i < text.length && text[i] !== "\n") i++;
        out += "\n";
      } else if (c === "/" && text[i + 1] === "*") {
        i = text.indexOf("*/", i + 2);
        if (i < 0) break;
        i++;
      } else out += c;
    }
    return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
  }

  // src/core/match.js
  var ALL_URLS_SCHEMES = ["http", "https", "file", "ftp", "ws", "wss", "data", "urn"];
  var cache = /* @__PURE__ */ new Map();
  function escapeRe(s) {
    return s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  function compileMatchPattern(pattern) {
    if (cache.has(pattern)) return cache.get(pattern);
    let fn;
    if (pattern === "<all_urls>") {
      fn = (url) => {
        const m = /^([a-z][a-z0-9+.-]*):/i.exec(url);
        return !!m && ALL_URLS_SCHEMES.includes(m[1].toLowerCase());
      };
    } else {
      const m = /^(\*|[a-z][a-z0-9+.-]*):\/\/([^/]*)(\/.*)?$/i.exec(pattern);
      if (!m) {
        fn = () => false;
      } else {
        const scheme = m[1].toLowerCase();
        let host = m[2].toLowerCase();
        const path = m[3] || "/*";
        let port = null;
        const pm = /^(.*?)(?::(\d+|\*))?$/.exec(host);
        if (pm && !host.startsWith("[")) {
          host = pm[1];
          port = pm[2] || null;
        }
        const schemeOk = scheme === "*" ? (s) => s === "http" || s === "https" || s === "ws" || s === "wss" : (s) => s === scheme;
        let hostOk;
        if (host === "*" || scheme === "file" && host === "") hostOk = () => true;
        else if (host.startsWith("*.")) {
          const base = host.slice(2);
          hostOk = (h) => h === base || h.endsWith("." + base);
        } else hostOk = (h) => h === host;
        const pathRe = new RegExp("^" + path.split("*").map(escapeRe).join(".*") + "$");
        fn = (url) => {
          let u;
          try {
            u = new URL(url);
          } catch {
            return false;
          }
          const s = u.protocol.slice(0, -1);
          if (!schemeOk(s)) return false;
          if (s !== "file" && !hostOk(u.hostname.toLowerCase().replace(/^\[|\]$/g, ""))) return false;
          if (port && port !== "*" && (u.port || defaultPort(s)) !== port) return false;
          return pathRe.test(u.pathname + u.search);
        };
      }
    }
    cache.set(pattern, fn);
    return fn;
  }
  function defaultPort(scheme) {
    return { http: "80", https: "443", ws: "80", wss: "443", ftp: "21" }[scheme] || "";
  }
  function matchesPattern(pattern, url) {
    return compileMatchPattern(pattern)(url);
  }
  function matchesAny(patterns, url) {
    return Array.isArray(patterns) && patterns.some((p) => matchesPattern(p, url));
  }
  function matchesGlob(glob, url) {
    const re = new RegExp("^" + glob.split("").map((c) => c === "*" ? ".*" : c === "?" ? "." : escapeRe(c)).join("") + "$");
    return re.test(url);
  }
  function contentScriptMatches(entry, url) {
    if (!matchesAny(entry.matches, url)) return false;
    if (matchesAny(entry.exclude_matches || entry.excludeMatches, url)) return false;
    const inc = entry.include_globs || entry.includeGlobs;
    if (inc && inc.length && !inc.some((g) => matchesGlob(g, url))) return false;
    const exc = entry.exclude_globs || entry.excludeGlobs;
    if (exc && exc.some((g) => matchesGlob(g, url))) return false;
    return true;
  }
  function isHostPattern(value) {
    return value === "<all_urls>" || /^(\*|[a-z][a-z0-9+.-]*):\/\//i.test(value);
  }

  // src/core/manifest.js
  function manifestVersion(m) {
    return m.manifest_version === 3 ? 3 : 2;
  }
  function getBackground(m) {
    const bg = m.background;
    if (!bg) return null;
    const module = bg.type === "module";
    if (bg.service_worker) return { kind: "worker", files: [normalizePath(bg.service_worker)], module };
    if (Array.isArray(bg.scripts) && bg.scripts.length) return { kind: "scripts", files: bg.scripts.map((s) => normalizePath(s)), module };
    if (bg.page) return { kind: "page", page: normalizePath(bg.page), module: false };
    return null;
  }
  function getContentScripts(m) {
    return (m.content_scripts || []).map((cs, index) => ({
      index,
      matches: cs.matches || [],
      exclude_matches: cs.exclude_matches || [],
      include_globs: cs.include_globs || [],
      exclude_globs: cs.exclude_globs || [],
      js: (cs.js || []).map((p) => normalizePath(p)),
      css: (cs.css || []).map((p) => normalizePath(p)),
      run_at: cs.run_at || "document_idle",
      all_frames: !!cs.all_frames,
      world: (cs.world || "ISOLATED").toUpperCase()
    }));
  }
  function getAction(m) {
    const kind = m.action ? "action" : m.browser_action ? "browser_action" : m.page_action ? "page_action" : null;
    const a = kind && m[kind] || {};
    return {
      kind,
      popup: a.default_popup ? normalizePath(a.default_popup) : "",
      title: a.default_title || m.name || "",
      icon: a.default_icon || m.icons || null
    };
  }
  function getOptionsPage(m) {
    const p = m.options_ui && m.options_ui.page || m.options_page;
    return p ? { path: normalizePath(p), openInTab: m.options_page ? true : !!(m.options_ui && m.options_ui.open_in_tab) } : null;
  }
  function getSidePanel(m) {
    if (m.side_panel && m.side_panel.default_path) return normalizePath(m.side_panel.default_path);
    if (m.sidebar_action && m.sidebar_action.default_panel) return normalizePath(m.sidebar_action.default_panel);
    return "";
  }
  function pickIcon(icons, size = 32) {
    if (!icons) return "";
    if (typeof icons === "string") return normalizePath(icons);
    const sizes = Object.keys(icons).map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
    if (!sizes.length) return "";
    const best = sizes.find((s) => s >= size) || sizes[sizes.length - 1];
    return normalizePath(icons[best]);
  }
  function getPermissions(m) {
    const perms = /* @__PURE__ */ new Set();
    const origins = /* @__PURE__ */ new Set();
    const add = (list) => (list || []).forEach((p) => typeof p === "string" ? isHostPattern(p) ? origins.add(p) : perms.add(p) : null);
    add(m.permissions);
    add(m.host_permissions);
    (m.content_scripts || []).forEach((cs) => (cs.matches || []).forEach((o) => origins.add(o)));
    const optional = /* @__PURE__ */ new Set();
    const optionalOrigins = /* @__PURE__ */ new Set();
    (m.optional_permissions || []).concat(m.optional_host_permissions || []).forEach((p) => isHostPattern(p) ? optionalOrigins.add(p) : optional.add(p));
    return { permissions: [...perms], origins: [...origins], optional: [...optional], optionalOrigins: [...optionalOrigins] };
  }
  function localeCandidates(preferred, defaultLocale) {
    const out = [];
    const add = (l) => {
      if (l && !out.includes(l)) out.push(l);
    };
    for (const p of preferred) {
      const l = String(p).replace("-", "_");
      add(l);
      add(l.split("_")[0]);
    }
    add(defaultLocale);
    return out;
  }
  function mergeMessages(list) {
    const out = /* @__PURE__ */ Object.create(null);
    for (const msgs of list) {
      if (!msgs) continue;
      for (const k of Object.keys(msgs)) {
        const lk = k.toLowerCase();
        if (!(lk in out)) out[lk] = msgs[k];
      }
    }
    return out;
  }
  function formatMessage(messages, name, substitutions, predefined = {}) {
    if (name == null) return "";
    name = String(name);
    if (name.startsWith("@@")) return predefined[name] != null ? String(predefined[name]) : "";
    const entry = messages[name.toLowerCase()];
    if (!entry || typeof entry.message !== "string") return "";
    let subs = substitutions == null ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
    subs = subs.slice(0, 9).map((s) => s == null ? "" : String(s));
    const placeholders = /* @__PURE__ */ Object.create(null);
    for (const [k, v] of Object.entries(entry.placeholders || {})) placeholders[k.toLowerCase()] = v && v.content != null ? String(v.content) : "";
    const fill = (text) => text.replace(/\$(\d)/g, (_, d) => subs[d - 1] ?? "");
    let out = entry.message.replace(/\$([a-zA-Z0-9_@]+)\$/g, (m, p) => {
      const key = p.toLowerCase();
      return key in placeholders ? fill(placeholders[key]) : m;
    });
    out = out.replace(/\$\$|\$(\d)/g, (m, d) => m === "$$" ? "$" : subs[d - 1] ?? "");
    return out;
  }
  function bidiInfo(locale) {
    const rtl = /^(ar|he|fa|ur|yi|dv|ps|sd|ug|ckb)(_|$)/.test(locale || "");
    return {
      "@@bidi_dir": rtl ? "rtl" : "ltr",
      "@@bidi_reversed_dir": rtl ? "ltr" : "rtl",
      "@@bidi_start_edge": rtl ? "right" : "left",
      "@@bidi_end_edge": rtl ? "left" : "right"
    };
  }
  function replaceMsgTokens(text, getMessage) {
    return String(text).replace(/__MSG_([A-Za-z0-9_@]+?)__/g, (m, name) => {
      const v = getMessage(name);
      return v === "" && !name.startsWith("@@") ? m : v;
    });
  }
  function localizeManifest(m, getMessage) {
    const walk = (v) => {
      if (typeof v === "string") return v.includes("__MSG_") ? replaceMsgTokens(v, getMessage) : v;
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === "object") {
        const o = {};
        for (const k of Object.keys(v)) o[k] = walk(v[k]);
        return o;
      }
      return v;
    };
    return walk(m);
  }
  function parseShortcut(str, isMac) {
    if (!str || typeof str !== "string") return null;
    const parts = str.split("+").map((s) => s.trim());
    const key = parts.pop();
    const mods = { ctrl: false, alt: false, shift: false, meta: false };
    for (const p of parts) {
      const l = p.toLowerCase();
      if (l === "ctrl" || l === "command") {
        if (isMac) mods.meta = true;
        else mods.ctrl = true;
      } else if (l === "macctrl") mods.ctrl = true;
      else if (l === "alt" || l === "option") mods.alt = true;
      else if (l === "shift") mods.shift = true;
      else if (l === "search") mods.meta = true;
      else return null;
    }
    const named = {
      comma: "Comma",
      period: "Period",
      home: "Home",
      end: "End",
      pageup: "PageUp",
      pagedown: "PageDown",
      space: "Space",
      insert: "Insert",
      delete: "Delete",
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
      mediaplaypause: "MediaPlayPause",
      medianexttrack: "MediaTrackNext",
      mediaprevtrack: "MediaTrackPrevious",
      mediastop: "MediaStop"
    };
    let code;
    const lk = key.toLowerCase();
    if (/^[a-z]$/.test(lk)) code = "Key" + lk.toUpperCase();
    else if (/^[0-9]$/.test(lk)) code = "Digit" + lk;
    else if (/^f([1-9]|1[0-2])$/.test(lk)) code = lk.toUpperCase();
    else if (named[lk]) code = named[lk];
    else return null;
    return { ...mods, code, text: str };
  }
  function shortcutMatches(sc, e) {
    if (!sc) return false;
    if (!!e.ctrlKey !== sc.ctrl || !!e.altKey !== sc.alt || !!e.shiftKey !== sc.shift || !!e.metaKey !== sc.meta) return false;
    if (e.code === sc.code) return true;
    if (sc.code.startsWith("Digit") && e.code === "Numpad" + sc.code.slice(5)) return true;
    return false;
  }

  // src/runtime/events.js
  var ExtEvent = class {
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
      if (typeof fn !== "function") throw new TypeError(`Error in invocation of ${this._name}.addListener: listener must be a function`);
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
    addRules(rules, cb) {
      if (cb) cb(rules || []);
    }
    getRules(ids, cb) {
      const f = typeof ids === "function" ? ids : cb;
      if (f) f([]);
    }
    removeRules(ids, cb) {
      const f = typeof ids === "function" ? ids : cb;
      if (f) f();
    }
    /** Call every listener; returns their return values. Errors are logged, not thrown. */
    dispatch(...args) {
      const results = [];
      for (const l of [...this._listeners]) {
        try {
          results.push(l.fn(...args));
        } catch (e) {
          results.push(void 0);
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
        try {
          results.push(l.fn(...args));
        } catch (e) {
          (this._log || console).error(`Error in event handler for ${this._name}:`, e);
        }
      }
      return results;
    }
    clear() {
      this._listeners = [];
    }
  };
  var queue = [];
  var channel = null;
  function nextTask(fn) {
    queue.push(fn);
    if (queue.length > 1) return;
    if (!channel && typeof MessageChannel === "function") {
      channel = new MessageChannel();
      channel.port1.onmessage = flush;
    }
    if (channel) channel.port2.postMessage(0);
    else setTimeout(flush, 0);
  }
  function flush() {
    const jobs = queue.splice(0);
    for (const j of jobs) {
      try {
        j();
      } catch (e) {
        console.error(e);
      }
    }
  }

  // src/runtime/messaging.js
  var NO_RESPONSE = /* @__PURE__ */ Symbol("no-response");
  var NO_RECEIVER = "Could not establish connection. Receiving end does not exist.";
  function cloneMessage(v, mode = "json") {
    if (v === void 0) return void 0;
    if (mode === "structured" && typeof structuredClone === "function") return structuredClone(v);
    const s = JSON.stringify(v);
    return s === void 0 ? void 0 : JSON.parse(s);
  }
  var Bus = class {
    constructor(ext) {
      this.ext = ext;
    }
    _targets(from, target) {
      const ext = this.ext;
      return [...ext.contexts].filter((c) => {
        if (!c.alive || c === from) return false;
        if (target.tabId == null) return c.isExtensionPage;
        return c.type === "content" && c.tabId === target.tabId && (target.frameId == null || c.frameId === target.frameId) && (target.documentId == null || c.documentId === target.documentId);
      });
    }
    /** @returns {Promise<any>} resolves with the response, NO_RESPONSE, or rejects when nobody listens. */
    send(from, message, target = {}) {
      const mode = this.ext.options.messageSerialization;
      let data;
      try {
        data = cloneMessage(message, mode);
      } catch (e) {
        return Promise.reject(new Error("Could not serialize message."));
      }
      const sender = from.sender();
      return new Promise((resolve, reject) => {
        nextTask(async () => {
          if (target.tabId == null) await this.ext.whenBackgroundReady();
          const targets = this._targets(from, target);
          await Promise.all(targets.map((c) => c.ready));
          const entries = [];
          const evKey = from.userScript ? "runtime.onUserScriptMessage" : "runtime.onMessage";
          for (const c of targets) {
            const ev = c.events.get(evKey);
            if (ev && ev.hasListeners()) entries.push([c, ev]);
          }
          if (!entries.length) {
            reject(new Error(NO_RECEIVER));
            return;
          }
          let done = false;
          let pending = 0;
          const respond = (v) => {
            if (done) return;
            done = true;
            try {
              resolve(cloneMessage(v, mode));
            } catch {
              reject(new Error("Could not serialize message."));
            }
          };
          for (const [c, ev] of entries) {
            if (!c.alive) continue;
            for (const l of [...ev._listeners]) {
              let r;
              try {
                r = l.fn(cloneMessage(data, mode), { ...sender }, (v) => respond(v));
              } catch (e) {
                c.log.error("Error in event handler for runtime.onMessage:", e);
                continue;
              }
              if (r === true) pending++;
              else if (r && typeof r.then === "function") {
                pending++;
                r.then(respond, (e) => {
                  if (done) return;
                  done = true;
                  reject(new Error(e && e.message ? e.message : String(e)));
                });
              }
            }
          }
          if (!done && pending === 0) {
            done = true;
            resolve(NO_RESPONSE);
          }
        });
      });
    }
    /** Open a port from `from` to the target contexts; returns the opener's Port object. */
    connect(from, { name = "", tabId = null, frameId = null } = {}) {
      const opener = new Port(this, from, name, void 0);
      nextTask(async () => {
        if (tabId == null) await this.ext.whenBackgroundReady();
        const targets = this._targets(from, { tabId, frameId });
        await Promise.all(targets.map((c) => c.ready));
        for (const c of targets) {
          const ev = c.events.get(from.userScript ? "runtime.onUserScriptConnect" : "runtime.onConnect");
          if (!ev || !ev.hasListeners() || !opener.connected) continue;
          const rp = new Port(this, c, name, from.sender());
          rp.peers.add(opener);
          opener.peers.add(rp);
          ev.dispatch(rp.api);
        }
        opener.established = true;
        if (!opener.peers.size) opener._remoteDisconnect(NO_RECEIVER);
        else opener._flush();
      });
      return opener.api;
    }
  };
  var Port = class {
    constructor(bus, ctx, name, sender) {
      this.bus = bus;
      this.ctx = ctx;
      this.peers = /* @__PURE__ */ new Set();
      this.connected = true;
      this.established = sender !== void 0;
      this.queue = [];
      const onMessage = new ExtEvent("Port.onMessage", ctx.log);
      const onDisconnect = new ExtEvent("Port.onDisconnect", ctx.log);
      this.onMessage = onMessage;
      this.onDisconnect = onDisconnect;
      const self2 = this;
      this.api = {
        name,
        sender,
        onMessage,
        onDisconnect,
        postMessage(msg) {
          self2.post(msg);
        },
        disconnect() {
          self2.disconnect();
        }
      };
      if (sender === void 0) delete this.api.sender;
      ctx.ports.add(this);
    }
    post(msg) {
      if (!this.connected) throw new Error("Attempting to use a disconnected port object");
      const data = cloneMessage(msg, this.bus.ext.options.messageSerialization);
      if (!this.established) {
        this.queue.push(data);
        return;
      }
      for (const p of this.peers) {
        nextTask(() => {
          if (p.connected && p.ctx.alive) p.onMessage.dispatch(cloneMessage(data), p.api);
        });
      }
    }
    _flush() {
      const q = this.queue.splice(0);
      for (const m of q) this.post(m);
    }
    disconnect() {
      if (!this.connected) return;
      this.connected = false;
      this.ctx.ports.delete(this);
      for (const p of this.peers) {
        p.peers.delete(this);
        if (!p.peers.size) nextTask(() => p._remoteDisconnect());
      }
      this.peers.clear();
    }
    _remoteDisconnect(error) {
      if (!this.connected) return;
      this.connected = false;
      this.ctx.ports.delete(this);
      if (!this.ctx.alive) return;
      if (error) this.ctx.withLastError(error, () => this.onDisconnect.dispatch(this.api));
      else this.onDisconnect.dispatch(this.api);
    }
  };

  // src/runtime/storage.js
  var QUOTAS = {
    local: { QUOTA_BYTES: 10485760 },
    sync: { QUOTA_BYTES: 102400, QUOTA_BYTES_PER_ITEM: 8192, MAX_ITEMS: 512, MAX_WRITE_OPERATIONS_PER_HOUR: 1800, MAX_WRITE_OPERATIONS_PER_MINUTE: 120, MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE: 1e6 },
    session: { QUOTA_BYTES: 10485760 },
    managed: {}
  };
  function jsonClone(v) {
    if (v === void 0) return void 0;
    const s = JSON.stringify(v);
    return s === void 0 ? void 0 : JSON.parse(s);
  }
  function memoryBackend() {
    const data = {};
    return { name: "memory", load: async (a) => jsonClone(data[a] || {}), save: async (a, o) => {
      data[a] = jsonClone(o);
    } };
  }
  function localStorageBackend(prefix) {
    const ls = window.localStorage;
    ls.getItem("__extshim_probe__");
    return {
      name: "localStorage",
      load: async (a) => {
        try {
          return JSON.parse(ls.getItem(prefix + a) || "{}");
        } catch {
          return {};
        }
      },
      save: async (a, o) => {
        ls.setItem(prefix + a, JSON.stringify(o));
      }
    };
  }
  function indexedDBBackend(dbName) {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const r = indexedDB.open(dbName, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("areas");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error("IndexedDB blocked"));
    }));
    const tx = async (mode, fn) => {
      const db = await open();
      return new Promise((res, rej) => {
        const t = db.transaction("areas", mode);
        const req = fn(t.objectStore("areas"));
        t.oncomplete = () => res(req && req.result);
        t.onerror = () => rej(t.error);
        t.onabort = () => rej(t.error);
      });
    };
    return {
      name: "indexedDB",
      probe: () => open(),
      load: async (a) => await tx("readonly", (s) => s.get(a)) || {},
      save: (a, o) => tx("readwrite", (s) => s.put(o, a))
    };
  }
  async function pickBackend(ext) {
    const opt = ext.options.storage;
    if (opt && typeof opt === "object" && typeof opt.load === "function") return opt;
    const host = ext.options.host && ext.options.host.storage;
    if (host && (opt === "auto" || opt === "host" || !opt)) return host;
    const prefix = `extshim:${ext.id}:`;
    const tries = opt === "memory" ? ["memory"] : opt === "localStorage" ? ["localStorage", "memory"] : opt === "indexedDB" ? ["indexedDB", "memory"] : ["indexedDB", "localStorage", "memory"];
    for (const t of tries) {
      try {
        if (t === "indexedDB") {
          const b = indexedDBBackend(prefix.slice(0, -1));
          await b.probe();
          return b;
        }
        if (t === "localStorage") return localStorageBackend(prefix);
        return memoryBackend();
      } catch {
      }
    }
    return memoryBackend();
  }
  var StorageArea = class {
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
        this.ready = (this.persistent ? this.m.backend.load(this.name) : Promise.resolve({})).then((d) => {
          this.data = d && typeof d === "object" ? d : {};
        }).catch((e) => {
          this.m.ext.log.warn(`storage.${this.name}: could not load (${e && e.message})`);
          this.data = {};
        });
      }
      return this.ready;
    }
    async get(keys) {
      await this.load();
      const d = this.data;
      const out = {};
      if (keys == null) Object.assign(out, d);
      else if (typeof keys === "string") {
        if (keys in d) out[keys] = d[keys];
      } else if (Array.isArray(keys)) {
        for (const k of keys) if (k in d) out[k] = d[k];
      } else if (typeof keys === "object") {
        for (const k of Object.keys(keys)) out[k] = k in d ? d[k] : keys[k];
      } else throw new TypeError("Error in invocation of storage.get: invalid keys");
      return jsonClone(out);
    }
    async getKeys() {
      await this.load();
      return Object.keys(this.data);
    }
    async getBytesInUse(keys) {
      await this.load();
      const list = keys == null ? Object.keys(this.data) : typeof keys === "string" ? [keys] : keys;
      let n = 0;
      for (const k of list) if (k in this.data) n += k.length + JSON.stringify(this.data[k]).length;
      return n;
    }
    _check(next) {
      const q = QUOTAS[this.name] || {};
      if (q.QUOTA_BYTES_PER_ITEM) {
        for (const k of Object.keys(next)) if (k.length + JSON.stringify(next[k]).length > q.QUOTA_BYTES_PER_ITEM) throw new Error("QUOTA_BYTES_PER_ITEM quota exceeded");
      }
      if (q.MAX_ITEMS && Object.keys(next).length > q.MAX_ITEMS) throw new Error("MAX_ITEMS quota exceeded");
      if (q.QUOTA_BYTES && JSON.stringify(next).length > q.QUOTA_BYTES) throw new Error("QUOTA_BYTES quota exceeded");
    }
    async _mutate(fn) {
      if (this.readOnly) throw new Error("This is a read-only store.");
      await this.load();
      const run = async () => {
        const next = { ...this.data };
        const changes = fn(next);
        if (!Object.keys(changes).length) return;
        this._check(next);
        this.data = next;
        this.m.notify(this.name, changes, true);
        if (this.persistent) {
          try {
            await this.m.backend.save(this.name, next);
          } catch (e) {
            this.m.ext.log.warn(`storage.${this.name}: could not persist (${e && e.message})`);
          }
        }
      };
      this.chain = this.chain.then(run, run);
      return this.chain;
    }
    set(items) {
      if (!items || typeof items !== "object" || Array.isArray(items)) return Promise.reject(new TypeError("Error in invocation of storage.set: items must be an object"));
      const values = jsonClone(items);
      return this._mutate((next) => {
        const changes = {};
        for (const k of Object.keys(values)) {
          if (values[k] === void 0) continue;
          const oldValue = next[k];
          if (JSON.stringify(oldValue) === JSON.stringify(values[k])) continue;
          changes[k] = oldValue === void 0 ? { newValue: values[k] } : { oldValue, newValue: values[k] };
          next[k] = values[k];
        }
        return changes;
      });
    }
    remove(keys) {
      const list = typeof keys === "string" ? [keys] : keys || [];
      return this._mutate((next) => {
        const changes = {};
        for (const k of list) if (k in next) {
          changes[k] = { oldValue: next[k] };
          delete next[k];
        }
        return changes;
      });
    }
    clear() {
      return this._mutate((next) => {
        const changes = {};
        for (const k of Object.keys(next)) {
          changes[k] = { oldValue: next[k] };
          delete next[k];
        }
        return changes;
      });
    }
    /** Apply a change made elsewhere (another tab / userscript instance). */
    applyRemote(all) {
      const changes = {};
      const keys = /* @__PURE__ */ new Set([...Object.keys(this.data), ...Object.keys(all)]);
      for (const k of keys) {
        const o = this.data[k], n = all[k];
        if (JSON.stringify(o) === JSON.stringify(n)) continue;
        changes[k] = {};
        if (o !== void 0) changes[k].oldValue = o;
        if (n !== void 0) changes[k].newValue = n;
      }
      this.data = jsonClone(all);
      if (Object.keys(changes).length) this.m.notify(this.name, changes, false);
    }
  };
  var StorageManager = class {
    constructor(ext) {
      this.ext = ext;
      this.backend = null;
      this.areas = {};
      this.channel = null;
    }
    async init() {
      this.backend = await pickBackend(this.ext);
      this.areas.local = new StorageArea(this, "local");
      this.areas.sync = new StorageArea(this, "sync");
      this.areas.session = new StorageArea(this, "session", { persistent: false });
      this.areas.managed = new StorageArea(this, "managed", { persistent: false, readOnly: true });
      this.areas.__extshim = new StorageArea(this, "__extshim");
      await Promise.all(Object.values(this.areas).map((a) => a.load()));
      if (this.backend.subscribe) {
        for (const a of ["local", "sync", "__extshim"]) this.backend.subscribe(a, (all) => this.areas[a].applyRemote(all));
      } else if (typeof BroadcastChannel === "function" && this.backend.name !== "memory") {
        try {
          this.channel = new BroadcastChannel("extshim:" + this.ext.id);
          this.channel.onmessage = (e) => {
            const { area, data } = e.data || {};
            if (this.areas[area]) this.areas[area].applyRemote(data);
          };
        } catch {
          this.channel = null;
        }
      }
    }
    notify(area, changes, local) {
      if (area === "__extshim") return;
      if (local && this.channel && this.areas[area].persistent) {
        try {
          this.channel.postMessage({ area, data: this.areas[area].data });
        } catch {
        }
      }
      this.ext.dispatch("storage.onChanged", () => [jsonClone(changes), area], { includeContent: true });
      this.ext.dispatch(`storage.${area}.onChanged`, () => [jsonClone(changes)], { includeContent: true });
    }
    internal() {
      return this.areas.__extshim;
    }
    async exportAll() {
      const out = {};
      for (const a of ["local", "sync"]) out[a] = await this.areas[a].get(null);
      return out;
    }
    async importAll(data) {
      for (const a of ["local", "sync"]) {
        if (data && data[a] && typeof data[a] === "object") {
          await this.areas[a].clear();
          await this.areas[a].set(data[a]);
        }
      }
    }
    close() {
      try {
        this.channel && this.channel.close();
      } catch {
      }
    }
  };

  // src/core/bundle.js
  var UNIT_PARAM = "__extshim$";
  var PREFIX = `function(${UNIT_PARAM}){with(${UNIT_PARAM}.scope)return function(){`;
  var SUFFIX = "\n}.call(this)}";
  var EXPOSE_MARK = `;${UNIT_PARAM}.expose(`;
  var NO_EXPOSE = /* @__PURE__ */ new Set(["chrome", "browser", "window", "self", "globalThis", "document", "location", "top", "parent", "frames", "arguments", "eval", UNIT_PARAM]);
  var DIRECTIVE_RE = /^((?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*(['"])use strict\2;?)/;
  function cleanSource(code) {
    code = String(code);
    if (code.charCodeAt(0) === 65279) code = code.slice(1);
    if (code.startsWith("#!")) code = "//" + code.slice(2);
    return code.replace(/\n\/\/# sourceMappingURL=[^\n]*\s*$/, "\n");
  }
  function wrapClassicScript(code, names = []) {
    code = cleanSource(code);
    const exp = names.filter((n) => !NO_EXPOSE.has(n) && /^[A-Za-z_$][\w$]*$/.test(n));
    const defs2 = exp.map((n) => `${JSON.stringify(n)}:[function(){return ${n}},function(v){${n}=v}]`).join(",");
    const dm = DIRECTIVE_RE.exec(code);
    const directive = dm ? dm[1] : "";
    const rest = dm ? code.slice(directive.length) : code;
    return PREFIX + directive + EXPOSE_MARK + "{" + defs2 + "});\n" + rest + SUFFIX;
  }
  function unwrapClassicScript(src) {
    if (!src.startsWith(PREFIX) || !src.endsWith(SUFFIX)) return null;
    const body = src.slice(PREFIX.length, -SUFFIX.length);
    const at = body.indexOf(EXPOSE_MARK);
    if (at < 0) return null;
    const nl = body.indexOf("\n", at);
    return body.slice(0, at) + body.slice(nl + 1);
  }
  function unitFunctionBody(wrapped) {
    return wrapped.slice(`function(${UNIT_PARAM}){`.length, -1);
  }

  // src/core/scan.js
  var PUNCS = [
    ">>>=",
    "...",
    "===",
    "!==",
    "**=",
    "<<=",
    ">>=",
    ">>>",
    "&&=",
    "||=",
    "??=",
    "=>",
    "==",
    "!=",
    "<=",
    ">=",
    "&&",
    "||",
    "??",
    "?.",
    "++",
    "--",
    "+=",
    "-=",
    "*=",
    "/=",
    "%=",
    "&=",
    "|=",
    "^=",
    "**",
    "<<",
    ">>"
  ];
  var KEYWORDS_BEFORE_EXPR = /* @__PURE__ */ new Set([
    "return",
    "typeof",
    "instanceof",
    "in",
    "of",
    "new",
    "delete",
    "void",
    "throw",
    "case",
    "do",
    "else",
    "yield",
    "await",
    "extends"
  ]);
  var OPERATOR_KEYWORDS = /* @__PURE__ */ new Set(["in", "instanceof", "of", "typeof", "void", "delete", "new", "await", "yield", "return", "throw", "case", "extends"]);
  var ID_START = /[A-Za-z_$\u00a0-\uffff\\]/;
  var ID_PART = /[\w$\u00a0-\uffff\\\u200c\u200d]/;
  function tokenize(src) {
    const toks = [];
    const stack = [];
    let i = 0;
    let nl = false;
    const n = src.length;
    const last = () => toks[toks.length - 1];
    const push = (t, v) => {
      toks.push({ t, v, nl, d: stack.length });
      nl = false;
    };
    const regexAllowed = () => {
      const p = last();
      if (!p) return true;
      if (p.t === "punc") return !(p.v === ")" || p.v === "]" || p.v === "++" || p.v === "--");
      if (p.t === "name") return KEYWORDS_BEFORE_EXPR.has(p.v);
      return false;
    };
    const scanTemplate = () => {
      while (i < n) {
        const c = src[i];
        if (c === "\\") {
          i += 2;
          continue;
        }
        if (c === "`") {
          i++;
          push("tmpl", "`");
          return;
        }
        if (c === "$" && src[i + 1] === "{") {
          i += 2;
          push("tmpl", "${");
          stack.push("${");
          return;
        }
        i++;
      }
    };
    if (src.startsWith("#!")) {
      while (i < n && src[i] !== "\n") i++;
    }
    while (i < n) {
      const c = src[i];
      const code = src.charCodeAt(i);
      if (c === "\n" || c === "\r" || code === 8232 || code === 8233) {
        nl = true;
        i++;
        continue;
      }
      if (c === " " || c === "	" || code === 65279 || code === 160 || code === 11 || code === 12 || code > 127 && /\s/.test(c)) {
        i++;
        continue;
      }
      if (c === "/" && src[i + 1] === "/") {
        while (i < n && src[i] !== "\n" && src[i] !== "\r") i++;
        continue;
      }
      if (c === "/" && src[i + 1] === "*") {
        const end = src.indexOf("*/", i + 2);
        const body = src.slice(i, end < 0 ? n : end);
        if (/[\n\r\u2028\u2029]/.test(body)) nl = true;
        i = end < 0 ? n : end + 2;
        continue;
      }
      if (c === "<" && src.startsWith("<!--", i)) {
        while (i < n && src[i] !== "\n") i++;
        continue;
      }
      if (c === "-" && nl && src.startsWith("-->", i)) {
        while (i < n && src[i] !== "\n") i++;
        continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && src[j] !== c) {
          if (src[j] === "\\") j++;
          else if (src[j] === "\n") break;
          j++;
        }
        i = j + 1;
        push("str", c);
        continue;
      }
      if (c === "`") {
        i++;
        scanTemplate();
        continue;
      }
      if (ID_START.test(c)) {
        let j = i + 1;
        while (j < n && ID_PART.test(src[j])) j++;
        push("name", src.slice(i, j));
        i = j;
        continue;
      }
      if (c >= "0" && c <= "9" || c === "." && src[i + 1] >= "0" && src[i + 1] <= "9") {
        let j = i + 1;
        while (j < n && /[\w.]/.test(src[j])) {
          if ((src[j] === "e" || src[j] === "E") && (src[j + 1] === "+" || src[j + 1] === "-") && !/^0[xX]/.test(src.slice(i, j))) j += 2;
          else j++;
        }
        push("num", src.slice(i, j));
        i = j;
        continue;
      }
      if (c === "/" && regexAllowed()) {
        let j = i + 1;
        let inClass = false;
        while (j < n) {
          const d = src[j];
          if (d === "\\") {
            j += 2;
            continue;
          }
          if (d === "\n") break;
          if (inClass) {
            if (d === "]") inClass = false;
          } else if (d === "[") inClass = true;
          else if (d === "/") break;
          j++;
        }
        j++;
        while (j < n && ID_PART.test(src[j])) j++;
        push("regex", "/");
        i = j;
        continue;
      }
      if (c === "(" || c === "[" || c === "{") {
        push("punc", c);
        stack.push(c);
        i++;
        continue;
      }
      if (c === ")" || c === "]" || c === "}") {
        const top = stack.pop();
        i++;
        if (c === "}" && top === "${") {
          scanTemplate();
          continue;
        }
        push("punc", c);
        continue;
      }
      let p = c;
      for (const cand of PUNCS) {
        if (src.startsWith(cand, i)) {
          p = cand;
          break;
        }
      }
      push("punc", p);
      i += p.length;
    }
    return toks;
  }
  function endsExpression(t) {
    if (!t) return false;
    if (t.t === "name") return !OPERATOR_KEYWORDS.has(t.v);
    if (t.t === "punc") return t.v === ")" || t.v === "]" || t.v === "}";
    if (t.t === "tmpl") return t.v === "`";
    return true;
  }
  function startsStatement(t) {
    if (!t) return true;
    if (t.t === "name") return !OPERATOR_KEYWORDS.has(t.v) || t.v === "new" || t.v === "typeof" || t.v === "void" || t.v === "delete" || t.v === "await" || t.v === "return" || t.v === "throw";
    return t.t === "str" || t.t === "num";
  }
  function scanTopLevelDeclarations(src) {
    let toks;
    try {
      toks = tokenize(String(src));
    } catch {
      return { names: [], ok: false };
    }
    const names = /* @__PURE__ */ new Set();
    const N = toks.length;
    const isStatementStart = (i) => {
      const p = toks[i - 1];
      if (!p) return true;
      if (p.t === "punc" && (p.v === ";" || p.v === "}")) return true;
      if (toks[i].nl && endsExpression(p)) return true;
      return false;
    };
    const skipExpr = (j, d, closer) => {
      for (; j < N; j++) {
        const t = toks[j];
        if (t.d < d) return j;
        if (t.d === d - 1 && closer && t.v === closer) return j;
        if (t.d === d && t.t === "punc" && (t.v === "," || t.v === ";")) return j;
        if (d === 0 && t.d === 0 && t.nl && endsExpression(toks[j - 1]) && startsStatement(t)) return j;
      }
      return j;
    };
    const parseTarget = (j) => {
      const t = toks[j];
      if (!t) return j;
      if (t.t === "name") {
        names.add(t.v);
        return j + 1;
      }
      if (t.v === "{" || t.v === "[") return parsePattern(j);
      return j + 1;
    };
    const parsePattern = (j) => {
      const open = toks[j];
      const D = open.d;
      const closer = open.v === "{" ? "}" : "]";
      j++;
      while (j < N) {
        let t = toks[j];
        if (t.d === D && t.v === closer) return j + 1;
        if (open.v === "[") {
          if (t.v === ",") {
            j++;
            continue;
          }
          if (t.v === "...") j++;
          j = parseTarget(j);
        } else {
          if (t.v === "...") {
            j = parseTarget(j + 1);
          } else {
            let key = null;
            if (t.v === "[") {
              j++;
              while (j < N && !(toks[j].d === D + 1 && toks[j].v === "]")) j++;
              j++;
            } else {
              if (t.t === "name") key = t.v;
              j++;
            }
            t = toks[j];
            if (t && t.v === ":") j = parseTarget(j + 1);
            else if (key) names.add(key);
          }
        }
        t = toks[j];
        if (t && t.v === "=") j = skipExpr(j + 1, D + 1, closer);
        t = toks[j];
        if (t && t.v === "," && t.d === D + 1) j++;
        else if (t && !(t.d === D && t.v === closer)) {
          while (j < N && !(toks[j].d === D + 1 && toks[j].v === ",") && !(toks[j].d === D && toks[j].v === closer)) j++;
          if (toks[j] && toks[j].v === ",") j++;
        }
      }
      return j;
    };
    const parseBindingList = (j, d) => {
      while (j < N) {
        const t = toks[j];
        if (!t || t.d !== d) return j;
        if (t.t === "name") {
          names.add(t.v);
          j++;
        } else if (t.v === "{" || t.v === "[") j = parsePattern(j);
        else return j;
        let u = toks[j];
        if (u && u.t === "name" && (u.v === "in" || u.v === "of")) return j;
        if (u && u.v === "=") j = skipExpr(j + 1, d, d > 0 ? ")" : null);
        u = toks[j];
        if (u && u.d === d && u.v === ",") {
          j++;
          continue;
        }
        return j;
      }
      return j;
    };
    for (let i = 0; i < N; i++) {
      const t = toks[i];
      if (t.d !== 0 || t.t !== "name") continue;
      const next = toks[i + 1];
      if ((t.v === "var" || t.v === "const" || t.v === "let") && isStatementStart(i)) {
        if (t.v === "let" && !(next && (next.t === "name" && next.v !== "in" && next.v !== "instanceof" || next.v === "[" || next.v === "{"))) continue;
        i = parseBindingList(i + 1, 0) - 1;
      } else if (t.v === "function" && isStatementStart(i)) {
        let j = i + 1;
        if (toks[j] && toks[j].v === "*") j++;
        if (toks[j] && toks[j].t === "name") names.add(toks[j].v);
      } else if (t.v === "async" && next && next.v === "function" && !next.nl && isStatementStart(i)) {
        let j = i + 2;
        if (toks[j] && toks[j].v === "*") j++;
        if (toks[j] && toks[j].t === "name") names.add(toks[j].v);
        i = j;
      } else if (t.v === "class" && isStatementStart(i)) {
        if (next && next.t === "name" && next.v !== "extends") names.add(next.v);
      } else if (t.v === "for" && next && next.v === "(") {
        const v = toks[i + 2];
        if (v && v.v === "var" && v.d === 1) parseBindingList(i + 3, 1);
      }
    }
    return { names: [...names], ok: true };
  }

  // src/runtime/scope.js
  var INTRINSICS = new Set("Object Function Array Number parseFloat parseInt Infinity NaN undefined Boolean String Symbol Date Promise RegExp Error AggregateError EvalError RangeError ReferenceError SyntaxError TypeError URIError JSON Math Intl ArrayBuffer SharedArrayBuffer Atomics Uint8Array Int8Array Uint16Array Int16Array Uint32Array Int32Array Float32Array Float64Array Float16Array Uint8ClampedArray BigUint64Array BigInt64Array DataView Map BigInt Set WeakMap WeakSet WeakRef FinalizationRegistry Proxy Reflect decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape eval isFinite isNaN Iterator SuppressedError DisposableStack AsyncDisposableStack".split(" "));
  var fnToString = Function.prototype.toString;
  var hasOwn = Object.prototype.hasOwnProperty;
  var pristineCache = null;
  function pristineGlobals(doc = document) {
    if (pristineCache) return pristineCache;
    const names = /* @__PURE__ */ new Set();
    try {
      const f = doc.createElement("iframe");
      f.style.cssText = "display:none!important";
      (doc.documentElement || doc).appendChild(f);
      let o = f.contentWindow;
      while (o) {
        for (const k of Object.getOwnPropertyNames(o)) names.add(k);
        o = Object.getPrototypeOf(o);
      }
      f.remove();
    } catch {
    }
    pristineCache = names.size ? names : null;
    return pristineCache;
  }
  var World = class {
    /**
     * @param {object} o
     * @param {'content'|'main'|'frame'} o.kind
     * @param {Window} o.target real global object
     * @param {object} [o.log]
     * @param {string} [o.label] name used in log messages (default: kind)
     */
    constructor({ kind, target, log = console, label = kind }) {
      this.kind = kind;
      this.target = target;
      this.log = log;
      this.label = label;
      this.isolated = kind === "content";
      this.locals = /* @__PURE__ */ Object.create(null);
      this.redirect = null;
      this._bound = /* @__PURE__ */ new WeakMap();
      this._accessorCache = /* @__PURE__ */ new Map();
      this._msgWrappers = /* @__PURE__ */ new WeakMap();
      this.pristine = this.isolated ? pristineGlobals(target.document) : null;
      const world = this;
      this.proxy = new Proxy(/* @__PURE__ */ Object.create(null), {
        get: (_, k) => world.get(k),
        set: (_, k, v) => {
          world.set(k, v);
          return true;
        },
        has: (_, k) => world.hasName(k),
        deleteProperty: (_, k) => {
          if (k in world.locals) return delete world.locals[k];
          if (!world.isolated) return Reflect.deleteProperty(world.target, k);
          return true;
        },
        defineProperty: (_, k, desc) => {
          const into = world.isolated || k in world.locals ? world.locals : world.target;
          try {
            Object.defineProperty(into, k, desc);
          } catch {
            Object.defineProperty(world.locals, k, { ...desc, configurable: true });
          }
          return true;
        },
        getOwnPropertyDescriptor: (_, k) => {
          let d = Object.getOwnPropertyDescriptor(world.locals, k);
          if (!d && world.visible(k)) d = Object.getOwnPropertyDescriptor(world.target, k);
          return d ? { ...d, configurable: true } : void 0;
        },
        ownKeys: () => {
          const keys = new Set(Reflect.ownKeys(world.locals));
          for (const k of Reflect.ownKeys(world.target)) if (world.visible(k)) keys.add(k);
          return [...keys];
        },
        getPrototypeOf: () => Object.getPrototypeOf(world.target),
        setPrototypeOf: () => false
      });
      this.scope = new Proxy(/* @__PURE__ */ Object.create(null), {
        has: (_, k) => {
          if (typeof k === "symbol" || k === UNIT_PARAM) return false;
          if (INTRINSICS.has(k) && !(k in world.locals)) return false;
          return true;
        },
        get: (_, k) => k === Symbol.unscopables ? void 0 : world.get(k),
        set: (_, k, v) => {
          world.set(k, v);
          return true;
        }
      });
      this.unitArg = Object.freeze({ scope: this.scope, expose: (defs2) => this.expose(defs2) });
      const p = this.proxy;
      Object.assign(this.locals, { window: p, self: p, globalThis: p, frames: p });
      if (this.kind !== "main") {
        this.locals.addEventListener = (type, listener, opts) => target.addEventListener(type, this._wrapListener(type, listener), opts);
        this.locals.removeEventListener = (type, listener, opts) => target.removeEventListener(type, this._msgWrappers.get(listener) || listener, opts);
      } else {
        delete this.locals.window;
        delete this.locals.self;
        delete this.locals.globalThis;
        delete this.locals.frames;
      }
    }
    /** Is a target property visible from this world? (isolated worlds hide page-defined globals) */
    visible(k) {
      const t = this.target;
      if (!(k in t)) return false;
      if (!this.isolated || typeof k === "symbol" || !this.pristine) return true;
      return !hasOwn.call(t, k) || this.pristine.has(k);
    }
    hasName(k) {
      return k in this.locals || this.visible(k);
    }
    get(k) {
      const w = this.redirect || this;
      if (k in w.locals) return w.locals[k];
      if (!w.visible(k)) return void 0;
      const v = Reflect.get(w.target, k);
      return typeof v === "function" ? w._bind(v) : v;
    }
    set(k, v) {
      const w = this.redirect || this;
      if (k in w.locals) {
        w.locals[k] = v;
        return;
      }
      if (!w.isolated || w._isTargetAccessor(k)) {
        if (k === "onmessage" && typeof v === "function") v = w._wrapListener("message", v);
        Reflect.set(w.target, k, v);
        return;
      }
      w.locals[k] = v;
    }
    /** Native functions are bound to the real global so window.setTimeout(...) etc. work through the proxy. */
    _bind(fn) {
      let b = this._bound.get(fn);
      if (b) return b;
      let native = false;
      try {
        native = !hasOwn.call(fn, "prototype") && Object.getOwnPropertyNames(fn).length <= 2 && /\[native code\]\s*\}\s*$/.test(fnToString.call(fn));
      } catch {
      }
      b = native ? fn.bind(this.target) : fn;
      if (native) {
        try {
          Object.defineProperty(b, "name", { value: fn.name });
        } catch {
        }
      }
      this._bound.set(fn, b);
      return b;
    }
    _isTargetAccessor(k) {
      if (this._accessorCache.has(k)) return this._accessorCache.get(k);
      let o = this.target;
      let result = false;
      while (o) {
        const d = Object.getOwnPropertyDescriptor(o, k);
        if (d) {
          result = !!d.set;
          break;
        }
        o = Object.getPrototypeOf(o);
      }
      this._accessorCache.set(k, result);
      return result;
    }
    /** Make `event.source === window` hold for message events seen from this world. */
    _wrapListener(type, listener) {
      if (type !== "message" || !listener || this.kind === "main") return listener;
      let w = this._msgWrappers.get(listener);
      if (w) return w;
      const world = this;
      w = function(e) {
        const ev = new Proxy(e, {
          get(t, k) {
            if (k === "source" && t.source === world.target) return world.proxy;
            if (k === "currentTarget" && t.currentTarget === world.target) return world.proxy;
            const v = Reflect.get(t, k, t);
            return typeof v === "function" ? v.bind(t) : v;
          }
        });
        const self2 = this === world.target ? world.proxy : this;
        return typeof listener === "function" ? listener.call(self2, ev) : listener.handleEvent(ev);
      };
      this._msgWrappers.set(listener, w);
      return w;
    }
    /** Publish a unit's top-level declarations as globals of this world. */
    expose(defs2) {
      for (const name of Object.keys(defs2)) {
        const [get, set] = defs2[name];
        const desc = { get, set, configurable: true, enumerable: true };
        if (!this.isolated && !(name in this.locals)) {
          try {
            Object.defineProperty(this.target, name, desc);
            continue;
          } catch {
          }
        }
        Object.defineProperty(this.locals, name, desc);
      }
    }
    define(values) {
      for (const k of Object.keys(values)) {
        Object.defineProperty(this.locals, k, { value: values[k], writable: true, configurable: true, enumerable: false });
      }
    }
    /** Run a compiled unit. Errors are logged (like a failing <script>), not thrown. */
    run(unit, label) {
      try {
        unit.call(this.proxy, this.unitArg);
        return true;
      } catch (e) {
        this.log.error(`Uncaught error in ${label || "script"}:`, e);
        return false;
      }
    }
    /** Evaluate code and return its completion value (needs eval to be allowed by CSP). */
    evaluate(code) {
      const f = new Function(UNIT_PARAM, `with(${UNIT_PARAM}.scope)return eval(${UNIT_PARAM}.code)`);
      return f.call(this.proxy, { scope: this.scope, code });
    }
    /** Call a serialized function inside this world (tabs/scripting executeScript with func). */
    callSerialized(fnSource, args) {
      const f = new Function(UNIT_PARAM, `with(${UNIT_PARAM}.scope)return(${fnSource}).apply(this,${UNIT_PARAM}.args)`);
      return f.call(this.proxy, { scope: this.scope, args });
    }
  };
  var evalAllowed = null;
  function canEval() {
    if (evalAllowed === null) {
      try {
        evalAllowed = new Function("return 1")() === 1;
      } catch {
        evalAllowed = false;
      }
    }
    return evalAllowed;
  }
  function compileUnit(code, url) {
    const { names } = scanTopLevelDeclarations(code);
    const body = unitFunctionBody(wrapClassicScript(code, names));
    return new Function(UNIT_PARAM, body + (url ? `
//# sourceURL=${url}` : ""));
  }

  // src/runtime/api/helpers.js
  function makeHelpers(ctx) {
    const fn = (impl) => function(...args) {
      let cb = null;
      if (args.length && typeof args[args.length - 1] === "function") cb = args.pop();
      let p;
      try {
        ctx.assertAlive();
        p = Promise.resolve(impl(...args));
      } catch (e) {
        if (e instanceof TypeError && /invocation/.test(e.message)) throw e;
        p = Promise.reject(e);
      }
      if (!cb) return p;
      p.then((r) => nextTask(() => ctx.callback(cb, null, r)), (e) => nextTask(() => ctx.callback(cb, e)));
      return void 0;
    };
    const event = (key) => ctx.event(key);
    const unsupported = (name) => fn(() => {
      throw new Error(`${name} is not supported by ExtShim (extensions running in a web page).`);
    });
    return { fn, event, unsupported, ctx, ext: ctx.ext };
  }
  var LIST_READS = /^(getAll|search|query|getTree|getRecent|getVisits|getDevices|getSubTree|getChildren|getDynamicRules|getSessionRules|getEnabledRulesets|getMatchedRules|getDisabledRuleIds|getRules|getAllInWindow|list)/;
  function stubNamespace(h, ns, enums = {}) {
    let warned = false;
    const warn = () => {
      if (!warned) {
        warned = true;
        h.ext.log.warn(`chrome.${ns} is not supported by ExtShim; calls will fail and events will not fire.`);
      }
    };
    const make = (path) => {
      const cache2 = /* @__PURE__ */ Object.create(null);
      const leaf = path.split(".").pop();
      const call = LIST_READS.test(leaf) ? h.fn(() => {
        warn();
        return [];
      }) : h.unsupported(`chrome.${path}`);
      return new Proxy(function() {
      }, {
        apply: (_, __, args) => {
          warn();
          return call(...args);
        },
        get(_, k) {
          if (typeof k !== "string" || k === "then" || k === "toJSON") return void 0;
          if (k in cache2) return cache2[k];
          if (/^on[A-Z]/.test(k)) return cache2[k] = h.event(`${path}.${k}`);
          if (/^[A-Z_0-9]+$/.test(k)) return void 0;
          return cache2[k] = make(`${path}.${k}`);
        }
      });
    };
    const root = make(ns);
    return new Proxy({}, { get: (_, k) => typeof k === "string" && Object.hasOwn(enums, k) ? enums[k] : root[k] });
  }
  function toRGBA(color) {
    if (Array.isArray(color)) return color.slice(0, 4).concat([255, 255, 255, 255].slice(color.length)).map((n) => n | 0);
    if (typeof color !== "string") return [0, 0, 0, 255];
    const c = document.createElement("canvas").getContext("2d");
    c.fillStyle = "#000";
    c.fillStyle = color;
    const v = c.fillStyle;
    if (v.startsWith("#")) {
      const n = parseInt(v.slice(1), 16);
      return [n >> 16 & 255, n >> 8 & 255, n & 255, 255];
    }
    const m = /rgba?\(([^)]+)\)/.exec(v);
    if (m) {
      const p = m[1].split(",").map((s) => parseFloat(s));
      return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? Math.round(p[3] * 255) : 255];
    }
    return [0, 0, 0, 255];
  }
  function rgbaToCss(c) {
    return `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;
  }

  // src/runtime/api/core-apis.js
  var NO_RECEIVER2 = "Could not establish connection. Receiving end does not exist.";
  var PORT_CLOSED = "The message port closed before a response was received.";
  function platformInfo() {
    const ua = navigator.userAgent;
    const p = navigator.userAgentData && navigator.userAgentData.platform || navigator.platform || "";
    const os = /mac/i.test(p) ? "mac" : /win/i.test(p) ? "win" : /android/i.test(ua) ? "android" : /CrOS/.test(ua) ? "cros" : /openbsd/i.test(ua) ? "openbsd" : /fuchsia/i.test(ua) ? "fuchsia" : "linux";
    const arch = /arm|aarch/i.test(ua + p) ? "arm64" : "x86-64";
    return { os, arch, nacl_arch: arch === "arm64" ? "arm" : arch };
  }
  function looksLikeExtensionId(ext, s) {
    return typeof s === "string" && (s === ext.id || /^[a-p]{32}$/.test(s) || /^[\w.+-]*@[\w.-]+$/.test(s) || /^\{[0-9a-f-]{36}\}$/i.test(s));
  }
  function messageSender(ctx, send) {
    return function(...args) {
      const cb = args.length && typeof args[args.length - 1] === "function" ? args.pop() : null;
      ctx.assertAlive();
      let p;
      try {
        p = send(args);
      } catch (e) {
        p = Promise.reject(e);
      }
      if (!cb) return p.then((r) => r === NO_RESPONSE ? void 0 : r);
      p.then(
        (r) => r === NO_RESPONSE ? ctx.withLastError(PORT_CLOSED, () => cb()) : ctx.callback(cb, null, r),
        (e) => ctx.callback(cb, e)
      );
      return void 0;
    };
  }
  var CONTEXT_TYPES = { background: "BACKGROUND", popup: "POPUP", tab: "TAB", options: "TAB", sidepanel: "SIDE_PANEL", offscreen: "OFFSCREEN_DOCUMENT", frame: "TAB", devtools: "DEVELOPER_TOOLS" };
  function runtimeApi(h) {
    const { ctx, ext, fn } = h;
    const ev = (n) => h.event("runtime." + n);
    const rt = {
      get id() {
        return ext.id;
      },
      get lastError() {
        ctx._leChecked = true;
        return ctx.lastError;
      },
      getURL: (p) => ext.getURL(p),
      getManifest: () => JSON.parse(JSON.stringify(ext.manifest)),
      sendMessage: messageSender(ctx, (args) => {
        let extId = null;
        let message;
        if (args.length >= 3) [extId, message] = args;
        else if (args.length === 2) {
          if (looksLikeExtensionId(ext, args[0])) [extId, message] = args;
          else [message] = args;
        } else [message] = args;
        if (args.length === 0) throw new TypeError("Error in invocation of runtime.sendMessage: No matching signature.");
        if (extId != null && extId !== ext.id) return Promise.reject(new Error(NO_RECEIVER2));
        return ext.bus.send(ctx, message);
      }),
      connect(a, b) {
        ctx.assertAlive();
        const info = typeof a === "object" && a ? a : b || {};
        if (typeof a === "string" && a !== ext.id) {
          const port = ext.bus.connect(ctx, { name: "__external__", tabId: -999 });
          return port;
        }
        return ext.bus.connect(ctx, { name: info.name || "" });
      },
      onMessage: ev("onMessage"),
      onConnect: ev("onConnect"),
      onMessageExternal: ev("onMessageExternal"),
      onConnectExternal: ev("onConnectExternal"),
      onUserScriptMessage: ev("onUserScriptMessage"),
      onUserScriptConnect: ev("onUserScriptConnect"),
      OnInstalledReason: { INSTALL: "install", UPDATE: "update", CHROME_UPDATE: "chrome_update", BROWSER_UPDATE: "browser_update", SHARED_MODULE_UPDATE: "shared_module_update" },
      OnRestartRequiredReason: { APP_UPDATE: "app_update", OS_UPDATE: "os_update", PERIODIC: "periodic" },
      PlatformOs: { MAC: "mac", WIN: "win", ANDROID: "android", CROS: "cros", LINUX: "linux", OPENBSD: "openbsd", FUCHSIA: "fuchsia" },
      PlatformArch: { ARM: "arm", ARM64: "arm64", X86_32: "x86-32", X86_64: "x86-64", MIPS: "mips", MIPS64: "mips64" },
      ContextType: { TAB: "TAB", POPUP: "POPUP", BACKGROUND: "BACKGROUND", OFFSCREEN_DOCUMENT: "OFFSCREEN_DOCUMENT", SIDE_PANEL: "SIDE_PANEL", DEVELOPER_TOOLS: "DEVELOPER_TOOLS" }
    };
    if (ctx.type === "content") return rt;
    Object.assign(rt, {
      onInstalled: ev("onInstalled"),
      onStartup: ev("onStartup"),
      onSuspend: ev("onSuspend"),
      onSuspendCanceled: ev("onSuspendCanceled"),
      onUpdateAvailable: ev("onUpdateAvailable"),
      onRestartRequired: ev("onRestartRequired"),
      onBrowserUpdateAvailable: ev("onBrowserUpdateAvailable"),
      getBackgroundPage: fn(async () => {
        await ext.whenBackgroundReady();
        const bg = getBackground(ext.manifest);
        if (!bg || bg.kind === "worker") throw new Error("You do not have a background page.");
        return ext.background ? ext.background.win : null;
      }),
      openOptionsPage: fn(() => ext.openOptions()),
      reload: () => {
        setTimeout(() => ext.reload(), 0);
      },
      restart: () => {
      },
      restartAfterDelay: fn(() => {
      }),
      getPlatformInfo: fn(() => platformInfo()),
      getBrowserInfo: fn(() => ({ name: "ExtShim", vendor: "ExtShim", version: ext.shim.version, buildID: "0" })),
      setUninstallURL: fn(() => {
      }),
      requestUpdateCheck: fn(() => ({ status: "no_update", version: ext.manifest.version })),
      getContexts: fn((filter = {}) => [...ext.contexts].filter((c) => c.alive && c.isExtensionPage).map((c) => ({
        contextType: CONTEXT_TYPES[c.type] || "TAB",
        contextId: c.documentId,
        tabId: c.tabId ?? -1,
        windowId: ext.shim.windowId,
        documentId: c.documentId,
        frameId: c.frameId ?? 0,
        documentUrl: c.url,
        documentOrigin: ext.origin,
        incognito: false
      })).filter((c) => (!filter.contextTypes || filter.contextTypes.includes(c.contextType)) && (!filter.documentUrls || filter.documentUrls.includes(c.documentUrl)) && (!filter.tabIds || filter.tabIds.includes(c.tabId)))),
      connectNative: (app) => {
        const host = ext.options.nativeMessaging;
        if (typeof host !== "function") throw new Error('Native messaging needs a host adapter (ExtShim option "nativeMessaging").');
        const port = host(app);
        const onMessage = h.event("native:" + app + ":message");
        const onDisconnect = h.event("native:" + app + ":disconnect");
        if (port.onMessage) port.onMessage((m) => onMessage.dispatch(m));
        if (port.onDisconnect) port.onDisconnect(() => onDisconnect.dispatch());
        return { name: app, onMessage, onDisconnect, postMessage: (m) => port.postMessage(JSON.parse(JSON.stringify(m))), disconnect: () => port.disconnect && port.disconnect() };
      },
      sendNativeMessage: fn((app, msg) => {
        const host = ext.options.nativeMessaging;
        if (typeof host !== "function") throw new Error('Native messaging needs a host adapter (ExtShim option "nativeMessaging").');
        return new Promise((resolve, reject) => {
          const port = host(app);
          if (port.onMessage) port.onMessage((m) => {
            resolve(m);
            port.disconnect && port.disconnect();
          });
          if (port.onDisconnect) port.onDisconnect((e) => reject(new Error(e && e.message || "Native host has exited.")));
          port.postMessage(JSON.parse(JSON.stringify(msg)));
        });
      }),
      onPerformanceWarning: ev("onPerformanceWarning"),
      getFrameId: (target) => {
        if (target === window || target && target.contentWindow === window) return 0;
        const w = target && (target.contentWindow || target);
        for (const f of ext.content.frames.values()) if (f.win === w) return f.frameId;
        return -1;
      },
      getPackageDirectoryEntry: fn(() => packageDirectory(ext)),
      getVersion: () => ext.manifest.version,
      onConnectNative: ev("onConnectNative"),
      onEnabled: ev("onEnabled")
    });
    return rt;
  }
  function extensionApi(h, rt) {
    const { ctx, ext, fn } = h;
    const x = {
      get lastError() {
        ctx._leChecked = true;
        return ctx.lastError;
      },
      getURL: (p) => ext.getURL(p),
      inIncognitoContext: false,
      sendRequest: rt.sendMessage,
      onRequest: rt.onMessage
    };
    if (ctx.type === "content") return x;
    Object.assign(x, {
      getBackgroundPage: () => {
        const bg = getBackground(ext.manifest);
        return bg && bg.kind !== "worker" && ext.background ? ext.background.win : null;
      },
      getViews: (f = {}) => ext.views(f).map((c) => c.win),
      getExtensionTabs: () => ext.views({ type: "tab" }).map((c) => c.win),
      isAllowedIncognitoAccess: fn(() => false),
      isAllowedFileSchemeAccess: fn(() => false),
      setUpdateUrlData: () => {
      },
      onRequestExternal: h.event("extension.onRequestExternal"),
      ViewType: { TAB: "tab", POPUP: "popup" }
    });
    return x;
  }
  function i18nApi(h) {
    const { ext, fn } = h;
    return {
      getMessage: (name, subs) => ext.getMessage(name, subs),
      getUILanguage: () => ext.uiLocale.replace("_", "-"),
      getAcceptLanguages: fn(() => [...navigator.languages || [navigator.language]]),
      getPreferredSystemLanguages: fn(() => [...navigator.languages || [navigator.language]]),
      detectLanguage: fn(async (text) => {
        try {
          if (self.LanguageDetector && await self.LanguageDetector.availability() === "available") {
            const d = await self.LanguageDetector.create();
            const r = (await d.detect(String(text))).filter((x) => x.detectedLanguage !== "und").slice(0, 3);
            return { isReliable: !!r[0] && r[0].confidence > 0.7, languages: r.map((x) => ({ language: x.detectedLanguage, percentage: Math.round(x.confidence * 100) })) };
          }
        } catch {
        }
        return { isReliable: false, languages: [] };
      })
    };
  }
  function storageApi(h) {
    const { ctx, ext, fn } = h;
    const mgr = ext.storage;
    const access = ext.shared("storageAccess", () => ({ session: "TRUSTED_CONTEXTS" }));
    const area = (name) => {
      const a = () => mgr.areas[name];
      const guard = () => {
        if (name === "session" && ctx.type === "content" && access.session !== "TRUSTED_AND_UNTRUSTED_CONTEXTS") throw new Error("Access to storage is not allowed from this context.");
      };
      return {
        get: fn((keys) => {
          guard();
          return a().get(keys);
        }),
        getKeys: fn(() => {
          guard();
          return a().getKeys();
        }),
        set: fn((items) => {
          guard();
          return a().set(items);
        }),
        remove: fn((keys) => {
          guard();
          return a().remove(keys);
        }),
        clear: fn(() => {
          guard();
          return a().clear();
        }),
        getBytesInUse: fn((keys) => {
          guard();
          return a().getBytesInUse(keys);
        }),
        setAccessLevel: fn((o) => {
          if (ctx.type === "content") throw new Error("Access denied.");
          if (name === "session") access.session = o && o.accessLevel || "TRUSTED_CONTEXTS";
        }),
        onChanged: h.event(`storage.${name}.onChanged`),
        ...QUOTAS[name]
      };
    };
    return {
      local: area("local"),
      sync: area("sync"),
      session: area("session"),
      managed: area("managed"),
      onChanged: h.event("storage.onChanged"),
      AccessLevel: { TRUSTED_CONTEXTS: "TRUSTED_CONTEXTS", TRUSTED_AND_UNTRUSTED_CONTEXTS: "TRUSTED_AND_UNTRUSTED_CONTEXTS" }
    };
  }
  function permissionsApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("permissions", () => {
      const p = getPermissions(ext.manifest);
      return { info: p, granted: new Set(p.permissions), origins: new Set(p.origins) };
    });
    const internal = ext.storage.internal();
    const restore = internal.get("grantedPermissions").then((r) => {
      const g = r.grantedPermissions;
      if (g) {
        g.permissions.forEach((x) => st.granted.add(x));
        g.origins.forEach((x) => st.origins.add(x));
      }
    });
    const save = () => internal.set({ grantedPermissions: { permissions: [...st.granted], origins: [...st.origins] } });
    const has = (perms = [], origins = []) => perms.every((p) => st.granted.has(p)) && origins.every((o) => st.origins.has(o) || st.origins.has("<all_urls>") || matchesAny([...st.origins], o.replace(/\*/g, "x")));
    return {
      contains: fn(async (q = {}) => {
        await restore;
        return has(q.permissions, q.origins);
      }),
      getAll: fn(async () => {
        await restore;
        return { permissions: [...st.granted], origins: [...st.origins] };
      }),
      request: fn(async (q = {}) => {
        await restore;
        const added = { permissions: (q.permissions || []).filter((p) => !st.granted.has(p)), origins: (q.origins || []).filter((o) => !st.origins.has(o)) };
        added.permissions.forEach((p) => st.granted.add(p));
        added.origins.forEach((o) => st.origins.add(o));
        if (added.permissions.length || added.origins.length) {
          ext.log.info("Granted optional permissions:", added);
          await save();
          ext.dispatch("permissions.onAdded", () => [JSON.parse(JSON.stringify(added))]);
        }
        return true;
      }),
      remove: fn(async (q = {}) => {
        await restore;
        const removed = { permissions: (q.permissions || []).filter((p) => st.granted.has(p) && !st.info.permissions.includes(p)), origins: (q.origins || []).filter((o) => st.origins.has(o) && !st.info.origins.includes(o)) };
        removed.permissions.forEach((p) => st.granted.delete(p));
        removed.origins.forEach((o) => st.origins.delete(o));
        await save();
        if (removed.permissions.length || removed.origins.length) ext.dispatch("permissions.onRemoved", () => [JSON.parse(JSON.stringify(removed))]);
        return true;
      }),
      addHostAccessRequest: fn(() => {
      }),
      removeHostAccessRequest: fn(() => {
      }),
      onAdded: h.event("permissions.onAdded"),
      onRemoved: h.event("permissions.onRemoved")
    };
  }
  function packageDirectory(ext) {
    const files = () => ext.vfs.paths ? ext.vfs.paths() : [];
    const fileEntry = (path) => ({
      isFile: true,
      isDirectory: false,
      name: path.split("/").pop(),
      fullPath: "/" + path,
      file(ok, err) {
        ext.vfs.blob(path).then((b) => b ? ok(new File([b], path.split("/").pop(), { type: b.type })) : err && err(new DOMException("NotFoundError", "NotFoundError")));
      }
    });
    const dirEntry = (dir) => ({
      isFile: false,
      isDirectory: true,
      name: dir.split("/").pop() || "",
      fullPath: "/" + dir,
      createReader() {
        let done = false;
        return {
          readEntries(ok) {
            if (done) return ok([]);
            done = true;
            const prefix = dir ? dir + "/" : "";
            const names = /* @__PURE__ */ new Map();
            for (const f of files()) {
              if (!f.startsWith(prefix)) continue;
              const rest = f.slice(prefix.length);
              const head = rest.split("/")[0];
              names.set(head, rest.includes("/") ? dirEntry(prefix + head) : fileEntry(f));
            }
            ok([...names.values()]);
          }
        };
      },
      getFile(path, opts, ok, err) {
        const p = (dir ? dir + "/" : "") + String(path).replace(/^\//, "");
        if (files().includes(p)) ok && ok(fileEntry(p));
        else err && err(new DOMException("A requested file or directory could not be found.", "NotFoundError"));
      },
      getDirectory(path, opts, ok, err) {
        const p = (dir ? dir + "/" : "") + String(path).replace(/^\/|\/$/g, "");
        if (files().some((f) => f.startsWith(p + "/"))) ok && ok(dirEntry(p));
        else err && err(new DOMException("A requested file or directory could not be found.", "NotFoundError"));
      }
    });
    return dirEntry("");
  }
  function managementApi(h) {
    const { ext, fn } = h;
    const infoOf = (x) => {
      const m = x.localized;
      const perms = getPermissions(x.manifest);
      const o = getOptionsPage(m);
      return {
        id: x.id,
        name: m.name,
        shortName: m.short_name || m.name,
        description: m.description || "",
        version: m.version || "",
        versionName: m.version_name,
        mayDisable: true,
        mayEnable: true,
        enabled: x.status === "running",
        homepageUrl: m.homepage_url,
        updateUrl: m.update_url,
        installType: "development",
        type: "extension",
        offlineEnabled: !!m.offline_enabled,
        isApp: false,
        optionsUrl: o ? x.virtualUrl(o.path) : "",
        permissions: perms.permissions,
        hostPermissions: perms.origins,
        icons: Object.keys(m.icons || {}).map((s) => ({ size: +s, url: x.getURL(pickIcon(m.icons, +s)) }))
      };
    };
    const others = () => ext.shim.list().filter((x) => x !== ext);
    const find = (id) => {
      const x = ext.shim.get(id);
      if (!x) throw new Error("Failed to find extension with id " + id + ".");
      return x;
    };
    const self2 = () => {
      const m = ext.localized;
      const perms = getPermissions(ext.manifest);
      const o = getOptionsPage(m);
      return {
        id: ext.id,
        name: m.name,
        shortName: m.short_name || m.name,
        description: m.description || "",
        version: m.version || "",
        versionName: m.version_name,
        mayDisable: true,
        mayEnable: true,
        enabled: true,
        homepageUrl: m.homepage_url,
        updateUrl: m.update_url,
        installType: "development",
        type: "extension",
        offlineEnabled: !!m.offline_enabled,
        isApp: false,
        optionsUrl: o ? ext.virtualUrl(o.path) : "",
        permissions: perms.permissions,
        hostPermissions: perms.origins,
        icons: Object.keys(m.icons || {}).map((s) => ({ size: +s, url: ext.getURL(pickIcon(m.icons, +s)) }))
      };
    };
    return {
      getSelf: fn(() => self2()),
      getAll: fn(() => [self2(), ...others().map(infoOf)]),
      get: fn((id) => id === ext.id ? self2() : infoOf(find(id))),
      getPermissionWarningsByManifest: fn(() => []),
      getPermissionWarningsById: fn(() => []),
      uninstallSelf: fn(() => {
        setTimeout(() => ext.stop(), 0);
      }),
      install: fn(() => {
        throw new Error("management.install can only install themes from addons.mozilla.org, which a web page cannot do.");
      }),
      setEnabled: fn(async (id, enabled) => {
        const x = find(id);
        if (x === ext) throw new Error("Extensions cannot disable themselves.");
        if (!enabled && x.status === "running") {
          await x.stop();
          ext.dispatch("management.onDisabled", () => [infoOf(x)]);
        } else if (enabled && x.status === "stopped") {
          const y = await x.reload();
          ext.dispatch("management.onEnabled", () => [infoOf(y)]);
        }
      }),
      uninstall: fn(async (id) => {
        const x = find(id);
        await x.stop();
        ext.dispatch("management.onUninstalled", [id]);
      }),
      launchApp: fn(() => {
        throw new Error("Chrome Apps are not supported.");
      }),
      createAppShortcut: fn(() => {
        throw new Error("Chrome Apps are not supported.");
      }),
      generateAppForLink: fn(() => {
        throw new Error("Chrome Apps are not supported.");
      }),
      installReplacementWebApp: fn(() => {
        throw new Error("No replacement web app is specified in the manifest.");
      }),
      setLaunchType: fn(() => {
      }),
      canInstallReplacementWebApp: fn(() => false),
      onInstalled: h.event("management.onInstalled"),
      onUninstalled: h.event("management.onUninstalled"),
      onEnabled: h.event("management.onEnabled"),
      onDisabled: h.event("management.onDisabled")
    };
  }

  // src/runtime/capture.js
  var streams = /* @__PURE__ */ new Map();
  async function displayStream({ video = true, audio = false, currentTab = true } = {}) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error("Screen capture is not available in this browser.");
    const opts = { video: video === true ? { displaySurface: currentTab ? "browser" : void 0 } : video, audio: !!audio };
    if (currentTab) Object.assign(opts, { preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "exclude" });
    try {
      return await navigator.mediaDevices.getDisplayMedia(opts);
    } catch (e) {
      if (e && e.name === "NotAllowedError") throw new Error("The user declined to share the screen.", { cause: e });
      if (e && e.name === "InvalidStateError") throw new Error("Screen capture needs a recent user gesture (for example a click in the popup).", { cause: e });
      throw e;
    }
  }
  async function grabFrame(stream) {
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error("No video track to capture.");
    if (typeof ImageCapture === "function") {
      try {
        return await new ImageCapture(track).grabFrame();
      } catch {
      }
    }
    const v = document.createElement("video");
    v.muted = true;
    v.srcObject = stream;
    await v.play();
    await new Promise((r) => v.readyState >= 2 ? r() : v.addEventListener("loadeddata", r, { once: true }));
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    v.srcObject = null;
    return c;
  }
  async function captureVisibleTab(o = {}) {
    const stream = await displayStream({ currentTab: true });
    try {
      const frame = await grabFrame(stream);
      const c = document.createElement("canvas");
      c.width = frame.width;
      c.height = frame.height;
      c.getContext("2d").drawImage(frame, 0, 0);
      const png = o.format === "png";
      return c.toDataURL(png ? "image/png" : "image/jpeg", png ? void 0 : (o.quality ?? 92) / 100);
    } finally {
      stream.getTracks().forEach((t) => t.stop());
    }
  }
  function registerStream(stream) {
    const id = "extshim-stream-" + Math.random().toString(36).slice(2);
    streams.set(id, stream);
    return id;
  }
  function wrapGetUserMedia(win) {
    const md = win.navigator && win.navigator.mediaDevices;
    if (!md || md.__extshimWrapped) return;
    const orig = md.getUserMedia.bind(md);
    const idOf = (c) => c && typeof c === "object" && (c.mandatory && c.mandatory.chromeMediaSourceId || c.chromeMediaSourceId || c.deviceId && typeof c.deviceId === "object" && c.deviceId.exact);
    md.getUserMedia = function getUserMedia(constraints = {}) {
      const id = idOf(constraints.video) || idOf(constraints.audio);
      if (id && streams.has(id)) return Promise.resolve(streams.get(id));
      return orig(constraints);
    };
    try {
      Object.defineProperty(md, "__extshimWrapped", { value: true });
    } catch {
    }
  }

  // src/runtime/tabgroups.js
  var COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
  function tabGroupState(shim) {
    if (!shim.tabGroups) shim.tabGroups = { groups: /* @__PURE__ */ new Map(), of: /* @__PURE__ */ new Map(), next: 1 + Math.floor(Math.random() * 1e5), splits: /* @__PURE__ */ new Map(), nextSplit: 1 };
    return shim.tabGroups;
  }
  function tabOf(ext, id) {
    return id === ext.shim.tabId ? ext.pageTab() : ext.overlayTab(id);
  }
  function groupTabs(ext, o = {}) {
    const gs = tabGroupState(ext.shim);
    const ids = Array.isArray(o.tabIds) ? o.tabIds : [o.tabIds];
    for (const t of ids) if (!tabOf(ext, t)) throw new Error(`No tab with id: ${t}.`);
    let gid = o.groupId;
    if (gid == null) {
      gid = gs.next++;
      gs.groups.set(gid, { id: gid, collapsed: false, color: COLORS[gs.groups.size % COLORS.length], title: "", windowId: ext.shim.windowId, shared: false });
      ext.dispatch("tabGroups.onCreated", () => [{ ...gs.groups.get(gid) }]);
    } else if (!gs.groups.has(gid)) throw new Error(`No group with id: ${gid}.`);
    for (const t of ids) gs.of.set(t, gid);
    for (const t of ids) ext.dispatch("tabs.onUpdated", () => [t, { groupId: gid }, tabOf(ext, t)]);
    return gid;
  }
  function ungroupTabs(ext, tabIds) {
    const gs = tabGroupState(ext.shim);
    for (const t of Array.isArray(tabIds) ? tabIds : [tabIds]) {
      const g = gs.of.get(t);
      gs.of.delete(t);
      ext.dispatch("tabs.onUpdated", () => [t, { groupId: -1 }, tabOf(ext, t)]);
      if (g != null && ![...gs.of.values()].includes(g)) {
        const grp = gs.groups.get(g);
        gs.groups.delete(g);
        ext.dispatch("tabGroups.onRemoved", () => [{ ...grp }]);
      }
    }
  }
  function groupIdOf(shim, tabId) {
    const gs = shim.tabGroups;
    return gs && gs.of.has(tabId) ? gs.of.get(tabId) : -1;
  }
  function splitIdOf(shim, tabId) {
    const gs = shim.tabGroups;
    if (gs) {
      for (const [id, tabs] of gs.splits) if (tabs.includes(tabId)) return id;
    }
    return -1;
  }

  // src/runtime/api/tabs-apis.js
  function readerMode(on) {
    const id = "extshim-reader";
    const old = document.getElementById(id);
    if (old || on === false) {
      if (old) old.remove();
      document.documentElement.style.overflow = "";
      return false;
    }
    const main = document.querySelector("article, main, [role=main]") || [...document.querySelectorAll("div, section")].sort((a, b) => b.innerText.length - a.innerText.length)[0] || document.body;
    const box = document.createElement("div");
    box.id = id;
    box.style.cssText = "position:fixed;inset:0;z-index:2147483646;overflow:auto;background:#fbfbf8;color:#222;font:19px/1.65 Georgia,serif;padding:48px 8vw";
    const close = document.createElement("button");
    close.textContent = "Close reader view";
    close.style.cssText = "position:fixed;top:12px;right:16px;font:13px system-ui;padding:6px 10px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer";
    close.onclick = () => readerMode(false);
    const h = document.createElement("h1");
    h.textContent = document.title;
    h.style.cssText = "font:700 32px/1.2 system-ui,sans-serif;max-width:720px;margin:0 auto 24px";
    const content = main.cloneNode(true);
    content.querySelectorAll("script,style,nav,aside,footer,iframe,form,button,[aria-hidden=true]").forEach((n) => n.remove());
    content.style.cssText = "max-width:720px;margin:0 auto";
    content.querySelectorAll("img").forEach((i) => {
      i.style.maxWidth = "100%";
      i.style.height = "auto";
    });
    box.append(close, h, content);
    document.documentElement.style.overflow = "hidden";
    document.documentElement.appendChild(box);
    return true;
  }
  var NO_RECEIVER3 = "Could not establish connection. Receiving end does not exist.";
  function tabMatches(tab, q) {
    for (const k of ["active", "pinned", "audible", "muted", "highlighted", "discarded", "autoDiscardable", "status", "index", "windowId", "groupId"]) {
      if (q[k] === void 0 || q[k] === null) continue;
      const v = k === "muted" ? tab.mutedInfo.muted : tab[k];
      if (k === "windowId" && q[k] === -2) continue;
      if (v !== q[k]) return false;
    }
    if (q.title && !new RegExp("^" + q.title.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$").test(tab.title || "")) return false;
    if (q.url && !matchesAny(Array.isArray(q.url) ? q.url : [q.url], tab.url)) return false;
    return true;
  }
  function tabsApi(h) {
    const { ctx, ext, fn } = h;
    const shim = ext.shim;
    const all = () => [ext.pageTab(), ...[...ext.overlays.keys()].map((id) => ext.overlayTab(id))];
    const get = (id) => {
      if (id === shim.tabId) return ext.pageTab();
      const t = ext.overlayTab(id);
      if (!t) throw new Error(`No tab with id: ${id}.`);
      return t;
    };
    const tabIdArg = (args) => typeof args[0] === "number" || args[0] == null ? args.shift() ?? shim.tabId : shim.tabId;
    const content = ext.content;
    const frameOf = (tabId) => {
      if (tabId != null && tabId !== shim.tabId) throw new Error(`Cannot access contents of the page. Tab ${tabId} is not scriptable.`);
      return tabId;
    };
    const api = {
      TAB_ID_NONE: -1,
      TAB_INDEX_NONE: -1,
      MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND: 2,
      query: fn((q = {}) => all().filter((t) => {
        if (q.currentWindow === false || q.lastFocusedWindow === false) return false;
        if (q.active === true && t.id !== shim.tabId) return false;
        return tabMatches(t, q);
      })),
      get: fn((id) => get(id)),
      getCurrent: fn(() => ctx.tabId != null && ctx.tabId !== shim.tabId ? ext.overlayTab(ctx.tabId) || void 0 : void 0),
      create: fn(async (p = {}) => {
        const url = p.url || "about:newtab";
        const path = ext.resolvePath(url, ctx.isExtensionPage ? ctx.path : null);
        if (path != null) return ext.openTab(url.startsWith(ext.baseUrl) ? url : ext.virtualUrl(path) + (/[?#].*/.exec(url) || [""])[0]);
        const abs = new URL(url, location.href).href;
        const w = window.open(abs, "_blank");
        if (!w) ext.log.warn(`tabs.create: the browser blocked opening ${abs} (pop-up blocker).`);
        const id = shim.nextTabId();
        return { id, index: 1, windowId: shim.windowId, active: p.active !== false, highlighted: false, pinned: false, incognito: false, status: "loading", url: abs, pendingUrl: abs, title: "", groupId: -1, discarded: false, autoDiscardable: true, mutedInfo: { muted: false }, audible: false, selected: false };
      }),
      duplicate: fn((id) => {
        if (id === shim.tabId) window.open(location.href, "_blank");
        return get(id);
      }),
      update: fn((...args) => {
        const id = typeof args[0] === "number" ? args.shift() : ctx.tabId ?? shim.tabId;
        const props = args[0] || {};
        if (id === shim.tabId) {
          if (props.url) {
            const p = ext.resolvePath(props.url);
            if (p != null) return ext.openTab(props.url);
            setTimeout(() => {
              location.href = props.url;
            }, 0);
          }
          if (props.active) window.focus();
          return { ...ext.pageTab(), ...props.url ? { url: props.url, pendingUrl: props.url, status: "loading" } : {} };
        }
        const o = ext.overlays.get(id);
        if (!o) throw new Error(`No tab with id: ${id}.`);
        if (props.active) o.panel.focus();
        return ext.overlayTab(id);
      }),
      remove: fn((ids) => {
        for (const id of Array.isArray(ids) ? ids : [ids]) {
          if (id === shim.tabId) {
            window.close();
            continue;
          }
          if (!ext.closeOverlay(id)) throw new Error(`No tab with id: ${id}.`);
        }
      }),
      reload: fn((...args) => {
        const id = tabIdArg(args);
        if (id === shim.tabId) setTimeout(() => location.reload(), 0);
      }),
      sendMessage: messageSender(ctx, (args) => {
        const [tabId, message, options = {}] = args;
        if (typeof tabId !== "number") throw new TypeError("Error in invocation of tabs.sendMessage: tabId must be an integer.");
        if (tabId !== shim.tabId) return Promise.reject(new Error(NO_RECEIVER3));
        return ext.bus.send(ctx, message, { tabId, frameId: options.frameId, documentId: options.documentId });
      }),
      sendRequest: (...a) => api.sendMessage(...a),
      connect: (tabId, info = {}) => {
        ctx.assertAlive();
        return ext.bus.connect(ctx, { name: info.name || "", tabId: tabId === shim.tabId ? tabId : -999, frameId: info.frameId });
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
        for (const f of content.targetFrames({ allFrames: d.allFrames })) await content.insertCss(f, { files: d.file ? [d.file] : [], css: d.code || "", origin: d.cssOrigin });
      }),
      removeCSS: fn(async (...args) => {
        frameOf(tabIdArg(args));
        const d = args[0] || {};
        for (const f of content.targetFrames({ allFrames: d.allFrames })) content.removeCss(f, { files: d.file ? [d.file] : [], css: d.code || "" });
      }),
      detectLanguage: fn(() => document.documentElement.lang || "und"),
      getZoom: fn(() => 1),
      setZoom: fn(() => {
      }),
      getZoomSettings: fn(() => ({ mode: "automatic", scope: "per-origin", defaultZoomFactor: 1 })),
      setZoomSettings: fn(() => {
      }),
      highlight: fn(() => ({ id: shim.windowId, focused: true, type: "normal" })),
      move: fn((id) => get(id)),
      discard: fn((id) => get(id)),
      goBack: fn(() => {
        history.back();
      }),
      goForward: fn(() => {
        history.forward();
      }),
      getSelected: fn(() => ext.pageTab()),
      getAllInWindow: fn(() => all()),
      captureVisibleTab: fn((a, b) => captureVisibleTab(typeof a === "object" && a || b || {})),
      captureTab: fn((a, b) => captureVisibleTab(typeof a === "object" && a || b || {})),
      group: fn((o = {}) => groupTabs(ext, o)),
      ungroup: fn((ids) => ungroupTabs(ext, ids)),
      SPLIT_VIEW_ID_NONE: -1,
      createSplit: fn((o = {}) => {
        const gs = tabGroupState(shim);
        const ids = (o.tabIds || []).slice(0, 2);
        if (ids.length !== 2) throw new Error("A split view needs exactly two tabs.");
        const id = gs.nextSplit++;
        gs.splits.set(id, ids);
        return id;
      }),
      unsplit: fn((id) => {
        tabGroupState(shim).splits.delete(id);
      }),
      warmup: fn(() => {
      }),
      toggleReaderMode: fn(() => {
        readerMode();
      }),
      print: fn(() => {
        window.print();
      }),
      printPreview: fn(() => {
        window.print();
      }),
      saveAsPDF: fn(() => {
        window.print();
        return "saved";
      }),
      hide: fn((ids) => (Array.isArray(ids) ? ids : [ids]).filter((id) => id !== shim.tabId)),
      show: fn(() => {
      }),
      moveInSuccession: fn(() => {
      }),
      onCreated: h.event("tabs.onCreated"),
      onUpdated: h.event("tabs.onUpdated"),
      onActivated: h.event("tabs.onActivated"),
      onActiveChanged: h.event("tabs.onActiveChanged"),
      onHighlighted: h.event("tabs.onHighlighted"),
      onHighlightChanged: h.event("tabs.onHighlightChanged"),
      onRemoved: h.event("tabs.onRemoved"),
      onReplaced: h.event("tabs.onReplaced"),
      onMoved: h.event("tabs.onMoved"),
      onAttached: h.event("tabs.onAttached"),
      onDetached: h.event("tabs.onDetached"),
      onZoomChange: h.event("tabs.onZoomChange"),
      onSelectionChanged: h.event("tabs.onSelectionChanged"),
      TabStatus: { UNLOADED: "unloaded", LOADING: "loading", COMPLETE: "complete" },
      WindowType: { NORMAL: "normal", POPUP: "popup", PANEL: "panel", APP: "app", DEVTOOLS: "devtools" },
      MutedInfoReason: { USER: "user", CAPTURE: "capture", EXTENSION: "extension" },
      ZoomSettingsMode: { AUTOMATIC: "automatic", MANUAL: "manual", DISABLED: "disabled" },
      ZoomSettingsScope: { PER_ORIGIN: "per-origin", PER_TAB: "per-tab" }
    };
    return api;
  }
  function windowsApi(h) {
    const { ext, fn } = h;
    const shim = ext.shim;
    const win = (populate) => {
      const w = {
        id: shim.windowId,
        focused: document.hasFocus(),
        top: window.screenY | 0,
        left: window.screenX | 0,
        width: window.outerWidth || innerWidth,
        height: window.outerHeight || innerHeight,
        incognito: false,
        type: "normal",
        state: document.fullscreenElement ? "fullscreen" : "normal",
        alwaysOnTop: false,
        sessionId: void 0
      };
      if (populate) w.tabs = [ext.pageTab(), ...[...ext.overlays.keys()].map((id) => ext.overlayTab(id))];
      return w;
    };
    return {
      WINDOW_ID_NONE: -1,
      WINDOW_ID_CURRENT: -2,
      get: fn((id, o = {}) => {
        if (id !== shim.windowId && id !== -2) throw new Error(`No window with id: ${id}.`);
        return win(o && o.populate);
      }),
      getCurrent: fn((o = {}) => win(o && o.populate)),
      getLastFocused: fn((o = {}) => win(o && o.populate)),
      getAll: fn((o = {}) => [win(o && o.populate)]),
      create: fn(async (o = {}) => {
        const urls = o.url ? Array.isArray(o.url) ? o.url : [o.url] : [];
        const tabs = [];
        for (const u of urls) {
          const p = ext.resolvePath(u, "");
          if (p != null) tabs.push(await ext.openTab(ext.virtualUrl(p) + (/[?#].*/.exec(u) || [""])[0], { kind: o.type === "popup" || o.type === "panel" ? "window" : "tab", width: o.width, height: o.height }));
          else {
            const features2 = o.type === "popup" ? `popup,width=${o.width || 600},height=${o.height || 500}${o.left != null ? ",left=" + o.left : ""}${o.top != null ? ",top=" + o.top : ""}` : "";
            window.open(new URL(u, location.href).href, "_blank", features2);
          }
        }
        return { ...win(false), id: shim.nextTabId(), type: o.type || "normal", tabs };
      }),
      update: fn(() => win(false)),
      remove: fn(() => {
        for (const [tabId, o] of ext.overlays) if (o.panel.kind === "window") ext.closeOverlay(tabId);
      }),
      onCreated: h.event("windows.onCreated"),
      onRemoved: h.event("windows.onRemoved"),
      onFocusChanged: h.event("windows.onFocusChanged"),
      onBoundsChanged: h.event("windows.onBoundsChanged"),
      WindowType: { NORMAL: "normal", POPUP: "popup", PANEL: "panel", APP: "app", DEVTOOLS: "devtools" },
      WindowState: { NORMAL: "normal", MINIMIZED: "minimized", MAXIMIZED: "maximized", FULLSCREEN: "fullscreen", LOCKED_FULLSCREEN: "locked-fullscreen" },
      CreateType: { NORMAL: "normal", POPUP: "popup", PANEL: "panel" }
    };
  }
  function scriptingApi(h) {
    const { ctx, ext, fn } = h;
    const content = ext.content;
    const shim = ext.shim;
    const check = (target) => {
      if (!target || typeof target.tabId !== "number") throw new TypeError("Error in invocation of scripting: target.tabId is required.");
      if (target.tabId !== shim.tabId) throw new Error(`Cannot access contents of the page. Extension manifest must request permission to access the respective host.`);
    };
    const reg = ext.shared("registeredScripts", () => ({ map: /* @__PURE__ */ new Map(), loaded: null }));
    const internal = ext.storage.internal();
    const load = () => reg.loaded || (reg.loaded = internal.get("registeredScripts").then((r) => {
      for (const s of r.registeredScripts || []) reg.map.set(s.id, s);
    }));
    const save = () => internal.set({ registeredScripts: [...reg.map.values()].filter((s) => s.persistAcrossSessions !== false) });
    const norm = (s) => ({
      id: s.id,
      matches: s.matches || [],
      excludeMatches: s.excludeMatches || [],
      js: s.js || [],
      css: s.css || [],
      runAt: s.runAt || "document_idle",
      allFrames: !!s.allFrames,
      world: s.world || "ISOLATED",
      persistAcrossSessions: s.persistAcrossSessions !== false,
      matchOriginAsFallback: !!s.matchOriginAsFallback
    });
    return {
      executeScript: fn(async (inj = {}) => {
        check(inj.target);
        if (!inj.func && !inj.files && !inj.function) throw new Error("Exactly one of 'func' and 'files' must be specified");
        return content.execute(ctx, {
          target: inj.target,
          func: inj.func || inj.function,
          args: inj.args || [],
          files: inj.files && inj.files.map((p) => normalizePath(p)),
          world: inj.world
        });
      }),
      insertCSS: fn(async (inj = {}) => {
        check(inj.target);
        for (const f of content.targetFrames(inj.target)) await content.insertCss(f, { files: inj.files || [], css: inj.css || "", origin: inj.origin });
      }),
      removeCSS: fn(async (inj = {}) => {
        check(inj.target);
        for (const f of content.targetFrames(inj.target)) content.removeCss(f, { files: inj.files || [], css: inj.css || "" });
      }),
      registerContentScripts: fn(async (scripts = []) => {
        await load();
        for (const s of scripts) {
          if (!s.id || s.id.startsWith("_")) throw new Error("Invalid content script id.");
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
      ExecutionWorld: { ISOLATED: "ISOLATED", MAIN: "MAIN" },
      StyleOrigin: { AUTHOR: "AUTHOR", USER: "USER" },
      RunAt: { DOCUMENT_START: "document_start", DOCUMENT_END: "document_end", DOCUMENT_IDLE: "document_idle" }
    };
  }

  // src/runtime/api/ui-apis.js
  var ActionState = class {
    constructor(ext) {
      this.ext = ext;
      const a = ext.action;
      this.global = {
        title: a.title,
        popup: a.popup,
        badgeText: "",
        badgeBg: [217, 48, 37, 255],
        badgeFg: null,
        icon: a.icon ? { path: a.icon } : null,
        enabled: a.kind !== "page_action"
      };
      this.tabs = /* @__PURE__ */ new Map();
    }
    get(prop, tabId) {
      const t = tabId != null && this.tabs.get(tabId);
      if (t && prop in t) return t[prop];
      const p = this.tabs.get(this.ext.shim.tabId);
      if (tabId == null && p && prop in p) return p[prop];
      return this.global[prop];
    }
    set(prop, value, tabId) {
      if (tabId != null) {
        if (!this.tabs.has(tabId)) this.tabs.set(tabId, {});
        if (value === null || value === void 0) delete this.tabs.get(tabId)[prop];
        else this.tabs.get(tabId)[prop] = value;
      } else this.global[prop] = value;
      this.refresh();
    }
    refresh() {
      const L = this.ext.launcher;
      if (!L) return;
      const icon = this.get("icon");
      L.update({
        title: this.get("title") || this.ext.name,
        badgeText: this.get("badgeText") || "",
        badgeBg: this.get("badgeBg"),
        badgeFg: this.get("badgeFg"),
        icon,
        enabled: this.get("enabled"),
        hasPopup: !!this.get("popup")
      });
    }
  };
  function resolveIconPath(ext, ctx, path) {
    if (!path) return null;
    if (typeof path === "string") return ext.resolvePath(path, ctx.isExtensionPage ? ctx.path : "") ?? path;
    const out = {};
    for (const k of Object.keys(path)) out[k] = ext.resolvePath(path[k], ctx.isExtensionPage ? ctx.path : "") ?? path[k];
    return out;
  }
  function actionApi(h, kind) {
    const { ctx, ext, fn } = h;
    const st = ext.state.action;
    const tabOf2 = (d) => d && typeof d.tabId === "number" ? d.tabId : null;
    const api = {
      setTitle: fn((d = {}) => st.set("title", d.title, tabOf2(d))),
      getTitle: fn((d = {}) => st.get("title", tabOf2(d)) || ""),
      setIcon: fn((d = {}) => {
        let icon = null;
        if (d.imageData) {
          let data = d.imageData;
          if (!(data instanceof ImageData) && typeof data === "object") {
            const sizes = Object.keys(data).map(Number).sort((a, b) => a - b);
            data = data[sizes.find((s) => s >= 32) || sizes[sizes.length - 1]];
          }
          icon = { imageData: data };
        } else if (d.path) icon = { path: resolveIconPath(ext, ctx, d.path) };
        st.set("icon", icon, tabOf2(d));
      }),
      setPopup: fn((d = {}) => st.set("popup", d.popup ? ext.resolvePath(d.popup, ctx.isExtensionPage ? ctx.path : "") ?? d.popup : "", tabOf2(d))),
      getPopup: fn((d = {}) => {
        const p = st.get("popup", tabOf2(d));
        return p ? ext.virtualUrl(p) : "";
      }),
      setBadgeText: fn((d = {}) => st.set("badgeText", d.text == null ? tabOf2(d) != null ? null : "" : String(d.text), tabOf2(d))),
      getBadgeText: fn((d = {}) => st.get("badgeText", tabOf2(d)) || ""),
      setBadgeBackgroundColor: fn((d = {}) => st.set("badgeBg", toRGBA(d.color), tabOf2(d))),
      getBadgeBackgroundColor: fn((d = {}) => st.get("badgeBg", tabOf2(d))),
      setBadgeTextColor: fn((d = {}) => st.set("badgeFg", d.color == null ? null : toRGBA(d.color), tabOf2(d))),
      getBadgeTextColor: fn((d = {}) => st.get("badgeFg", tabOf2(d)) || [255, 255, 255, 255]),
      enable: fn((tabId) => st.set("enabled", true, typeof tabId === "number" ? tabId : null)),
      disable: fn((tabId) => st.set("enabled", false, typeof tabId === "number" ? tabId : null)),
      isEnabled: fn((tabId) => !!st.get("enabled", typeof tabId === "number" ? tabId : null)),
      openPopup: fn(async () => {
        const popup = st.get("popup");
        if (!popup) throw new Error("Extension does not have a popup on the active tab.");
        await ext.togglePopup(popup, { forceOpen: true });
      }),
      getUserSettings: fn(() => ({ isOnToolbar: true })),
      onClicked: h.event(`${kind}.onClicked`),
      onUserSettingsChanged: h.event(`${kind}.onUserSettingsChanged`)
    };
    if (kind === "pageAction") {
      api.show = fn((tabId) => st.set("enabled", true, typeof tabId === "number" ? tabId : null));
      api.hide = fn((tabId) => st.set("enabled", false, typeof tabId === "number" ? tabId : null));
      api.isShown = fn((d = {}) => !!st.get("enabled", typeof d.tabId === "number" ? d.tabId : null));
    }
    return api;
  }
  var MenusState = class {
    constructor(ext) {
      this.ext = ext;
      this.items = /* @__PURE__ */ new Map();
      this.handlers = /* @__PURE__ */ new Map();
      this.nextId = 1;
      const bg = getBackground(ext.manifest);
      this.persist = !!bg && (bg.kind === "worker" || ext.manifest.background.persistent === false);
      if (this.persist) for (const it of ext.storage.internal().data.menus || []) this.items.set(it.id, it);
      for (const id of this.items.keys()) if (typeof id === "number" && id >= this.nextId) this.nextId = id + 1;
      this.loaded = Promise.resolve();
      this.unregister = ext.shim.ui.registerMenuProvider(ext, (info) => this.tree(info));
    }
    dispose() {
      this.unregister();
    }
    save() {
      if (this.persist) this.ext.storage.internal().set({ menus: [...this.items.values()] });
    }
    create(props, ctx) {
      const id = props.id != null ? props.id : this.nextId++;
      if (this.items.has(id)) throw new Error(`Cannot create item with duplicate id ${id}`);
      if (props.parentId != null && !this.items.has(props.parentId)) throw new Error(`Cannot find menu item with id ${props.parentId}`);
      const item = { type: "normal", contexts: ["page"], enabled: true, visible: true, checked: false, ...props, id };
      delete item.onclick;
      this.items.set(id, item);
      if (typeof props.onclick === "function") this.handlers.set(id, { fn: props.onclick, ctx });
      this.save();
      return id;
    }
    update(id, props, ctx) {
      const it = this.items.get(id);
      if (!it) throw new Error(`Cannot find menu item with id ${id}`);
      const { onclick, ...rest } = props;
      Object.assign(it, rest);
      if (typeof onclick === "function") this.handlers.set(id, { fn: onclick, ctx });
      this.save();
    }
    remove(id) {
      if (!this.items.has(id)) throw new Error(`Cannot find menu item with id ${id}`);
      const kill = (x) => {
        this.items.delete(x);
        this.handlers.delete(x);
        for (const it of [...this.items.values()]) if (it.parentId === x) kill(it.id);
      };
      kill(id);
      this.save();
    }
    removeAll() {
      this.items.clear();
      this.handlers.clear();
      this.save();
    }
    applies(it, info) {
      if (!it.visible) return false;
      const c = it.contexts || ["page"];
      if (it.documentUrlPatterns && !matchesAny(it.documentUrlPatterns, info.pageUrl)) return false;
      if (it.targetUrlPatterns && (info.linkUrl || info.srcUrl) && !matchesAny(it.targetUrlPatterns, info.linkUrl || info.srcUrl)) return false;
      if (c.includes("all")) return !info.launcher;
      return info.contexts.some((x) => c.includes(x));
    }
    /** Build the menu tree for a click; consumed by ui.js. */
    tree(info) {
      const ext = this.ext;
      const build = (parentId) => {
        const list = [...this.items.values()].filter((it) => (it.parentId ?? null) === parentId && (it.type === "separator" || this.applies(it, info)));
        return list.map((it) => ({
          id: it.id,
          type: it.type,
          label: String(it.title || "").replace(/%s/g, (info.selectionText || "").slice(0, 64)),
          enabled: it.enabled !== false,
          checked: !!it.checked,
          children: build(it.id),
          onClick: () => this.click(it, info)
        })).filter((x) => x.type === "separator" || x.type !== "normal" || x.children.length || !this.hasChildren(x.id));
      };
      return { title: ext.name, ext, items: build(null) };
    }
    hasChildren(id) {
      for (const it of this.items.values()) if (it.parentId === id) return true;
      return false;
    }
    click(it, info) {
      const ext = this.ext;
      const wasChecked = !!it.checked;
      if (it.type === "checkbox") it.checked = !it.checked;
      if (it.type === "radio") {
        const siblings = [...this.items.values()].filter((x) => (x.parentId ?? null) === (it.parentId ?? null));
        const i = siblings.indexOf(it);
        let a = i, b = i;
        while (a > 0 && siblings[a - 1].type === "radio") a--;
        while (b < siblings.length - 1 && siblings[b + 1].type === "radio") b++;
        for (let k = a; k <= b; k++) siblings[k].checked = siblings[k] === it;
      }
      this.save();
      const data = {
        menuItemId: it.id,
        parentMenuItemId: it.parentId,
        editable: !!info.editable,
        pageUrl: info.pageUrl,
        frameId: 0,
        frameUrl: info.frameUrl,
        linkUrl: info.linkUrl,
        linkText: info.linkText,
        srcUrl: info.srcUrl,
        mediaType: info.mediaType,
        selectionText: info.selectionText || void 0,
        ...it.type === "checkbox" || it.type === "radio" ? { wasChecked, checked: !!it.checked } : {},
        button: 0,
        modifiers: []
      };
      for (const k of Object.keys(data)) if (data[k] === void 0) delete data[k];
      const tab = ext.pageTab();
      ext.dispatch("contextMenus.onClicked", () => [JSON.parse(JSON.stringify(data)), tab]);
      ext.dispatch("menus.onClicked", () => [JSON.parse(JSON.stringify(data)), tab]);
      const hnd = this.handlers.get(it.id);
      if (hnd && hnd.ctx.alive) {
        try {
          hnd.fn(data, tab);
        } catch (e) {
          ext.log.error("Error in contextMenus onclick handler:", e);
        }
      }
    }
  };
  function menusApi(h, ns) {
    const { ctx, ext, fn } = h;
    const st = ext.shared("menus", () => new MenusState(ext));
    return {
      create(props = {}, cb) {
        ctx.assertAlive();
        let id;
        let err = null;
        try {
          id = st.create(props, ctx);
        } catch (e) {
          err = e;
          id = props.id;
        }
        if (typeof cb === "function") setTimeout(() => ctx.callback(cb, err), 0);
        else if (err) ext.log.warn("Unchecked runtime.lastError:", err.message);
        return id;
      },
      update: fn(async (id, props = {}) => {
        await st.loaded;
        st.update(id, props, ctx);
      }),
      remove: fn(async (id) => {
        await st.loaded;
        st.remove(id);
      }),
      removeAll: fn(async () => {
        await st.loaded;
        st.removeAll();
      }),
      refresh: fn(() => {
      }),
      getTargetElement: () => ext.shim.ui.lastContextTarget || null,
      overrideContext: () => {
      },
      onClicked: h.event(`${ns}.onClicked`),
      onShown: h.event(`${ns}.onShown`),
      onHidden: h.event(`${ns}.onHidden`),
      ACTION_MENU_TOP_LEVEL_LIMIT: 6,
      ContextType: { ALL: "all", PAGE: "page", FRAME: "frame", SELECTION: "selection", LINK: "link", EDITABLE: "editable", IMAGE: "image", VIDEO: "video", AUDIO: "audio", LAUNCHER: "launcher", BROWSER_ACTION: "browser_action", PAGE_ACTION: "page_action", ACTION: "action" },
      ItemType: { NORMAL: "normal", CHECKBOX: "checkbox", RADIO: "radio", SEPARATOR: "separator" }
    };
  }
  function startCommands(ext) {
    const isMac = /mac/i.test(navigator.userAgentData && navigator.userAgentData.platform || navigator.platform || "");
    const os = isMac ? "mac" : /win/i.test(navigator.platform) ? "windows" : /CrOS/.test(navigator.userAgent) ? "chromeos" : "linux";
    const list = [];
    for (const [name, c] of Object.entries(ext.manifest.commands || {})) {
      const sk = c && c.suggested_key || {};
      const text = typeof sk === "string" ? sk : sk[os] || sk.default || "";
      list.push({ name, description: c && c.description ? ext.localized.commands?.[name]?.description || c.description : "", text, sc: parseShortcut(text, isMac) });
    }
    const trigger = (name) => {
      if (/^_execute_(action|browser_action|page_action)$/.test(name)) return ext.clickAction();
      if (name === "_execute_sidebar_action") return ext.openSidePanel().catch(() => {
      });
      ext.dispatch("commands.onCommand", () => [name, ext.pageTab()]);
    };
    const onKey = (e) => {
      for (const c of list) {
        if (c.sc && shortcutMatches(c.sc, e)) {
          e.preventDefault();
          e.stopPropagation();
          trigger(c.name);
          return;
        }
      }
    };
    const wins = /* @__PURE__ */ new Set();
    const attach = (win) => {
      if (!list.some((c) => c.sc) || wins.has(win)) return;
      wins.add(win);
      win.addEventListener("keydown", onKey, true);
    };
    ext.state.commands = { list, attach, trigger };
    attach(window);
    return () => {
      for (const w of wins) {
        try {
          w.removeEventListener("keydown", onKey, true);
        } catch {
        }
      }
      wins.clear();
    };
  }
  function commandsApi(h) {
    const { ext, fn } = h;
    const st = () => ext.state.commands || { list: [] };
    return {
      getAll: fn(() => st().list.map((c) => ({ name: c.name, description: c.description, shortcut: c.sc ? c.text : "" }))),
      update: fn((d = {}) => {
        const c = st().list.find((x) => x.name === d.name);
        if (!c) throw new Error("Unknown command: " + d.name);
        if (d.shortcut !== void 0) {
          c.text = d.shortcut;
          c.sc = parseShortcut(d.shortcut, /mac/i.test(navigator.platform));
        }
        if (d.description !== void 0) c.description = d.description;
      }),
      reset: fn((name) => {
        void name;
      }),
      openShortcutSettings: fn(() => ext.shim.ui.shortcuts(ext)),
      onCommand: h.event("commands.onCommand"),
      onChanged: h.event("commands.onChanged")
    };
  }
  var NotificationsState = class {
    constructor(ext) {
      this.ext = ext;
      this.map = /* @__PURE__ */ new Map();
      this.n = 0;
    }
    resolveUrl(u, ctx) {
      if (!u) return "";
      if (/^(data|blob|https?):/i.test(u)) return u;
      const p = this.ext.resolvePath(u, ctx && ctx.isExtensionPage ? ctx.path : "");
      return p != null && this.ext.vfs.has(p) ? this.ext.resourceUrl(p) : u;
    }
    view(o, ctx) {
      return {
        title: o.title || "",
        message: o.message || "",
        contextMessage: o.contextMessage || "",
        icon: this.resolveUrl(o.iconUrl, ctx) || (this.ext.iconPath(48) ? this.ext.resourceUrl(this.ext.iconPath(48)) : ""),
        image: o.type === "image" ? this.resolveUrl(o.imageUrl, ctx) : "",
        items: o.type === "list" ? o.items || [] : [],
        progress: o.type === "progress" ? o.progress : null,
        buttons: (o.buttons || []).slice(0, 2).map((b) => b.title),
        requireInteraction: !!o.requireInteraction,
        silent: !!o.silent,
        appName: this.ext.name
      };
    }
    create(id, options = {}, ctx) {
      const ext = this.ext;
      id = id || `extshim-${Date.now().toString(36)}-${++this.n}`;
      if (this.map.has(id)) this.map.get(id).toast.close(false, true);
      const entry = { options: { ...options } };
      entry.toast = ext.shim.ui.toast(ext, this.view(options, ctx), {
        onClick: () => ext.dispatch("notifications.onClicked", [id]),
        onButton: (i) => ext.dispatch("notifications.onButtonClicked", [id, i]),
        onClose: (byUser, silent) => {
          if (this.map.get(id) === entry) this.map.delete(id);
          if (!silent) ext.dispatch("notifications.onClosed", [id, !!byUser]);
        }
      });
      this.map.set(id, entry);
      ext.dispatch("notifications.onShown", [id]);
      return id;
    }
    update(id, options, ctx) {
      const e = this.map.get(id);
      if (!e) return false;
      Object.assign(e.options, options);
      e.toast.update(this.view(e.options, ctx));
      return true;
    }
    clear(id) {
      const e = this.map.get(id);
      if (!e) return false;
      e.toast.close(false);
      return true;
    }
    dispose() {
      for (const e of this.map.values()) e.toast.close(false, true);
      this.map.clear();
    }
  };
  function notificationsApi(h) {
    const { ctx, ext, fn } = h;
    const st = ext.shared("notifications", () => new NotificationsState(ext));
    return {
      create: fn((a, b) => typeof a === "string" || a == null ? st.create(a, b, ctx) : st.create(null, a, ctx)),
      update: fn((id, o) => st.update(id, o || {}, ctx)),
      clear: fn((id) => st.clear(id)),
      getAll: fn(() => Object.fromEntries([...st.map.keys()].map((k) => [k, true]))),
      getPermissionLevel: fn(() => "granted"),
      onClicked: h.event("notifications.onClicked"),
      onButtonClicked: h.event("notifications.onButtonClicked"),
      onClosed: h.event("notifications.onClosed"),
      onPermissionLevelChanged: h.event("notifications.onPermissionLevelChanged"),
      onShowSettings: h.event("notifications.onShowSettings"),
      onShown: h.event("notifications.onShown"),
      TemplateType: { BASIC: "basic", IMAGE: "image", LIST: "list", PROGRESS: "progress" },
      PermissionLevel: { GRANTED: "granted", DENIED: "denied" }
    };
  }
  function sidePanelState(ext) {
    return ext.shared("sidePanel", () => {
      const saved = ext.storage.internal().data.sidePanelBehavior;
      return { options: { path: getSidePanel(ext.localized), enabled: true }, tabs: /* @__PURE__ */ new Map(), behavior: { openPanelOnActionClick: false, ...saved || {} } };
    });
  }
  function sidePanelApi(h) {
    const { ext, fn } = h;
    const st = sidePanelState(ext);
    return {
      setOptions: fn((o = {}) => {
        const target = o.tabId != null ? st.tabs.get(o.tabId) || st.tabs.set(o.tabId, {}).get(o.tabId) : st.options;
        if (o.path !== void 0) target.path = ext.resolvePath(o.path, "") ?? o.path;
        if (o.enabled !== void 0) target.enabled = o.enabled;
      }),
      getOptions: fn((o = {}) => {
        const t = o.tabId != null ? { ...st.options, ...st.tabs.get(o.tabId) || {} } : st.options;
        return { path: t.path ? ext.virtualUrl(t.path) : void 0, enabled: t.enabled !== false, tabId: o.tabId };
      }),
      setPanelBehavior: fn(async (b = {}) => {
        Object.assign(st.behavior, b);
        await ext.storage.internal().set({ sidePanelBehavior: st.behavior });
      }),
      getPanelBehavior: fn(() => ({ ...st.behavior })),
      open: fn(async (o = {}) => {
        const t = o.tabId != null ? { ...st.options, ...st.tabs.get(o.tabId) || {} } : st.options;
        await ext.openSidePanel(t.path);
      }),
      close: fn(() => {
        for (const [id, ov] of ext.overlays) if (ov.panel.kind === "side") ext.closeOverlay(id);
      }),
      getLayout: fn(() => ({ side: "right" })),
      onOpened: h.event("sidePanel.onOpened"),
      onClosed: h.event("sidePanel.onClosed")
    };
  }
  function sidebarActionApi(h) {
    const { ext, fn } = h;
    const st = sidePanelState(ext);
    const isOpen = () => [...ext.overlays.values()].some((o) => o.panel.kind === "side");
    const close = () => {
      for (const [id, ov] of ext.overlays) if (ov.panel.kind === "side") ext.closeOverlay(id);
    };
    return {
      open: fn(() => ext.openSidePanel(st.options.path)),
      close: fn(close),
      toggle: fn(() => isOpen() ? close() : ext.openSidePanel(st.options.path)),
      isOpen: fn(() => isOpen()),
      setPanel: fn((d = {}) => {
        st.options.path = d.panel ? ext.resolvePath(d.panel, "") ?? d.panel : getSidePanel(ext.localized);
      }),
      getPanel: fn(() => st.options.path ? ext.virtualUrl(st.options.path) : ""),
      setTitle: fn((d = {}) => {
        st.title = d.title;
      }),
      getTitle: fn(() => st.title || ext.name),
      setIcon: fn(() => {
      })
    };
  }
  var OmniboxState = class {
    constructor(ext) {
      this.ext = ext;
      this.keyword = ext.manifest.omnibox && ext.manifest.omnibox.keyword || "";
      this.defaultSuggestion = null;
      this.session = null;
    }
    open() {
      const ext = this.ext;
      if (this.session) {
        this.session.focus();
        return;
      }
      let started = false;
      let seq = 0;
      this.session = ext.shim.ui.palette(ext, {
        keyword: this.keyword,
        defaultSuggestion: () => this.defaultSuggestion && this.defaultSuggestion.description,
        onInput: (text, show) => {
          if (!started) {
            started = true;
            ext.dispatch("omnibox.onInputStarted", []);
          }
          const mine = ++seq;
          ext.dispatch("omnibox.onInputChanged", () => [text, (results) => {
            if (mine === seq) show(Array.isArray(results) ? results : []);
          }]);
        },
        onEnter: (text, disposition) => {
          this.session = null;
          ext.dispatch("omnibox.onInputEntered", [text, disposition]);
        },
        onCancel: () => {
          this.session = null;
          if (started) ext.dispatch("omnibox.onInputCancelled", []);
        },
        onDelete: (text) => ext.dispatch("omnibox.onDeleteSuggestion", [text])
      });
    }
  };
  function omniboxApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("omnibox", () => new OmniboxState(ext));
    return {
      setDefaultSuggestion: fn((s) => {
        st.defaultSuggestion = s || null;
      }),
      onInputStarted: h.event("omnibox.onInputStarted"),
      onInputChanged: h.event("omnibox.onInputChanged"),
      onInputEntered: h.event("omnibox.onInputEntered"),
      onInputCancelled: h.event("omnibox.onInputCancelled"),
      onDeleteSuggestion: h.event("omnibox.onDeleteSuggestion"),
      OnInputEnteredDisposition: { CURRENT_TAB: "currentTab", NEW_FOREGROUND_TAB: "newForegroundTab", NEW_BACKGROUND_TAB: "newBackgroundTab" },
      DescriptionStyleType: { URL: "url", MATCH: "match", DIM: "dim" }
    };
  }

  // src/runtime/api/misc-apis.js
  var AlarmsState = class {
    constructor(ext) {
      this.ext = ext;
      this.map = /* @__PURE__ */ new Map();
      for (const a of ext.storage.internal().data.alarms || []) this.map.set(a.name, { alarm: a, timer: null });
      ext.whenBackgroundReady().then(() => {
        for (const e of this.map.values()) this.schedule(e);
      });
    }
    save() {
      this.ext.storage.internal().set({ alarms: [...this.map.values()].map((e) => e.alarm) });
    }
    schedule(e) {
      clearTimeout(e.timer);
      const delay = Math.max(0, e.alarm.scheduledTime - Date.now());
      e.timer = setTimeout(() => delay > 2 ** 31 - 2 ? this.schedule(e) : this.fire(e), Math.min(delay, 2 ** 31 - 2));
    }
    fire(e) {
      if (this.map.get(e.alarm.name) !== e) return;
      const a = { ...e.alarm };
      this.ext.dispatch("alarms.onAlarm", () => [{ ...a }]);
      if (e.alarm.periodInMinutes) {
        e.alarm.scheduledTime = Date.now() + e.alarm.periodInMinutes * 6e4;
        this.schedule(e);
      } else this.map.delete(e.alarm.name);
      this.save();
    }
    create(name, info = {}) {
      const now2 = Date.now();
      let when = info.when;
      if (when == null) when = now2 + (info.delayInMinutes ?? info.periodInMinutes ?? 0) * 6e4;
      const alarm = { name, scheduledTime: when };
      if (info.periodInMinutes) alarm.periodInMinutes = info.periodInMinutes;
      const old = this.map.get(name);
      if (old) clearTimeout(old.timer);
      const e = { alarm, timer: null };
      this.map.set(name, e);
      this.schedule(e);
      this.save();
    }
    clear(name) {
      const e = this.map.get(name);
      if (!e) return false;
      clearTimeout(e.timer);
      this.map.delete(name);
      this.save();
      return true;
    }
    dispose() {
      for (const e of this.map.values()) clearTimeout(e.timer);
    }
  };
  function alarmsApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("alarms", () => new AlarmsState(ext));
    return {
      create: fn((a, b) => {
        if (typeof a === "string") st.create(a, b);
        else st.create("", a);
      }),
      get: fn((name = "") => {
        const e = st.map.get(name);
        return e ? { ...e.alarm } : void 0;
      }),
      getAll: fn(() => [...st.map.values()].map((e) => ({ ...e.alarm }))),
      clear: fn((name = "") => st.clear(name)),
      clearAll: fn(() => {
        const any = st.map.size > 0;
        for (const n of [...st.map.keys()]) st.clear(n);
        return any;
      }),
      onAlarm: h.event("alarms.onAlarm")
    };
  }
  function downloadsApi(h) {
    const { ext, fn, ctx } = h;
    const st = ext.shared("downloads", () => ({ n: 0, items: /* @__PURE__ */ new Map() }));
    return {
      download: fn(async (o = {}) => {
        const id = ++st.n;
        let href = o.url;
        const p = ext.resolvePath(o.url, ctx.isExtensionPage ? ctx.path : null);
        if (p != null) href = URL.createObjectURL(await ext.vfs.blob(p));
        else if (/^https?:/i.test(href) && new URL(href).origin !== location.origin) {
          try {
            const r = await ext.shim.nativeFetch(href, { method: o.method || "GET", headers: Object.fromEntries((o.headers || []).map((x) => [x.name, x.value])), body: o.body });
            href = URL.createObjectURL(await r.blob());
          } catch {
          }
        }
        const name = (o.filename || "").split(/[\\/]/).pop() || (o.url.split(/[?#]/)[0].split("/").pop() || "download");
        const a = document.createElement("a");
        a.href = href;
        a.download = name;
        a.rel = "noopener";
        a.style.display = "none";
        (document.body || document.documentElement).appendChild(a);
        a.click();
        a.remove();
        if (href.startsWith("blob:") && href !== o.url) setTimeout(() => URL.revokeObjectURL(href), 6e5);
        const item = { href, id, url: o.url, finalUrl: o.url, filename: name, state: "complete", mime: "", startTime: (/* @__PURE__ */ new Date()).toISOString(), endTime: (/* @__PURE__ */ new Date()).toISOString(), exists: true, paused: false, canResume: false, danger: "safe", incognito: false, bytesReceived: 0, totalBytes: -1, fileSize: -1, byExtensionId: ext.id, byExtensionName: ext.name, referrer: "" };
        st.items.set(id, item);
        ext.dispatch("downloads.onCreated", () => [{ ...item, state: "in_progress" }]);
        ext.dispatch("downloads.onChanged", () => [{ id, state: { previous: "in_progress", current: "complete" } }]);
        return id;
      }),
      search: fn((q = {}) => [...st.items.values()].filter((i) => q.id == null || i.id === q.id)),
      erase: fn((q = {}) => {
        const ids = [...st.items.keys()].filter((i) => q.id == null || i === q.id);
        ids.forEach((i) => st.items.delete(i));
        return ids;
      }),
      cancel: fn(() => {
      }),
      pause: fn(() => {
      }),
      resume: fn(() => {
      }),
      open: fn((id) => {
        const it = st.items.get(id);
        if (!it) throw new Error("Invalid download id " + id);
        window.open(it.href || it.url, "_blank", "noopener");
      }),
      show: fn((id) => {
        const it = st.items.get(id);
        if (!it) return false;
        window.open(it.href || it.url, "_blank", "noopener");
        return true;
      }),
      showDefaultFolder: fn(() => {
      }),
      removeFile: fn((id) => {
        const it = st.items.get(id);
        if (it) it.exists = false;
      }),
      getFileIcon: fn((id) => {
        const it = st.items.get(id);
        if (!it) throw new Error("Invalid download id " + id);
        return "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#5f6368" d="M7 3h12l6 6v20H7z"/><path fill="#fff" d="M19 3v6h6"/></svg>');
      }),
      acceptDanger: fn(() => {
      }),
      drag: fn(() => {
      }),
      setShelfEnabled: () => {
      },
      setUiOptions: fn(() => {
      }),
      onCreated: h.event("downloads.onCreated"),
      onChanged: h.event("downloads.onChanged"),
      onErased: h.event("downloads.onErased"),
      onDeterminingFilename: h.event("downloads.onDeterminingFilename")
    };
  }
  function idleApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("idle", () => {
      const s = { last: Date.now(), interval: 60, state: "active", timer: null };
      const bump = () => {
        s.last = Date.now();
        if (s.state !== "active") {
          s.state = "active";
          ext.dispatch("idle.onStateChanged", ["active"]);
        }
      };
      const evs = ["pointerdown", "keydown", "wheel", "touchstart", "mousemove"];
      evs.forEach((e) => window.addEventListener(e, bump, { capture: true, passive: true }));
      s.timer = setInterval(() => {
        if (s.state === "active" && Date.now() - s.last > s.interval * 1e3) {
          s.state = "idle";
          ext.dispatch("idle.onStateChanged", ["idle"]);
        }
      }, 15e3);
      s.dispose = () => {
        clearInterval(s.timer);
        evs.forEach((e) => window.removeEventListener(e, bump, { capture: true }));
      };
      return s;
    });
    return {
      queryState: fn((secs = 60) => Date.now() - st.last > Math.max(15, secs) * 1e3 ? "idle" : "active"),
      setDetectionInterval: (secs) => {
        st.interval = Math.max(15, secs | 0);
      },
      getAutoLockDelay: fn(() => 0),
      onStateChanged: h.event("idle.onStateChanged"),
      IdleState: { ACTIVE: "active", IDLE: "idle", LOCKED: "locked" }
    };
  }
  function ttsApi(h) {
    const { ext, fn } = h;
    const synth = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
    return {
      speak: fn((text, o = {}) => {
        const engine = (ext.state.ttsEngineVoices || []).find((v) => o.voiceName && v.voiceName === o.voiceName || !o.voiceName && o.lang && v.lang === o.lang);
        if (engine) {
          const requestId = Math.floor(Math.random() * 1e9);
          if (!ext.state.ttsRequests) ext.state.ttsRequests = /* @__PURE__ */ new Map();
          ext.state.ttsRequests.set(requestId, (e) => {
            if (typeof o.onEvent === "function") o.onEvent(e);
            if (/end|error|interrupted|cancelled/.test(e.type)) ext.state.ttsRequests.delete(requestId);
          });
          ext.dispatch("ttsEngine.onSpeak", () => [String(text), { voiceName: engine.voiceName, lang: o.lang || engine.lang, rate: o.rate ?? 1, pitch: o.pitch ?? 1, volume: o.volume ?? 1 }, (e) => {
            const r = ext.state.ttsRequests.get(requestId);
            if (r) r(e);
          }]);
          return;
        }
        if (!synth) throw new Error("Speech synthesis is not available.");
        if (!o.enqueue) synth.cancel();
        const u = new SpeechSynthesisUtterance(String(text));
        if (o.lang) u.lang = o.lang;
        if (o.rate) u.rate = o.rate;
        if (o.pitch) u.pitch = o.pitch;
        if (o.volume != null) u.volume = o.volume;
        if (o.voiceName) {
          const v = synth.getVoices().find((x) => x.name === o.voiceName);
          if (v) u.voice = v;
        }
        const ev = (type, extra = {}) => {
          if (typeof o.onEvent === "function") {
            try {
              o.onEvent({ type, charIndex: 0, ...extra });
            } catch (e) {
              ext.log.error(e);
            }
          }
        };
        u.onstart = () => ev("start");
        u.onend = () => ev("end", { charIndex: String(text).length });
        u.onerror = (e) => ev("error", { errorMessage: e.error });
        u.onboundary = (e) => ev(e.name === "sentence" ? "sentence" : "word", { charIndex: e.charIndex });
        u.onpause = () => ev("pause");
        u.onresume = () => ev("resume");
        synth.speak(u);
      }),
      stop: () => synth && synth.cancel(),
      pause: () => synth && synth.pause(),
      resume: () => synth && synth.resume(),
      isSpeaking: fn(() => !!synth && synth.speaking),
      getVoices: fn(() => [...ext.state.ttsEngineVoices || [], ...synth ? synth.getVoices().map((v) => ({ voiceName: v.name, lang: v.lang, remote: !v.localService, eventTypes: ["start", "end", "word", "error"] })) : []]),
      onEvent: h.event("tts.onEvent"),
      onVoicesChanged: h.event("tts.onVoicesChanged"),
      EventType: { START: "start", END: "end", WORD: "word", SENTENCE: "sentence", MARKER: "marker", INTERRUPTED: "interrupted", CANCELLED: "cancelled", ERROR: "error", PAUSE: "pause", RESUME: "resume" }
    };
  }
  function offscreenApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("offscreen", () => ({ doc: null, frame: null, dispose() {
      if (this.doc) this.doc.destroy();
      if (this.frame) this.frame.remove();
    } }));
    return {
      createDocument: fn(async (o = {}) => {
        if (st.doc && st.doc.alive) throw new Error("Only a single offscreen document may be created.");
        const path = ext.resolvePath(o.url, "");
        if (path == null) throw new Error("Invalid offscreen document URL.");
        st.frame = ext.shim.ui.hiddenFrame(ext, "offscreen");
        st.doc = await renderPage(ext, { type: "offscreen", iframe: st.frame, path, search: (/\?[^#]*/.exec(o.url) || [""])[0] });
      }),
      closeDocument: fn(() => {
        if (!st.doc || !st.doc.alive) throw new Error("No current offscreen document.");
        st.doc.destroy();
        st.frame.remove();
        st.doc = null;
      }),
      hasDocument: fn(() => !!(st.doc && st.doc.alive)),
      Reason: Object.fromEntries(["TESTING", "AUDIO_PLAYBACK", "IFRAME_SCRIPTING", "DOM_SCRAPING", "BLOBS", "DOM_PARSER", "USER_MEDIA", "DISPLAY_MEDIA", "WEB_RTC", "CLIPBOARD", "LOCAL_STORAGE", "WORKERS", "BATTERY_STATUS", "MATCH_MEDIA", "GEOLOCATION"].map((r) => [r, r]))
    };
  }
  function matchUrlFilters(filters, url) {
    if (!filters || !filters.length) return true;
    let u;
    try {
      u = new URL(url);
    } catch {
      return false;
    }
    const host = u.hostname;
    return filters.some((f) => {
      if (f.schemes && !f.schemes.includes(u.protocol.slice(0, -1))) return false;
      if (f.ports && !f.ports.some((p) => Array.isArray(p) ? +u.port >= p[0] && +u.port <= p[1] : String(p) === (u.port || (u.protocol === "https:" ? "443" : "80")))) return false;
      const checks = {
        hostContains: () => ("." + host).includes(f.hostContains),
        hostEquals: () => host === f.hostEquals,
        hostPrefix: () => host.startsWith(f.hostPrefix),
        hostSuffix: () => host.endsWith(f.hostSuffix),
        pathContains: () => u.pathname.includes(f.pathContains),
        pathEquals: () => u.pathname === f.pathEquals,
        pathPrefix: () => u.pathname.startsWith(f.pathPrefix),
        pathSuffix: () => u.pathname.endsWith(f.pathSuffix),
        queryContains: () => u.search.slice(1).includes(f.queryContains),
        queryEquals: () => u.search.slice(1) === f.queryEquals,
        queryPrefix: () => u.search.slice(1).startsWith(f.queryPrefix),
        querySuffix: () => u.search.slice(1).endsWith(f.querySuffix),
        urlContains: () => url.includes(f.urlContains),
        urlEquals: () => url === f.urlEquals,
        urlMatches: () => new RegExp(f.urlMatches).test(url),
        originAndPathMatches: () => new RegExp(f.originAndPathMatches).test(u.origin + u.pathname),
        urlPrefix: () => url.startsWith(f.urlPrefix),
        urlSuffix: () => url.endsWith(f.urlSuffix)
      };
      return Object.keys(checks).every((k) => f[k] == null || checks[k]());
    });
  }
  function webNavigationApi(h) {
    const { ext, fn } = h;
    const frame = () => ({ errorOccurred: false, url: location.href, parentFrameId: -1, frameId: 0, documentId: "D" + ext.shim.tabId, documentLifecycle: "active", frameType: "outermost_frame", processId: 1 });
    const events = {};
    for (const n of ["onBeforeNavigate", "onCommitted", "onDOMContentLoaded", "onCompleted", "onErrorOccurred", "onCreatedNavigationTarget", "onReferenceFragmentUpdated", "onTabReplaced", "onHistoryStateUpdated"]) {
      events[n] = h.event("webNavigation." + n);
    }
    return {
      getFrame: fn((d = {}) => d.frameId === 0 || d.frameId == null ? frame() : null),
      getAllFrames: fn(() => [frame()]),
      ...events
    };
  }

  // src/runtime/api/registry.js
  var defs = [];
  var features = {};
  var startups = [];
  function defineNamespace(name, build, o = {}) {
    defs.push({ name, build, perms: o.perms || [], keys: o.keys || [], contexts: o.contexts || "extension", when: o.when || null, always: !!o.always });
  }
  function defineStartup(fn, cond = []) {
    startups.push({ fn, cond });
  }
  function namespaceDefs() {
    return defs;
  }
  function startupHooks() {
    return startups;
  }

  // src/runtime/api/enums.js
  var ENUMS = { "audio.DeviceType": { "ALSA_LOOPBACK": "ALSA_LOOPBACK", "BLUETOOTH": "BLUETOOTH", "FRONT_MIC": "FRONT_MIC", "HDMI": "HDMI", "HEADPHONE": "HEADPHONE", "HOTWORD": "HOTWORD", "INTERNAL_MIC": "INTERNAL_MIC", "INTERNAL_SPEAKER": "INTERNAL_SPEAKER", "KEYBOARD_MIC": "KEYBOARD_MIC", "LINEOUT": "LINEOUT", "MIC": "MIC", "OTHER": "OTHER", "POST_DSP_LOOPBACK": "POST_DSP_LOOPBACK", "POST_MIX_LOOPBACK": "POST_MIX_LOOPBACK", "REAR_MIC": "REAR_MIC", "USB": "USB" }, "audio.StreamType": { "INPUT": "INPUT", "OUTPUT": "OUTPUT" }, "bookmarks.BookmarkTreeNodeUnmodifiable": { "MANAGED": "managed" }, "bookmarks.FolderType": { "BOOKMARKS_BAR": "bookmarks-bar", "OTHER": "other", "MOBILE": "mobile", "MANAGED": "managed" }, "certificateProvider.Algorithm": { "RSASSA_PKCS1_V1_5_MD5_SHA1": "RSASSA_PKCS1_v1_5_MD5_SHA1", "RSASSA_PKCS1_V1_5_SHA1": "RSASSA_PKCS1_v1_5_SHA1", "RSASSA_PKCS1_V1_5_SHA256": "RSASSA_PKCS1_v1_5_SHA256", "RSASSA_PKCS1_V1_5_SHA384": "RSASSA_PKCS1_v1_5_SHA384", "RSASSA_PKCS1_V1_5_SHA512": "RSASSA_PKCS1_v1_5_SHA512", "RSASSA_PSS_SHA256": "RSASSA_PSS_SHA256", "RSASSA_PSS_SHA384": "RSASSA_PSS_SHA384", "RSASSA_PSS_SHA512": "RSASSA_PSS_SHA512" }, "certificateProvider.Error": { "GENERAL_ERROR": "GENERAL_ERROR" }, "certificateProvider.Hash": { "MD5_SHA1": "MD5_SHA1", "SHA1": "SHA1", "SHA256": "SHA256", "SHA384": "SHA384", "SHA512": "SHA512" }, "certificateProvider.PinRequestErrorType": { "INVALID_PIN": "INVALID_PIN", "INVALID_PUK": "INVALID_PUK", "MAX_ATTEMPTS_EXCEEDED": "MAX_ATTEMPTS_EXCEEDED", "UNKNOWN_ERROR": "UNKNOWN_ERROR" }, "certificateProvider.PinRequestType": { "PIN": "PIN", "PUK": "PUK" }, "contentSettings.AutoVerifyContentSetting": { "ALLOW": "allow", "BLOCK": "block" }, "contentSettings.CameraContentSetting": { "ALLOW": "allow", "BLOCK": "block", "ASK": "ask" }, "contentSettings.ClipboardContentSetting": { "ALLOW": "allow", "BLOCK": "block", "ASK": "ask" }, "contentSettings.CookiesContentSetting": { "ALLOW": "allow", "BLOCK": "block", "SESSION_ONLY": "session_only" }, "contentSettings.FullscreenContentSetting": { "ALLOW": "allow" }, "contentSettings.ImagesContentSetting": { "ALLOW": "allow", "BLOCK": "block" }, "contentSettings.JavascriptContentSetting": { "ALLOW": "allow", "BLOCK": "block" }, "contentSettings.LocationContentSetting": { "ALLOW": "allow", "BLOCK": "block", "ASK": "ask" }, "contentSettings.MicrophoneContentSetting": { "ALLOW": "allow", "BLOCK": "block", "ASK": "ask" }, "contentSettings.MouselockContentSetting": { "ALLOW": "allow" }, "contentSettings.MultipleAutomaticDownloadsContentSetting": { "ALLOW": "allow", "BLOCK": "block", "ASK": "ask" }, "contentSettings.NotificationsContentSetting": { "ALLOW": "allow", "BLOCK": "block", "ASK": "ask" }, "contentSettings.PluginsContentSetting": { "BLOCK": "block" }, "contentSettings.PopupsContentSetting": { "ALLOW": "allow", "BLOCK": "block" }, "contentSettings.PpapiBrokerContentSetting": { "BLOCK": "block" }, "contentSettings.Scope": { "REGULAR": "regular", "INCOGNITO_SESSION_ONLY": "incognito_session_only" }, "contentSettings.SoundContentSetting": { "ALLOW": "allow", "BLOCK": "block" }, "contextMenus.ContextType": { "ALL": "all", "PAGE": "page", "FRAME": "frame", "SELECTION": "selection", "LINK": "link", "EDITABLE": "editable", "IMAGE": "image", "VIDEO": "video", "AUDIO": "audio", "LAUNCHER": "launcher", "BROWSER_ACTION": "browser_action", "PAGE_ACTION": "page_action", "ACTION": "action", "TAB": "tab" }, "contextMenus.ItemType": { "NORMAL": "normal", "CHECKBOX": "checkbox", "RADIO": "radio", "SEPARATOR": "separator" }, "cookies.SameSiteStatus": { "NO_RESTRICTION": "no_restriction", "LAX": "lax", "STRICT": "strict", "UNSPECIFIED": "unspecified" }, "cookies.OnChangedCause": { "EVICTED": "evicted", "EXPIRED": "expired", "EXPLICIT": "explicit", "EXPIRED_OVERWRITE": "expired_overwrite", "OVERWRITE": "overwrite" }, "debugger.DetachReason": { "CANCELED_BY_USER": "canceled_by_user", "TARGET_CLOSED": "target_closed" }, "debugger.TargetInfoType": { "BACKGROUND_PAGE": "background_page", "OTHER": "other", "PAGE": "page", "WORKER": "worker" }, "declarativeWebRequest.Stage": { "ON_AUTH_REQUIRED": "onAuthRequired", "ON_BEFORE_REQUEST": "onBeforeRequest", "ON_BEFORE_SEND_HEADERS": "onBeforeSendHeaders", "ON_HEADERS_RECEIVED": "onHeadersReceived" }, "desktopCapture.DesktopCaptureSourceType": { "SCREEN": "screen", "WINDOW": "window", "TAB": "tab", "AUDIO": "audio" }, "documentScan.Configurability": { "NOT_CONFIGURABLE": "NOT_CONFIGURABLE", "SOFTWARE_CONFIGURABLE": "SOFTWARE_CONFIGURABLE", "HARDWARE_CONFIGURABLE": "HARDWARE_CONFIGURABLE" }, "documentScan.ConnectionType": { "UNSPECIFIED": "UNSPECIFIED", "USB": "USB", "NETWORK": "NETWORK" }, "documentScan.ConstraintType": { "INT_RANGE": "INT_RANGE", "FIXED_RANGE": "FIXED_RANGE", "INT_LIST": "INT_LIST", "FIXED_LIST": "FIXED_LIST", "STRING_LIST": "STRING_LIST" }, "documentScan.OperationResult": { "UNKNOWN": "UNKNOWN", "SUCCESS": "SUCCESS", "UNSUPPORTED": "UNSUPPORTED", "CANCELLED": "CANCELLED", "DEVICE_BUSY": "DEVICE_BUSY", "INVALID": "INVALID", "WRONG_TYPE": "WRONG_TYPE", "EOF": "EOF", "ADF_JAMMED": "ADF_JAMMED", "ADF_EMPTY": "ADF_EMPTY", "COVER_OPEN": "COVER_OPEN", "IO_ERROR": "IO_ERROR", "ACCESS_DENIED": "ACCESS_DENIED", "NO_MEMORY": "NO_MEMORY", "UNREACHABLE": "UNREACHABLE", "MISSING": "MISSING", "INTERNAL_ERROR": "INTERNAL_ERROR" }, "documentScan.OptionType": { "UNKNOWN": "UNKNOWN", "BOOL": "BOOL", "INT": "INT", "FIXED": "FIXED", "STRING": "STRING", "BUTTON": "BUTTON", "GROUP": "GROUP" }, "documentScan.OptionUnit": { "UNITLESS": "UNITLESS", "PIXEL": "PIXEL", "BIT": "BIT", "MM": "MM", "DPI": "DPI", "PERCENT": "PERCENT", "MICROSECOND": "MICROSECOND" }, "downloads.FilenameConflictAction": { "UNIQUIFY": "uniquify", "OVERWRITE": "overwrite", "PROMPT": "prompt" }, "downloads.HttpMethod": { "GET": "GET", "POST": "POST" }, "downloads.InterruptReason": { "FILE_FAILED": "FILE_FAILED", "FILE_ACCESS_DENIED": "FILE_ACCESS_DENIED", "FILE_NO_SPACE": "FILE_NO_SPACE", "FILE_NAME_TOO_LONG": "FILE_NAME_TOO_LONG", "FILE_TOO_LARGE": "FILE_TOO_LARGE", "FILE_VIRUS_INFECTED": "FILE_VIRUS_INFECTED", "FILE_TRANSIENT_ERROR": "FILE_TRANSIENT_ERROR", "FILE_BLOCKED": "FILE_BLOCKED", "FILE_SECURITY_CHECK_FAILED": "FILE_SECURITY_CHECK_FAILED", "FILE_TOO_SHORT": "FILE_TOO_SHORT", "FILE_HASH_MISMATCH": "FILE_HASH_MISMATCH", "FILE_SAME_AS_SOURCE": "FILE_SAME_AS_SOURCE", "NETWORK_FAILED": "NETWORK_FAILED", "NETWORK_TIMEOUT": "NETWORK_TIMEOUT", "NETWORK_DISCONNECTED": "NETWORK_DISCONNECTED", "NETWORK_SERVER_DOWN": "NETWORK_SERVER_DOWN", "NETWORK_INVALID_REQUEST": "NETWORK_INVALID_REQUEST", "SERVER_FAILED": "SERVER_FAILED", "SERVER_NO_RANGE": "SERVER_NO_RANGE", "SERVER_BAD_CONTENT": "SERVER_BAD_CONTENT", "SERVER_UNAUTHORIZED": "SERVER_UNAUTHORIZED", "SERVER_CERT_PROBLEM": "SERVER_CERT_PROBLEM", "SERVER_FORBIDDEN": "SERVER_FORBIDDEN", "SERVER_UNREACHABLE": "SERVER_UNREACHABLE", "SERVER_CONTENT_LENGTH_MISMATCH": "SERVER_CONTENT_LENGTH_MISMATCH", "SERVER_CROSS_ORIGIN_REDIRECT": "SERVER_CROSS_ORIGIN_REDIRECT", "USER_CANCELED": "USER_CANCELED", "USER_SHUTDOWN": "USER_SHUTDOWN", "CRASH": "CRASH" }, "downloads.State": { "IN_PROGRESS": "in_progress", "INTERRUPTED": "interrupted", "COMPLETE": "complete" }, "downloads.DangerType": { "FILE": "file", "URL": "url", "CONTENT": "content", "UNCOMMON": "uncommon", "HOST": "host", "UNWANTED": "unwanted", "SAFE": "safe", "ACCEPTED": "accepted", "ALLOWLISTED_BY_POLICY": "allowlistedByPolicy", "ASYNC_SCANNING": "asyncScanning", "ASYNC_LOCAL_PASSWORD_SCANNING": "asyncLocalPasswordScanning", "PASSWORD_PROTECTED": "passwordProtected", "BLOCKED_TOO_LARGE": "blockedTooLarge", "SENSITIVE_CONTENT_WARNING": "sensitiveContentWarning", "SENSITIVE_CONTENT_BLOCK": "sensitiveContentBlock", "DEEP_SCANNED_FAILED": "deepScannedFailed", "DEEP_SCANNED_SAFE": "deepScannedSafe", "DEEP_SCANNED_OPENED_DANGEROUS": "deepScannedOpenedDangerous", "PROMPT_FOR_SCANNING": "promptForScanning", "PROMPT_FOR_LOCAL_PASSWORD_SCANNING": "promptForLocalPasswordScanning", "ACCOUNT_COMPROMISE": "accountCompromise", "BLOCKED_SCAN_FAILED": "blockedScanFailed", "FORCE_SAVE_TO_GDRIVE": "forceSaveToGdrive", "FORCE_SAVE_TO_ONEDRIVE": "forceSaveToOnedrive" }, "enterprise.platformKeys.Algorithm": { "ECDSA": "ECDSA", "RSA": "RSA" }, "enterprise.platformKeys.Scope": { "USER": "USER", "MACHINE": "MACHINE" }, "extension.ViewType": { "TAB": "tab", "POPUP": "popup" }, "fileSystemProvider.ChangeType": { "CHANGED": "CHANGED", "DELETED": "DELETED" }, "fileSystemProvider.CommonActionId": { "SAVE_FOR_OFFLINE": "SAVE_FOR_OFFLINE", "OFFLINE_NOT_NECESSARY": "OFFLINE_NOT_NECESSARY", "SHARE": "SHARE" }, "fileSystemProvider.OpenFileMode": { "READ": "READ", "WRITE": "WRITE" }, "fileSystemProvider.ProviderError": { "OK": "OK", "FAILED": "FAILED", "IN_USE": "IN_USE", "EXISTS": "EXISTS", "NOT_FOUND": "NOT_FOUND", "ACCESS_DENIED": "ACCESS_DENIED", "TOO_MANY_OPENED": "TOO_MANY_OPENED", "NO_MEMORY": "NO_MEMORY", "NO_SPACE": "NO_SPACE", "NOT_A_DIRECTORY": "NOT_A_DIRECTORY", "INVALID_OPERATION": "INVALID_OPERATION", "SECURITY": "SECURITY", "ABORT": "ABORT", "NOT_A_FILE": "NOT_A_FILE", "NOT_EMPTY": "NOT_EMPTY", "INVALID_URL": "INVALID_URL", "IO": "IO" }, "fontSettings.GenericFamily": { "STANDARD": "standard", "SANSSERIF": "sansserif", "SERIF": "serif", "FIXED": "fixed", "CURSIVE": "cursive", "FANTASY": "fantasy", "MATH": "math" }, "fontSettings.LevelOfControl": { "NOT_CONTROLLABLE": "not_controllable", "CONTROLLED_BY_OTHER_EXTENSIONS": "controlled_by_other_extensions", "CONTROLLABLE_BY_THIS_EXTENSION": "controllable_by_this_extension", "CONTROLLED_BY_THIS_EXTENSION": "controlled_by_this_extension" }, "fontSettings.ScriptCode": { "AFAK": "Afak", "ARAB": "Arab", "ARMI": "Armi", "ARMN": "Armn", "AVST": "Avst", "BALI": "Bali", "BAMU": "Bamu", "BASS": "Bass", "BATK": "Batk", "BENG": "Beng", "BLIS": "Blis", "BOPO": "Bopo", "BRAH": "Brah", "BRAI": "Brai", "BUGI": "Bugi", "BUHD": "Buhd", "CAKM": "Cakm", "CANS": "Cans", "CARI": "Cari", "CHAM": "Cham", "CHER": "Cher", "CIRT": "Cirt", "COPT": "Copt", "CPRT": "Cprt", "CYRL": "Cyrl", "CYRS": "Cyrs", "DEVA": "Deva", "DSRT": "Dsrt", "DUPL": "Dupl", "EGYD": "Egyd", "EGYH": "Egyh", "EGYP": "Egyp", "ELBA": "Elba", "ETHI": "Ethi", "GEOK": "Geok", "GEOR": "Geor", "GLAG": "Glag", "GOTH": "Goth", "GRAN": "Gran", "GREK": "Grek", "GUJR": "Gujr", "GURU": "Guru", "HANG": "Hang", "HANI": "Hani", "HANO": "Hano", "HANS": "Hans", "HANT": "Hant", "HEBR": "Hebr", "HLUW": "Hluw", "HMNG": "Hmng", "HUNG": "Hung", "INDS": "Inds", "ITAL": "Ital", "JAVA": "Java", "JPAN": "Jpan", "JURC": "Jurc", "KALI": "Kali", "KHAR": "Khar", "KHMR": "Khmr", "KHOJ": "Khoj", "KNDA": "Knda", "KPEL": "Kpel", "KTHI": "Kthi", "LANA": "Lana", "LAOO": "Laoo", "LATF": "Latf", "LATG": "Latg", "LATN": "Latn", "LEPC": "Lepc", "LIMB": "Limb", "LINA": "Lina", "LINB": "Linb", "LISU": "Lisu", "LOMA": "Loma", "LYCI": "Lyci", "LYDI": "Lydi", "MAND": "Mand", "MANI": "Mani", "MAYA": "Maya", "MEND": "Mend", "MERC": "Merc", "MERO": "Mero", "MLYM": "Mlym", "MONG": "Mong", "MOON": "Moon", "MROO": "Mroo", "MTEI": "Mtei", "MYMR": "Mymr", "NARB": "Narb", "NBAT": "Nbat", "NKGB": "Nkgb", "NKOO": "Nkoo", "NSHU": "Nshu", "OGAM": "Ogam", "OLCK": "Olck", "ORKH": "Orkh", "ORYA": "Orya", "OSMA": "Osma", "PALM": "Palm", "PERM": "Perm", "PHAG": "Phag", "PHLI": "Phli", "PHLP": "Phlp", "PHLV": "Phlv", "PHNX": "Phnx", "PLRD": "Plrd", "PRTI": "Prti", "RJNG": "Rjng", "RORO": "Roro", "RUNR": "Runr", "SAMR": "Samr", "SARA": "Sara", "SARB": "Sarb", "SAUR": "Saur", "SGNW": "Sgnw", "SHAW": "Shaw", "SHRD": "Shrd", "SIND": "Sind", "SINH": "Sinh", "SORA": "Sora", "SUND": "Sund", "SYLO": "Sylo", "SYRC": "Syrc", "SYRE": "Syre", "SYRJ": "Syrj", "SYRN": "Syrn", "TAGB": "Tagb", "TAKR": "Takr", "TALE": "Tale", "TALU": "Talu", "TAML": "Taml", "TANG": "Tang", "TAVT": "Tavt", "TELU": "Telu", "TENG": "Teng", "TFNG": "Tfng", "TGLG": "Tglg", "THAA": "Thaa", "THAI": "Thai", "TIBT": "Tibt", "TIRH": "Tirh", "UGAR": "Ugar", "VAII": "Vaii", "VISP": "Visp", "WARA": "Wara", "WOLE": "Wole", "XPEO": "Xpeo", "XSUX": "Xsux", "YIII": "Yiii", "ZMTH": "Zmth", "ZSYM": "Zsym", "ZYYY": "Zyyy" }, "history.TransitionType": { "LINK": "link", "TYPED": "typed", "AUTO_BOOKMARK": "auto_bookmark", "AUTO_SUBFRAME": "auto_subframe", "MANUAL_SUBFRAME": "manual_subframe", "GENERATED": "generated", "AUTO_TOPLEVEL": "auto_toplevel", "FORM_SUBMIT": "form_submit", "RELOAD": "reload", "KEYWORD": "keyword", "KEYWORD_GENERATED": "keyword_generated" }, "identity.AccountStatus": { "SYNC": "SYNC", "ANY": "ANY" }, "idle.IdleState": { "ACTIVE": "active", "IDLE": "idle", "LOCKED": "locked" }, "input.ime.KeyboardEventType": { "KEYUP": "keyup", "KEYDOWN": "keydown" }, "input.ime.AutoCapitalizeType": { "CHARACTERS": "characters", "WORDS": "words", "SENTENCES": "sentences" }, "input.ime.InputContextType": { "TEXT": "text", "SEARCH": "search", "TEL": "tel", "URL": "url", "EMAIL": "email", "NUMBER": "number", "PASSWORD": "password", "NULL": "null" }, "input.ime.MenuItemStyle": { "CHECK": "check", "RADIO": "radio", "SEPARATOR": "separator" }, "input.ime.MouseButton": { "LEFT": "left", "MIDDLE": "middle", "RIGHT": "right" }, "input.ime.ScreenType": { "NORMAL": "normal", "LOGIN": "login", "LOCK": "lock", "SECONDARY_LOGIN": "secondary-login" }, "input.ime.UnderlineStyle": { "UNDERLINE": "underline", "DOUBLE_UNDERLINE": "doubleUnderline", "NO_UNDERLINE": "noUnderline" }, "input.ime.WindowPosition": { "CURSOR": "cursor", "COMPOSITION": "composition" }, "input.ime.AssistiveWindowType": { "UNDO": "undo" }, "input.ime.AssistiveWindowButton": { "UNDO": "undo", "ADD_TO_DICTIONARY": "addToDictionary" }, "loginState.ProfileType": { "SIGNIN_PROFILE": "SIGNIN_PROFILE", "USER_PROFILE": "USER_PROFILE", "LOCK_PROFILE": "LOCK_PROFILE" }, "loginState.SessionState": { "UNKNOWN": "UNKNOWN", "IN_OOBE_SCREEN": "IN_OOBE_SCREEN", "IN_LOGIN_SCREEN": "IN_LOGIN_SCREEN", "IN_SESSION": "IN_SESSION", "IN_LOCK_SCREEN": "IN_LOCK_SCREEN", "IN_RMA_SCREEN": "IN_RMA_SCREEN" }, "management.ExtensionDisabledReason": { "UNKNOWN": "unknown", "PERMISSIONS_INCREASE": "permissions_increase" }, "management.ExtensionInstallType": { "ADMIN": "admin", "DEVELOPMENT": "development", "NORMAL": "normal", "SIDELOAD": "sideload", "OTHER": "other" }, "management.ExtensionType": { "EXTENSION": "extension", "HOSTED_APP": "hosted_app", "PACKAGED_APP": "packaged_app", "LEGACY_PACKAGED_APP": "legacy_packaged_app", "THEME": "theme", "LOGIN_SCREEN_EXTENSION": "login_screen_extension" }, "management.LaunchType": { "OPEN_AS_REGULAR_TAB": "OPEN_AS_REGULAR_TAB", "OPEN_AS_PINNED_TAB": "OPEN_AS_PINNED_TAB", "OPEN_AS_WINDOW": "OPEN_AS_WINDOW", "OPEN_FULL_SCREEN": "OPEN_FULL_SCREEN" }, "notifications.PermissionLevel": { "GRANTED": "granted", "DENIED": "denied" }, "notifications.TemplateType": { "BASIC": "basic", "IMAGE": "image", "LIST": "list", "PROGRESS": "progress" }, "offscreen.Reason": { "TESTING": "TESTING", "AUDIO_PLAYBACK": "AUDIO_PLAYBACK", "IFRAME_SCRIPTING": "IFRAME_SCRIPTING", "DOM_SCRAPING": "DOM_SCRAPING", "BLOBS": "BLOBS", "DOM_PARSER": "DOM_PARSER", "USER_MEDIA": "USER_MEDIA", "DISPLAY_MEDIA": "DISPLAY_MEDIA", "WEB_RTC": "WEB_RTC", "CLIPBOARD": "CLIPBOARD", "LOCAL_STORAGE": "LOCAL_STORAGE", "WORKERS": "WORKERS", "BATTERY_STATUS": "BATTERY_STATUS", "MATCH_MEDIA": "MATCH_MEDIA", "GEOLOCATION": "GEOLOCATION" }, "omnibox.DescriptionStyleType": { "URL": "url", "MATCH": "match", "DIM": "dim" }, "omnibox.OnInputEnteredDisposition": { "CURRENT_TAB": "currentTab", "NEW_FOREGROUND_TAB": "newForegroundTab", "NEW_BACKGROUND_TAB": "newBackgroundTab" }, "platformKeys.ClientCertificateType": { "ECDSA_SIGN": "ecdsaSign", "RSA_SIGN": "rsaSign" }, "power.Level": { "DISPLAY": "display", "SYSTEM": "system" }, "printerProvider.PrintError": { "OK": "OK", "FAILED": "FAILED", "INVALID_TICKET": "INVALID_TICKET", "INVALID_DATA": "INVALID_DATA" }, "printing.JobStatus": { "PENDING": "PENDING", "IN_PROGRESS": "IN_PROGRESS", "FAILED": "FAILED", "CANCELED": "CANCELED", "PRINTED": "PRINTED" }, "printing.PrinterSource": { "USER": "USER", "POLICY": "POLICY" }, "printing.PrinterStatus": { "DOOR_OPEN": "DOOR_OPEN", "TRAY_MISSING": "TRAY_MISSING", "OUT_OF_INK": "OUT_OF_INK", "OUT_OF_PAPER": "OUT_OF_PAPER", "OUTPUT_FULL": "OUTPUT_FULL", "PAPER_JAM": "PAPER_JAM", "GENERIC_ISSUE": "GENERIC_ISSUE", "STOPPED": "STOPPED", "UNREACHABLE": "UNREACHABLE", "EXPIRED_CERTIFICATE": "EXPIRED_CERTIFICATE", "AVAILABLE": "AVAILABLE" }, "printing.SubmitJobStatus": { "OK": "OK", "USER_REJECTED": "USER_REJECTED" }, "printingMetrics.ColorMode": { "BLACK_AND_WHITE": "BLACK_AND_WHITE", "COLOR": "COLOR" }, "printingMetrics.DuplexMode": { "ONE_SIDED": "ONE_SIDED", "TWO_SIDED_LONG_EDGE": "TWO_SIDED_LONG_EDGE", "TWO_SIDED_SHORT_EDGE": "TWO_SIDED_SHORT_EDGE" }, "printingMetrics.PrinterSource": { "USER": "USER", "POLICY": "POLICY" }, "printingMetrics.PrintJobSource": { "PRINT_PREVIEW": "PRINT_PREVIEW", "ANDROID_APP": "ANDROID_APP", "EXTENSION": "EXTENSION", "ISOLATED_WEB_APP": "ISOLATED_WEB_APP" }, "printingMetrics.PrintJobStatus": { "FAILED": "FAILED", "CANCELED": "CANCELED", "PRINTED": "PRINTED" }, "privacy.AutofillBlockedType": { "ALL": "all", "CONTACT_INFO": "contact_info", "PAYMENTS": "payments", "IDENTITY_DOCS": "identity_docs", "TRAVEL": "travel" }, "privacy.IPHandlingPolicy": { "DEFAULT": "default", "DEFAULT_PUBLIC_AND_PRIVATE_INTERFACES": "default_public_and_private_interfaces", "DEFAULT_PUBLIC_INTERFACE_ONLY": "default_public_interface_only", "DISABLE_NON_PROXIED_UDP": "disable_non_proxied_udp" }, "proxy.Mode": { "DIRECT": "direct", "AUTO_DETECT": "auto_detect", "PAC_SCRIPT": "pac_script", "FIXED_SERVERS": "fixed_servers", "SYSTEM": "system" }, "proxy.Scheme": { "HTTP": "http", "HTTPS": "https", "QUIC": "quic", "SOCKS4": "socks4", "SOCKS5": "socks5" }, "publicSuffix.DomainEncoding": { "DISPLAY": "display", "PUNYCODE": "punycode" }, "search.Disposition": { "CURRENT_TAB": "CURRENT_TAB", "NEW_TAB": "NEW_TAB", "NEW_WINDOW": "NEW_WINDOW" }, "runtime.PlatformOs": { "MAC": "mac", "WIN": "win", "ANDROID": "android", "CROS": "cros", "LINUX": "linux", "OPENBSD": "openbsd", "FUCHSIA": "fuchsia" }, "runtime.PlatformArch": { "ARM": "arm", "ARM64": "arm64", "X86_32": "x86-32", "X86_64": "x86-64", "MIPS": "mips", "MIPS64": "mips64", "RISCV64": "riscv64" }, "runtime.PlatformNaclArch": { "ARM": "arm", "X86_32": "x86-32", "X86_64": "x86-64", "MIPS": "mips", "MIPS64": "mips64" }, "runtime.ContextType": { "TAB": "TAB", "POPUP": "POPUP", "BACKGROUND": "BACKGROUND", "OFFSCREEN_DOCUMENT": "OFFSCREEN_DOCUMENT", "SIDE_PANEL": "SIDE_PANEL", "DEVELOPER_TOOLS": "DEVELOPER_TOOLS" }, "runtime.OnInstalledReason": { "INSTALL": "install", "UPDATE": "update", "CHROME_UPDATE": "chrome_update", "SHARED_MODULE_UPDATE": "shared_module_update" }, "runtime.OnRestartRequiredReason": { "APP_UPDATE": "app_update", "OS_UPDATE": "os_update", "PERIODIC": "periodic" }, "runtime.RequestUpdateCheckStatus": { "THROTTLED": "throttled", "NO_UPDATE": "no_update", "UPDATE_AVAILABLE": "update_available" }, "scripting.StyleOrigin": { "AUTHOR": "AUTHOR", "USER": "USER" }, "scripting.ExecutionWorld": { "ISOLATED": "ISOLATED", "MAIN": "MAIN" }, "storage.AccessLevel": { "TRUSTED_CONTEXTS": "TRUSTED_CONTEXTS", "TRUSTED_AND_UNTRUSTED_CONTEXTS": "TRUSTED_AND_UNTRUSTED_CONTEXTS" }, "system.storage.EjectDeviceResultCode": { "SUCCESS": "success", "IN_USE": "in_use", "NO_SUCH_DEVICE": "no_such_device", "FAILURE": "failure" }, "system.storage.StorageUnitType": { "FIXED": "fixed", "REMOVABLE": "removable", "UNKNOWN": "unknown" }, "system.display.LayoutPosition": { "TOP": "top", "RIGHT": "right", "BOTTOM": "bottom", "LEFT": "left" }, "system.display.MirrorMode": { "OFF": "off", "NORMAL": "normal", "MIXED": "mixed" }, "system.display.ActiveState": { "ACTIVE": "active", "INACTIVE": "inactive" }, "tabCapture.TabCaptureState": { "PENDING": "pending", "ACTIVE": "active", "STOPPED": "stopped", "ERROR": "error" }, "tabs.MutedInfoReason": { "USER": "user", "CAPTURE": "capture", "EXTENSION": "extension" }, "tabs.TabStatus": { "UNLOADED": "unloaded", "LOADING": "loading", "COMPLETE": "complete" }, "tabs.WindowType": { "NORMAL": "normal", "POPUP": "popup", "PANEL": "panel", "APP": "app", "DEVTOOLS": "devtools" }, "tabs.ZoomSettingsMode": { "AUTOMATIC": "automatic", "MANUAL": "manual", "DISABLED": "disabled" }, "tabs.ZoomSettingsScope": { "PER_ORIGIN": "per-origin", "PER_TAB": "per-tab" }, "tabGroups.Color": { "BLUE": "blue", "CYAN": "cyan", "GREEN": "green", "GREY": "grey", "ORANGE": "orange", "PINK": "pink", "PURPLE": "purple", "RED": "red", "YELLOW": "yellow" }, "tts.EventType": { "START": "start", "END": "end", "WORD": "word", "SENTENCE": "sentence", "MARKER": "marker", "INTERRUPTED": "interrupted", "CANCELLED": "cancelled", "ERROR": "error", "PAUSE": "pause", "RESUME": "resume" }, "tts.VoiceGender": { "FEMALE": "female", "MALE": "male" }, "ttsEngine.LanguageInstallStatus": { "FAILED": "failed", "INSTALLED": "installed", "INSTALLING": "installing", "NOT_INSTALLED": "notInstalled" }, "ttsEngine.TtsClientSource": { "CHROMEFEATURE": "chromefeature", "EXTENSION": "extension" }, "ttsEngine.VoiceGender": { "MALE": "male", "FEMALE": "female" }, "vpnProvider.PlatformMessage": { "CONNECTED": "connected", "DISCONNECTED": "disconnected", "ERROR": "error", "LINK_DOWN": "linkDown", "LINK_UP": "linkUp", "LINK_CHANGED": "linkChanged", "SUSPEND": "suspend", "RESUME": "resume" }, "vpnProvider.UIEvent": { "SHOW_ADD_DIALOG": "showAddDialog", "SHOW_CONFIGURE_DIALOG": "showConfigureDialog" }, "vpnProvider.VpnConnectionState": { "CONNECTED": "connected", "FAILURE": "failure" }, "wallpaper.WallpaperLayout": { "STRETCH": "STRETCH", "CENTER": "CENTER", "CENTER_CROPPED": "CENTER_CROPPED" }, "webNavigation.TransitionQualifier": { "CLIENT_REDIRECT": "client_redirect", "SERVER_REDIRECT": "server_redirect", "FORWARD_BACK": "forward_back", "FROM_ADDRESS_BAR": "from_address_bar" }, "webNavigation.TransitionType": { "LINK": "link", "TYPED": "typed", "AUTO_BOOKMARK": "auto_bookmark", "AUTO_SUBFRAME": "auto_subframe", "MANUAL_SUBFRAME": "manual_subframe", "GENERATED": "generated", "START_PAGE": "start_page", "FORM_SUBMIT": "form_submit", "RELOAD": "reload", "KEYWORD": "keyword", "KEYWORD_GENERATED": "keyword_generated" }, "webRequest.IgnoredActionType": { "AUTH_CREDENTIALS": "auth_credentials", "REDIRECT": "redirect", "REQUEST_HEADERS": "request_headers", "RESPONSE_HEADERS": "response_headers" }, "webRequest.OnAuthRequiredOptions": { "RESPONSE_HEADERS": "responseHeaders", "BLOCKING": "blocking", "ASYNC_BLOCKING": "asyncBlocking", "EXTRA_HEADERS": "extraHeaders" }, "webRequest.OnBeforeRedirectOptions": { "RESPONSE_HEADERS": "responseHeaders", "EXTRA_HEADERS": "extraHeaders" }, "webRequest.OnBeforeRequestOptions": { "BLOCKING": "blocking", "REQUEST_BODY": "requestBody", "EXTRA_HEADERS": "extraHeaders" }, "webRequest.OnBeforeSendHeadersOptions": { "REQUEST_HEADERS": "requestHeaders", "BLOCKING": "blocking", "EXTRA_HEADERS": "extraHeaders" }, "webRequest.OnCompletedOptions": { "RESPONSE_HEADERS": "responseHeaders", "EXTRA_HEADERS": "extraHeaders" }, "webRequest.OnErrorOccurredOptions": { "EXTRA_HEADERS": "extraHeaders" }, "webRequest.OnHeadersReceivedOptions": { "BLOCKING": "blocking", "EXTRA_HEADERS": "extraHeaders", "RESPONSE_HEADERS": "responseHeaders", "SECURITY_INFO": "securityInfo", "SECURITY_INFO_RAW_DER": "securityInfoRawDer" }, "webRequest.OnResponseStartedOptions": { "RESPONSE_HEADERS": "responseHeaders", "EXTRA_HEADERS": "extraHeaders" }, "webRequest.OnSendHeadersOptions": { "REQUEST_HEADERS": "requestHeaders", "EXTRA_HEADERS": "extraHeaders" }, "webRequest.ResourceType": { "MAIN_FRAME": "main_frame", "SUB_FRAME": "sub_frame", "STYLESHEET": "stylesheet", "SCRIPT": "script", "IMAGE": "image", "FONT": "font", "OBJECT": "object", "XMLHTTPREQUEST": "xmlhttprequest", "PING": "ping", "CSP_REPORT": "csp_report", "MEDIA": "media", "WEBSOCKET": "websocket", "WEBBUNDLE": "webbundle", "OTHER": "other" }, "windows.CreateType": { "NORMAL": "normal", "POPUP": "popup", "PANEL": "panel" }, "windows.WindowState": { "NORMAL": "normal", "MINIMIZED": "minimized", "MAXIMIZED": "maximized", "FULLSCREEN": "fullscreen", "LOCKED_FULLSCREEN": "locked-fullscreen" }, "windows.WindowType": { "NORMAL": "normal", "POPUP": "popup", "PANEL": "panel", "APP": "app", "DEVTOOLS": "devtools" }, "declarativeNetRequest.RequestMethod": { "CONNECT": "connect", "DELETE": "delete", "GET": "get", "HEAD": "head", "OPTIONS": "options", "PATCH": "patch", "POST": "post", "PUT": "put", "OTHER": "other" }, "declarativeNetRequest.ResourceType": { "MAIN_FRAME": "main_frame", "SUB_FRAME": "sub_frame", "STYLESHEET": "stylesheet", "SCRIPT": "script", "IMAGE": "image", "FONT": "font", "OBJECT": "object", "XMLHTTPREQUEST": "xmlhttprequest", "PING": "ping", "CSP_REPORT": "csp_report", "MEDIA": "media", "WEBSOCKET": "websocket", "WEBTRANSPORT": "webtransport", "WEBBUNDLE": "webbundle", "OTHER": "other" }, "declarativeNetRequest.RuleActionType": { "BLOCK": "block", "REDIRECT": "redirect", "ALLOW": "allow", "UPGRADE_SCHEME": "upgradeScheme", "MODIFY_HEADERS": "modifyHeaders", "ALLOW_ALL_REQUESTS": "allowAllRequests" }, "declarativeNetRequest.UnsupportedRegexReason": { "SYNTAX_ERROR": "syntaxError", "MEMORY_LIMIT_EXCEEDED": "memoryLimitExceeded" }, "declarativeNetRequest.DomainType": { "FIRST_PARTY": "firstParty", "THIRD_PARTY": "thirdParty" }, "declarativeNetRequest.HeaderOperation": { "APPEND": "append", "SET": "set", "REMOVE": "remove" }, "declarativeNetRequest.RuleConditionKeys": { "URL_FILTER": "urlFilter", "REGEX_FILTER": "regexFilter", "IS_URL_FILTER_CASE_SENSITIVE": "isUrlFilterCaseSensitive", "INITIATOR_DOMAINS": "initiatorDomains", "EXCLUDED_INITIATOR_DOMAINS": "excludedInitiatorDomains", "REQUEST_DOMAINS": "requestDomains", "EXCLUDED_REQUEST_DOMAINS": "excludedRequestDomains", "TOP_DOMAINS": "topDomains", "EXCLUDED_TOP_DOMAINS": "excludedTopDomains", "DOMAINS": "domains", "EXCLUDED_DOMAINS": "excludedDomains", "RESOURCE_TYPES": "resourceTypes", "EXCLUDED_RESOURCE_TYPES": "excludedResourceTypes", "REQUEST_METHODS": "requestMethods", "EXCLUDED_REQUEST_METHODS": "excludedRequestMethods", "DOMAIN_TYPE": "domainType", "TAB_IDS": "tabIds", "EXCLUDED_TAB_IDS": "excludedTabIds", "RESPONSE_HEADERS": "responseHeaders", "EXCLUDED_RESPONSE_HEADERS": "excludedResponseHeaders" }, "sidePanel.Side": { "LEFT": "left", "RIGHT": "right" }, "userScripts.ExecutionWorld": { "MAIN": "MAIN", "USER_SCRIPT": "USER_SCRIPT" } };

  // src/runtime/api/index.js
  var PERMISSION_NAMESPACES = {
    webRequest: "webRequest",
    webRequestBlocking: "webRequest",
    webRequestAuthProvider: "webRequest",
    webRequestFilterResponse: "webRequest",
    declarativeNetRequest: "declarativeNetRequest",
    declarativeNetRequestWithHostAccess: "declarativeNetRequest",
    declarativeNetRequestFeedback: "declarativeNetRequest",
    declarativeContent: "declarativeContent",
    cookies: "cookies",
    history: "history",
    bookmarks: "bookmarks",
    topSites: "topSites",
    sessions: "sessions",
    browsingData: "browsingData",
    proxy: "proxy",
    privacy: "privacy",
    contentSettings: "contentSettings",
    debugger: "debugger",
    identity: "identity",
    gcm: "gcm",
    tabGroups: "tabGroups",
    readingList: "readingList",
    search: "search",
    fontSettings: "fontSettings",
    ttsEngine: "ttsEngine",
    pageCapture: "pageCapture",
    desktopCapture: "desktopCapture",
    tabCapture: "tabCapture",
    power: "power",
    printing: "printing",
    printerProvider: "printerProvider",
    printingMetrics: "printingMetrics",
    userScripts: "userScripts",
    dns: "dns",
    contextualIdentities: "contextualIdentities",
    find: "find",
    theme: "theme",
    captivePortal: "captivePortal",
    documentScan: "documentScan",
    wallpaper: "wallpaper",
    audio: "audio",
    certificateProvider: "certificateProvider",
    fileSystemProvider: "fileSystemProvider",
    fileBrowserHandler: "fileBrowserHandler",
    loginState: "loginState",
    platformKeys: "platformKeys",
    vpnProvider: "vpnProvider",
    webAuthenticationProxy: "webAuthenticationProxy",
    browserSettings: "browserSettings",
    pkcs11: "pkcs11",
    telemetry: "telemetry",
    geckoProfiler: "geckoProfiler",
    normandyAddonStudy: "normandyAddonStudy",
    urlbar: "urlbar",
    networkStatus: "networkStatus",
    activityLog: "activityLog",
    gcm2: "instanceID",
    publicSuffix: "publicSuffix",
    systemLog: "systemLog",
    mimeHandler: "mimeHandler",
    "system.cpu": "system",
    "system.memory": "system",
    "system.storage": "system",
    "system.display": "system",
    "enterprise.deviceAttributes": "enterprise",
    "enterprise.hardwarePlatform": "enterprise",
    "enterprise.networkingAttributes": "enterprise",
    "enterprise.platformKeys": "enterprise",
    "enterprise.login": "enterprise",
    input: "input",
    clipboardWrite: null,
    "accessibilityFeatures.read": "accessibilityFeatures",
    "accessibilityFeatures.modify": "accessibilityFeatures"
  };
  function getPath(obj, parts) {
    let v = obj;
    for (const p of parts) {
      if (v == null) return void 0;
      v = v[p];
    }
    return v;
  }
  function setPath(obj, path, value) {
    const parts = path.split(".");
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!o[parts[i]] || typeof o[parts[i]] !== "object") o[parts[i]] = {};
      o = o[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (o[last] && typeof o[last] === "object" && value && typeof value === "object") Object.assign(o[last], value);
    else o[last] = value;
  }
  function manifestPermissions(m) {
    return new Set([...m.permissions || [], ...m.optional_permissions || []].filter((p) => typeof p === "string"));
  }
  function available(def, ext, ctx, perms) {
    const t = ctx.type;
    if (def.contexts === "content" && t !== "content") return false;
    if (def.contexts === "extension" && t === "content") return false;
    if (def.contexts === "devtools" && t !== "devtools") return false;
    if (def.when && !def.when(ext, ctx)) return false;
    if (def.always) return true;
    if (ext.options.allApis) return true;
    if (def.perms.some((p) => perms.has(p))) return true;
    if (def.keys.some((k) => ext.manifest[k] != null)) return true;
    return !def.perms.length && !def.keys.length;
  }
  function buildApi(ctx) {
    const h = makeHelpers(ctx);
    const ext = ctx.ext;
    const m = ext.manifest;
    const perms = manifestPermissions(m);
    const want = (p) => ext.options.allApis || perms.has(p);
    const api = {};
    api.runtime = runtimeApi(h);
    api.extension = extensionApi(h, api.runtime);
    api.i18n = i18nApi(h);
    api.storage = storageApi(h);
    if (ctx.type !== "content") {
      api.tabs = tabsApi(h);
      api.windows = windowsApi(h);
      api.permissions = permissionsApi(h);
      api.management = managementApi(h);
      api.commands = commandsApi(h);
      if (ext.mv === 3 && m.action || ext.options.allApis && ext.mv === 3) api.action = actionApi(h, "action");
      if (m.browser_action || ext.options.allApis && ext.mv === 2) api.browserAction = actionApi(h, "browserAction");
      if (m.page_action) api.pageAction = actionApi(h, "pageAction");
      if (want("contextMenus") || want("menus")) {
        api.contextMenus = menusApi(h, "contextMenus");
        api.menus = api.contextMenus;
      }
      if (want("alarms")) api.alarms = alarmsApi(h);
      if (want("notifications")) api.notifications = notificationsApi(h);
      if (want("scripting")) api.scripting = scriptingApi(h);
      if (want("offscreen")) api.offscreen = offscreenApi(h);
      if (want("sidePanel") || m.side_panel) api.sidePanel = sidePanelApi(h);
      if (m.sidebar_action) api.sidebarAction = sidebarActionApi(h);
      if (want("downloads")) api.downloads = downloadsApi(h);
      if (want("idle")) api.idle = idleApi(h);
      if (want("tts") || want("ttsEngine")) api.tts = ttsApi(h);
      if (want("webNavigation")) api.webNavigation = webNavigationApi(h);
      if (m.omnibox) api.omnibox = omniboxApi(h);
    } else if (want("menus") || want("contextMenus")) {
      api.menus = { getTargetElement: () => ext.shim.ui.lastContextTarget || null };
    }
    for (const def of namespaceDefs()) {
      if (!available(def, ext, ctx, perms)) continue;
      try {
        setPath(api, def.name, def.build(h));
      } catch (e) {
        ext.log.error(`Could not build chrome.${def.name}:`, e);
      }
    }
    if (ctx.type !== "content") {
      for (const p of perms) {
        const ns = PERMISSION_NAMESPACES[p];
        if (ns && !api[ns]) api[ns] = stubNamespace(h, ns, enumsFor(ns));
      }
    }
    mergeEnums(api);
    return api;
  }
  function enumsFor(ns) {
    const out = {};
    for (const [path, values] of Object.entries(ENUMS)) {
      if (path.startsWith(ns + ".") && path.split(".").length === ns.split(".").length + 1) out[path.split(".").pop()] = values;
    }
    return out;
  }
  function mergeEnums(api) {
    for (const [path, values] of Object.entries(ENUMS)) {
      const parts = path.split(".");
      const name = parts.pop();
      const ns = getPath(api, parts);
      if (!ns || typeof ns !== "object" && typeof ns !== "function") continue;
      try {
        const cur = ns[name];
        if (cur && typeof cur === "object") {
          for (const k of Object.keys(values)) if (!(k in cur)) cur[k] = values[k];
        } else if (cur === void 0 || typeof cur === "function") {
          if (Object.isExtensible(ns) && !Object.prototype.hasOwnProperty.call(ns, name)) ns[name] = { ...values };
        }
      } catch {
      }
    }
  }

  // src/runtime/context.js
  var nextDocId = 1;
  var Context = class {
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
    constructor(ext, { type, url, tabId = null, frameId = 0, win = null, world = null, path = "" }) {
      this.ext = ext;
      this.type = type;
      this.url = url;
      this.path = path;
      this.tabId = tabId;
      this.frameId = frameId;
      this.win = win;
      this.world = world;
      this.documentId = "D" + (nextDocId++).toString(16).padStart(8, "0").toUpperCase();
      this.alive = true;
      this.events = /* @__PURE__ */ new Map();
      this.ports = /* @__PURE__ */ new Set();
      this.cleanups = [];
      this.lastError = void 0;
      this._leChecked = true;
      this.log = ext.log;
      this.isExtensionPage = type !== "content";
      let resolveReady;
      this.ready = new Promise((r) => {
        resolveReady = r;
      });
      this.markReady = () => resolveReady();
      this.api = buildApi(this);
      ext.contexts.add(this);
    }
    event(key) {
      let e = this.events.get(key);
      if (!e) {
        e = new ExtEvent(key, this.log);
        this.events.set(key, e);
      }
      return e;
    }
    assertAlive() {
      if (!this.alive) throw new Error("Extension context invalidated.");
    }
    /** MessageSender describing this context. */
    sender() {
      const s = { id: this.ext.id, url: this.url, origin: this.type === "content" ? safeOrigin(this.url) : this.ext.origin };
      if (this.type === "content") {
        s.tab = this.ext.pageTab();
        s.frameId = this.frameId;
        s.documentId = this.documentId;
        s.documentLifecycle = "active";
      } else if (this.tabId != null) {
        s.tab = (this.tabId === this.ext.shim.tabId ? this.ext.pageTab() : this.ext.overlayTab(this.tabId)) || void 0;
        s.frameId = 0;
      }
      return s;
    }
    /** Run fn with runtime.lastError set (and warn if the callback never reads it). */
    withLastError(err, fn) {
      const message = err && err.message ? err.message : String(err);
      this.lastError = { message };
      this._leChecked = false;
      try {
        fn();
      } catch (e) {
        this.log.error("Error in callback:", e);
      } finally {
        if (!this._leChecked) this.log.warn("Unchecked runtime.lastError:", message);
        this.lastError = void 0;
        this._leChecked = true;
      }
    }
    callback(cb, err, ...results) {
      if (!this.alive) return;
      if (err) this.withLastError(err, () => cb());
      else {
        try {
          cb(...results);
        } catch (e) {
          this.log.error("Error in callback:", e);
        }
      }
    }
    onDestroy(fn) {
      this.cleanups.push(fn);
    }
    destroy() {
      if (!this.alive) return;
      this.alive = false;
      for (const p of [...this.ports]) p.disconnect();
      for (const fn of this.cleanups.splice(0)) {
        try {
          fn();
        } catch (e) {
          this.log.error(e);
        }
      }
      for (const e of this.events.values()) e.clear();
      this.ext.contexts.delete(this);
    }
  };
  function safeOrigin(url) {
    try {
      return new URL(url).origin;
    } catch {
      return "null";
    }
  }

  // src/runtime/net.js
  function hostAllowed(ext, url) {
    const perms = ext._perms || (ext._perms = getPermissions(ext.manifest));
    return matchesAny(perms.origins, url) || matchesAny(perms.optionalOrigins, url);
  }
  function crossOriginAdapter(ext, url) {
    let u;
    try {
      u = new URL(url);
    } catch {
      return null;
    }
    if (u.origin === location.origin || !/^https?:$/.test(u.protocol)) return null;
    if (!hostAllowed(ext, u.href)) return null;
    const host = ext.options.host && ext.options.host.fetch;
    if (host) return (init) => host(u.href, init);
    const proxy = ext.options.corsProxy;
    if (proxy) {
      const target = typeof proxy === "function" ? proxy(u.href) : proxy.includes("{url}") ? proxy.replace("{url}", encodeURIComponent(u.href)) : proxy + encodeURIComponent(u.href);
      return (init) => ext.shim.nativeFetch(target, init);
    }
    return null;
  }
  function createFetch(ext, { win, basePath }) {
    const nativeFetch = win.fetch.bind(win);
    const R = win.Response || Response;
    return async function fetch2(input, init) {
      const isReq = input && typeof input === "object" && "url" in input;
      const raw = isReq ? input.url : String(input);
      const path = ext.resolvePath(raw, basePath);
      if (path != null) {
        const blob = await ext.vfs.blob(path);
        if (!blob) throw new TypeError("Failed to fetch");
        return new R(blob, { status: 200, statusText: "OK", headers: { "Content-Type": mimeType(path), "Content-Length": String(blob.size) } });
      }
      let abs = raw;
      try {
        abs = new URL(raw, basePath != null ? ext.virtualUrl(basePath) : win.location.href).href;
      } catch {
      }
      if (basePath != null && abs.startsWith(ext.baseUrl)) throw new TypeError("Failed to fetch");
      const adapter = crossOriginAdapter(ext, abs);
      if (adapter) {
        let opts = init || {};
        if (isReq) opts = { method: input.method, headers: Object.fromEntries(input.headers), body: input.method === "GET" || input.method === "HEAD" ? void 0 : await input.text(), ...opts };
        if (opts.headers && typeof opts.headers.entries === "function") opts = { ...opts, headers: Object.fromEntries(opts.headers.entries()) };
        try {
          return await adapter(opts);
        } catch (e) {
          throw new TypeError("Failed to fetch", { cause: e });
        }
      }
      return nativeFetch(isReq ? input : abs, init);
    };
  }
  function createXHR(ext, { win, basePath }) {
    const Native = win.XMLHttpRequest;
    const fetchImpl = createFetch(ext, { win, basePath });
    const STATE = /* @__PURE__ */ Symbol("extshim-xhr");
    class XMLHttpRequest2 extends Native {
      open(method, url, async = true, user, password) {
        const raw = String(url);
        const path = ext.resolvePath(raw, basePath);
        let abs = raw;
        try {
          abs = new URL(raw, basePath != null ? ext.virtualUrl(basePath) : win.location.href).href;
        } catch {
        }
        const virtual = path != null || !!crossOriginAdapter(ext, abs);
        if (!virtual) {
          this[STATE] = null;
          return super.open(method, abs, async, user, password);
        }
        this[STATE] = { method, url: raw, headers: {}, readyState: 1, status: 0, statusText: "", response: null, text: "", responseURL: "", respHeaders: {} };
        this._fire("readystatechange");
      }
      setRequestHeader(k, v) {
        if (this[STATE]) this[STATE].headers[k] = v;
        else super.setRequestHeader(k, v);
      }
      send(body) {
        const st = this[STATE];
        if (!st) return super.send(body);
        const type = this.responseType;
        fetchImpl(st.url, { method: st.method, headers: st.headers, body: body == null ? void 0 : body }).then(async (r) => {
          st.status = r.status;
          st.statusText = r.statusText;
          st.responseURL = r.url || st.url;
          r.headers.forEach((v, k) => {
            st.respHeaders[k.toLowerCase()] = v;
          });
          st.readyState = 2;
          this._fire("readystatechange");
          if (type === "arraybuffer") st.response = await r.arrayBuffer();
          else if (type === "blob") st.response = await r.blob();
          else {
            st.text = await r.text();
            if (type === "json") {
              try {
                st.response = JSON.parse(st.text);
              } catch {
                st.response = null;
              }
            } else if (type === "document") {
              st.response = new win.DOMParser().parseFromString(st.text, /xml/.test(st.respHeaders["content-type"] || "") ? "text/xml" : "text/html");
            } else st.response = st.text;
          }
          st.readyState = 4;
          this._fire("readystatechange");
          this._fire("load");
          this._fire("loadend");
        }).catch(() => {
          st.readyState = 4;
          this._fire("readystatechange");
          this._fire("error");
          this._fire("loadend");
        });
      }
      abort() {
        if (this[STATE]) {
          this[STATE].readyState = 0;
          this._fire("abort");
        } else super.abort();
      }
      getAllResponseHeaders() {
        const st = this[STATE];
        if (!st) return super.getAllResponseHeaders();
        return Object.entries(st.respHeaders).map(([k, v]) => `${k}: ${v}`).join("\r\n") + (Object.keys(st.respHeaders).length ? "\r\n" : "");
      }
      getResponseHeader(k) {
        const st = this[STATE];
        return st ? st.respHeaders[String(k).toLowerCase()] ?? null : super.getResponseHeader(k);
      }
      get readyState() {
        return this[STATE] ? this[STATE].readyState : super.readyState;
      }
      get status() {
        return this[STATE] ? this[STATE].status : super.status;
      }
      get statusText() {
        return this[STATE] ? this[STATE].statusText : super.statusText;
      }
      get response() {
        return this[STATE] ? this[STATE].response : super.response;
      }
      get responseText() {
        return this[STATE] ? this[STATE].text : super.responseText;
      }
      get responseURL() {
        return this[STATE] ? this[STATE].responseURL : super.responseURL;
      }
      get responseXML() {
        return this[STATE] ? this.responseType === "document" ? this[STATE].response : null : super.responseXML;
      }
      _fire(type) {
        const E = type === "readystatechange" ? win.Event : win.ProgressEvent || win.Event;
        this.dispatchEvent(new E(type));
      }
    }
    return XMLHttpRequest2;
  }

  // src/runtime/dom.js
  var policy;
  var ttBlocked = false;
  function ttPolicy() {
    if (policy !== void 0) return policy;
    policy = null;
    try {
      const tt = window.trustedTypes;
      if (tt && tt.createPolicy) {
        policy = tt.createPolicy("extshim", { createHTML: (s) => s, createScriptURL: (s) => s });
      }
    } catch {
      policy = null;
    }
    return policy;
  }
  function trustedHTML(s) {
    const p = ttPolicy();
    return p ? p.createHTML(s) : s;
  }
  function trustedScriptURL(s) {
    const p = ttPolicy();
    return p ? p.createScriptURL(s) : s;
  }
  function freshDocument(iframe) {
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        iframe.removeEventListener("load", done);
        resolve(iframe.contentWindow);
      };
      iframe.addEventListener("load", done);
      try {
        if (ttBlocked && !ttPolicy()) throw new Error("tt");
        iframe.srcdoc = trustedHTML('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>');
      } catch {
        if (window.trustedTypes) ttBlocked = true;
        iframe.removeAttribute("srcdoc");
        iframe.src = "about:blank";
      }
    });
  }
  var VOID = new Set("area base br col embed hr img input link meta param source track wbr".split(" "));
  var RAW = /* @__PURE__ */ new Set(["script", "style", "textarea", "title", "noscript", "template", "xmp"]);
  var AUTO_CLOSE = {
    p: /^(address|article|aside|blockquote|div|dl|fieldset|footer|form|h[1-6]|header|hr|main|nav|ol|p|pre|section|table|ul)$/,
    li: /^li$/,
    dt: /^(dt|dd)$/,
    dd: /^(dt|dd)$/,
    option: /^(option|optgroup)$/,
    tr: /^tr$/,
    td: /^(td|th|tr)$/,
    th: /^(td|th|tr)$/
  };
  var ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\xA0", copy: "\xA9", reg: "\xAE", hellip: "\u2026", mdash: "\u2014", ndash: "\u2013", times: "\xD7", middot: "\xB7", laquo: "\xAB", raquo: "\xBB", bull: "\u2022", rarr: "\u2192", larr: "\u2190", check: "\u2713" };
  var decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return isNaN(n) ? m : String.fromCodePoint(n);
    }
    return ENT[e.toLowerCase()] ?? m;
  });
  function parseHtmlManually(html, doc) {
    const root = doc.documentElement;
    const head = doc.head || root.appendChild(doc.createElement("head"));
    const body = doc.body || root.appendChild(doc.createElement("body"));
    while (head.firstChild) head.firstChild.remove();
    while (body.firstChild) body.firstChild.remove();
    const stack = [body];
    let cur = () => stack[stack.length - 1];
    const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/gi;
    let last = 0;
    let m;
    let bodyStarted = false;
    const text = (t) => {
      if (!t) return;
      if (cur() === body && !bodyStarted) {
        if (!t.trim()) return;
        bodyStarted = true;
      }
      cur().appendChild(doc.createTextNode(decode(t)));
    };
    while (m = re.exec(html)) {
      text(html.slice(last, m.index));
      last = re.lastIndex;
      if (m[0].startsWith("<!")) continue;
      if (m[1]) {
        const name2 = m[1].toLowerCase();
        if (name2 === "html" || name2 === "head" || name2 === "body") {
          if (name2 === "head") stack.splice(1);
          continue;
        }
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].localName === name2) {
            stack.length = i;
            break;
          }
        }
        continue;
      }
      const name = m[2].toLowerCase();
      const attrs = [];
      const are = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let a;
      while (a = are.exec(m[3] || "")) attrs.push([a[1], decode(a[2] ?? a[3] ?? a[4] ?? "")]);
      if (name === "html" || name === "body") {
        const t = name === "html" ? root : body;
        for (const [k, v] of attrs) try {
          t.setAttribute(k, v);
        } catch {
        }
        if (name === "body") stack.splice(1);
        continue;
      }
      if (name === "head") {
        stack.splice(1);
        stack.push(head);
        continue;
      }
      const p = cur();
      const ac = AUTO_CLOSE[p.localName];
      if (ac && ac.test(name)) stack.pop();
      const inHead = !bodyStarted && stack.length === 1 && /^(meta|link|title|style|script|base)$/.test(name);
      if (!inHead && cur() === body) bodyStarted = true;
      const el2 = doc.createElement(name === "script" ? "extshim-script" : name);
      for (const [k, v] of attrs) {
        try {
          el2.setAttribute(k, v);
        } catch {
        }
      }
      (inHead ? head : cur()).appendChild(el2);
      if (RAW.has(name)) {
        const end = html.toLowerCase().indexOf("</" + name, last);
        const content = html.slice(last, end < 0 ? html.length : end);
        if (name === "script" || name === "style") el2.textContent = content;
        else if (name !== "template") el2.textContent = decode(content);
        last = end < 0 ? html.length : html.indexOf(">", end) + 1;
        re.lastIndex = last;
        continue;
      }
      if (!VOID.has(name) && !m[4]) stack.push(el2);
      cur = () => stack[stack.length - 1];
    }
    text(html.slice(last));
  }
  function parseHtml(html, win) {
    try {
      if (ttBlocked && !ttPolicy()) throw new Error("tt");
      return { doc: new win.DOMParser().parseFromString(trustedHTML(html), "text/html"), manual: false };
    } catch {
      if (window.trustedTypes) ttBlocked = true;
      const doc = win.document.implementation.createHTMLDocument("");
      parseHtmlManually(html, doc);
      return { doc, manual: true };
    }
  }
  function adoptCss(root, win, cssList) {
    const sheets = [];
    if ("adoptedStyleSheets" in root) {
      for (const { css, media } of cssList) {
        try {
          const s = new win.CSSStyleSheet(media ? { media } : void 0);
          s.replaceSync(css.replace(/@import[^;]+;/g, ""));
          sheets.push(s);
        } catch {
        }
      }
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...sheets];
      return () => {
        root.adoptedStyleSheets = root.adoptedStyleSheets.filter((s) => !sheets.includes(s));
      };
    }
    const doc = root.ownerDocument || root;
    const els = cssList.map(({ css, media }) => {
      const st = doc.createElement("style");
      if (media) st.media = media;
      st.textContent = css;
      (root.head || root).appendChild(st);
      return st;
    });
    return () => els.forEach((e) => e.remove());
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // src/runtime/pages.js
  var RESOURCE_ATTRS = [
    ["img", "src"],
    ["source", "src"],
    ["video", "src"],
    ["video", "poster"],
    ["audio", "src"],
    ["track", "src"],
    ["input", "src"],
    ["embed", "src"],
    ["object", "data"],
    ["image", "href"],
    ["use", "href"],
    ["link", "href"]
  ];
  async function renderPage(ext, opts) {
    const { type, iframe, path, worker = false, search = "", hash = "", tabId = null, parentWorld = null } = opts;
    let html = opts.html ?? await ext.vfs.text(path);
    if (html == null) {
      ext.log.error(`Extension page not found: ${path}`);
      html = `<!DOCTYPE html><html><body style="font:13px system-ui;padding:16px;color:#b00">This extension page was not found: ${escapeHtml(path)}</body></html>`;
    }
    const win = await freshDocument(iframe);
    const doc = win.document;
    const loc = { path, search, hash };
    const url = () => ext.virtualUrl(loc.path) + loc.search + loc.hash;
    const world = new World({ kind: "frame", target: win, log: ext.log, label: path });
    const ctx = new Context(ext, { type, url: url(), tabId, win, world, path });
    const navigate = (target) => {
      const p = ext.resolvePath(target, loc.path);
      if (p == null) {
        window.open(String(target), "_blank");
        return;
      }
      const q = /\?[^#]*/.exec(target);
      const h = /#.*/.exec(target);
      if (p === loc.path && !q && h) {
        setHash(h[0]);
        return;
      }
      ctx.destroy();
      if (opts.onNavigate) opts.onNavigate(ext.virtualUrl(p) + (q ? q[0] : "") + (h ? h[0] : ""));
      renderPage(ext, { ...opts, html: null, path: p, search: q ? q[0] : "", hash: h ? h[0] : "" }).then((c) => opts.onReplaced && opts.onReplaced(c));
    };
    const setHash = (h) => {
      const oldURL = url();
      loc.hash = h ? h.startsWith("#") ? h : "#" + h : "";
      ctx.url = url();
      try {
        win.dispatchEvent(new win.HashChangeEvent("hashchange", { oldURL, newURL: url() }));
      } catch {
      }
    };
    installFrameGlobals(ext, ctx, world, win, { worker, loc, url, navigate, setHash, opts, parentWorld });
    for (const hook of ext.frameHooks) {
      try {
        hook(win, ctx);
      } catch (e) {
        ext.log.error(e);
      }
    }
    const { doc: parsed, manual } = parseHtml(html, win);
    const scripts = [];
    for (const s of parsed.querySelectorAll("script, extshim-script")) {
      scripts.push({ src: s.getAttribute("src"), module: /module/i.test(s.getAttribute("type") || ""), text: s.textContent, type: s.getAttribute("type") || "" });
      s.remove();
    }
    for (const el2 of parsed.querySelectorAll('noscript, meta[http-equiv="Content-Security-Policy" i], base')) el2.remove();
    const cssList = [];
    for (const el2 of parsed.querySelectorAll('link[rel~="stylesheet" i], style')) {
      if (el2.localName === "style") {
        cssList.push({ css: ext.transformCss(path, el2.textContent), media: el2.getAttribute("media") || "" });
        el2.remove();
      } else {
        const p = ext.resolvePath(el2.getAttribute("href"), path);
        if (p == null) continue;
        cssList.push({ css: await ext.cssText(p), media: el2.getAttribute("media") || "" });
        el2.remove();
      }
    }
    for (const [tag, attr] of RESOURCE_ATTRS) {
      for (const el2 of parsed.getElementsByTagName(tag)) {
        const v = el2.getAttribute(attr) || (attr === "href" ? el2.getAttribute("xlink:href") : null);
        if (!v || tag === "link" && !/icon/i.test(el2.getAttribute("rel") || "")) continue;
        const p = ext.resolvePath(v, path);
        if (p != null && ext.vfs.has(p)) {
          const frag = /#.*/.exec(v);
          el2.setAttribute(attr, ext.resourceUrl(p) + (frag && tag === "use" ? frag[0] : ""));
        }
      }
    }
    const styled = [...parsed.querySelectorAll("[style]")].map((el2) => [el2, ext.transformCss(path, el2.getAttribute("style"))]);
    const frames = [];
    for (const f of parsed.querySelectorAll("iframe[src], frame[src]")) {
      const p = ext.resolvePath(f.getAttribute("src"), path);
      if (p != null && /\.html?$/i.test(p)) {
        frames.push([f, f.getAttribute("src")]);
        f.removeAttribute("src");
      } else if (p != null) f.setAttribute("src", ext.resourceUrl(p));
    }
    styled.forEach(([el2], i) => {
      el2.setAttribute("data-extshim-style", String(i));
    });
    frames.forEach(([el2], i) => {
      el2.setAttribute("data-extshim-frame", String(i));
    });
    if (manual) {
      doc.documentElement.replaceWith(doc.adoptNode(parsed.documentElement));
    } else {
      doc.replaceChild(doc.importNode(parsed.documentElement, true), doc.documentElement);
    }
    adoptCss(doc, win, cssList.filter((c) => c.css));
    for (const el2 of doc.querySelectorAll("[data-extshim-style]")) {
      const css = styled[+el2.getAttribute("data-extshim-style")][1];
      el2.removeAttribute("data-extshim-style");
      try {
        el2.style.cssText = css;
      } catch {
      }
    }
    for (const el2 of doc.querySelectorAll("[data-extshim-frame]")) {
      const src = frames[+el2.getAttribute("data-extshim-frame")][1];
      el2.removeAttribute("data-extshim-frame");
      renderPage(ext, { type: "frame", iframe: el2, path: ext.resolvePath(src, path), search: (/\?[^#]*/.exec(src) || [""])[0], hash: (/#.*/.exec(src) || [""])[0], parentWorld: world, tabId }).catch((e) => ext.log.error(e));
    }
    if (opts.onTitle) {
      opts.onTitle(doc.title);
      const mo = new win.MutationObserver(() => opts.onTitle(doc.title));
      mo.observe(doc.head || doc.documentElement, { subtree: true, childList: true, characterData: true });
    }
    win.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = e.composedPath().find((n) => n && n.localName === "a" && n.hasAttribute && n.hasAttribute("href"));
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || /^javascript:/i.test(href)) return;
      if (href.startsWith("#")) {
        e.preventDefault();
        setHash(href);
        const t = doc.getElementById(decodeURIComponent(href.slice(1)));
        if (t) t.scrollIntoView();
        return;
      }
      e.preventDefault();
      const p = ext.resolvePath(href, loc.path);
      const newTab = a.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey || type === "popup" || type === "background";
      if (p != null) {
        if (newTab) ext.openTab(ext.virtualUrl(p) + (/\?[^#]*/.exec(href) || [""])[0] + (/#.*/.exec(href) || [""])[0]);
        else navigate(href);
      } else {
        window.open(new URL(href, location.href).href, "_blank", "noopener");
      }
    });
    if (ext.state.commands) ext.state.commands.attach(win);
    if (opts.onClose && (type === "popup" || type === "tab" || type === "sidepanel")) {
      win.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && type === "popup" && !e.defaultPrevented) opts.onClose();
      });
    }
    win.addEventListener("pagehide", () => ctx.destroy());
    let readyState = "loading";
    try {
      Object.defineProperty(doc, "readyState", { get: () => readyState, configurable: true });
    } catch {
    }
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
    readyState = "interactive";
    fire(doc, win, "readystatechange");
    fire(doc, win, "DOMContentLoaded", true);
    await Promise.resolve();
    readyState = "complete";
    try {
      delete doc.readyState;
    } catch {
    }
    fire(doc, win, "readystatechange");
    try {
      win.dispatchEvent(new win.Event("load"));
    } catch {
    }
    try {
      win.dispatchEvent(new win.PageTransitionEvent("pageshow", { persisted: false }));
    } catch {
    }
    if (opts.onResize) autoSize(win, opts.onResize);
    ctx.markReady();
    return ctx;
  }
  function fire(doc, win, type, bubbles = false) {
    try {
      doc.dispatchEvent(new win.Event(type, { bubbles }));
    } catch {
    }
  }
  function loadExternalScript(win, src, module) {
    return new Promise((res) => {
      const s = win.document.createElement("script");
      if (module) s.type = "module";
      s.onload = s.onerror = () => res();
      s.src = trustedScriptURL(src);
      (win.document.head || win.document.documentElement).appendChild(s);
    });
  }
  async function loadModuleNative(ext, win, path) {
    let src;
    if (ext.vfs.kind === "http") src = ext.vfs.url(path);
    else src = await moduleBlobUrl(ext, path, /* @__PURE__ */ new Map());
    await loadExternalScript(win, src, true);
  }
  async function moduleBlobUrl(ext, path, seen) {
    if (seen.has(path)) return seen.get(path);
    seen.set(path, ext.resourceUrl(path));
    let code = await ext.vfs.text(path);
    if (code == null) throw new Error("Module not found: " + path);
    const specs = /* @__PURE__ */ new Set();
    const re = /(\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|\bexport\s*(?:\*|\{[^}]*\})\s*from\s*|\bimport\s*\(\s*)(['"])([^'"]+)\2/g;
    let m;
    while (m = re.exec(code)) specs.add(m[3]);
    const map = /* @__PURE__ */ new Map();
    for (const sp of specs) {
      if (!/^(\.{0,2}\/)/.test(sp)) continue;
      const dep = normalizePath(sp, path);
      if (ext.vfs.has(dep)) map.set(sp, await moduleBlobUrl(ext, dep, seen));
    }
    code = code.replace(re, (all, pre, q, sp) => map.has(sp) ? pre + q + map.get(sp) + q : all);
    code = code.replace(/\bimport\.meta\.url\b/g, JSON.stringify(ext.virtualUrl(path)));
    const u = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    seen.set(path, u);
    return u;
  }
  async function activateWorker(ext, win) {
    for (const type of ["install", "activate"]) {
      const waits = [];
      try {
        const ev = new win.Event(type);
        ev.waitUntil = (p) => waits.push(Promise.resolve(p).catch((e) => ext.log.error(`${type} waitUntil rejected:`, e)));
        win.dispatchEvent(ev);
      } catch (e) {
        ext.log.error(e);
      }
      await Promise.race([Promise.all(waits), new Promise((r) => setTimeout(r, 5e3))]);
    }
  }
  function autoSize(win, onResize) {
    const doc = win.document;
    const html = doc.documentElement;
    html.style.setProperty("width", "max-content");
    html.style.setProperty("max-width", "800px");
    html.style.setProperty("min-width", "25px");
    let last = "";
    const measure = () => {
      if (!doc.documentElement) return;
      const r = html.getBoundingClientRect();
      const w = Math.min(800, Math.max(25, Math.ceil(r.width)));
      const vh = win.innerHeight;
      const content = r.height < vh - 1 ? r.height : Math.max(r.height, html.scrollHeight);
      const h = Math.min(600, Math.max(25, Math.ceil(content)));
      const key = w + "x" + h;
      if (key !== last) {
        last = key;
        onResize(w, h);
      }
    };
    measure();
    try {
      const ro = new win.ResizeObserver(measure);
      ro.observe(html);
      if (doc.body) ro.observe(doc.body);
    } catch {
      setInterval(measure, 300);
    }
    doc.addEventListener("load", measure, true);
  }
  function namespacedStorage(getReal, prefix) {
    let real = null;
    try {
      real = getReal();
      real.length;
    } catch {
      real = null;
    }
    const mem = /* @__PURE__ */ new Map();
    const S = real ? {
      get: (k) => real.getItem(prefix + k),
      set: (k, v) => real.setItem(prefix + k, v),
      del: (k) => real.removeItem(prefix + k),
      keys: () => {
        const out = [];
        for (let i = 0; i < real.length; i++) {
          const k = real.key(i);
          if (k && k.startsWith(prefix)) out.push(k.slice(prefix.length));
        }
        return out;
      }
    } : { get: (k) => mem.has(k) ? mem.get(k) : null, set: (k, v) => mem.set(k, v), del: (k) => mem.delete(k), keys: () => [...mem.keys()] };
    const api = {
      getItem: (k) => S.get(String(k)),
      setItem: (k, v) => S.set(String(k), String(v)),
      removeItem: (k) => S.del(String(k)),
      clear: () => S.keys().forEach((k) => S.del(k)),
      key: (i) => S.keys()[i] ?? null
    };
    return new Proxy(api, {
      get(t, k) {
        if (k === "length") return S.keys().length;
        if (typeof k === "symbol" || k in t) return t[k];
        const v = S.get(k);
        return v === null ? void 0 : v;
      },
      set(t, k, v) {
        S.set(String(k), String(v));
        return true;
      },
      deleteProperty(t, k) {
        S.del(String(k));
        return true;
      },
      has(t, k) {
        return k in t || S.get(String(k)) !== null;
      },
      ownKeys() {
        return S.keys();
      },
      getOwnPropertyDescriptor(t, k) {
        if (typeof k === "symbol") return void 0;
        const v = S.get(k);
        return v === null ? void 0 : { value: v, writable: true, enumerable: true, configurable: true };
      }
    });
  }
  function namespacedIDB(real, prefix) {
    if (!real) return real;
    return {
      open: (name, v) => v === void 0 ? real.open(prefix + name) : real.open(prefix + name, v),
      deleteDatabase: (name) => real.deleteDatabase(prefix + name),
      databases: async () => (await real.databases()).filter((d) => d.name.startsWith(prefix)).map((d) => ({ ...d, name: d.name.slice(prefix.length) })),
      cmp: (a, b) => real.cmp(a, b)
    };
  }
  function makeLocation(ext, loc, url, navigate, setHash) {
    const u = () => new URL(url());
    const L = {
      get href() {
        return url();
      },
      set href(v) {
        navigate(String(v));
      },
      get protocol() {
        return ext.options.urlScheme + ":";
      },
      get host() {
        return ext.id;
      },
      get hostname() {
        return ext.id;
      },
      get port() {
        return "";
      },
      get origin() {
        return ext.origin;
      },
      get pathname() {
        return "/" + loc.path;
      },
      set pathname(v) {
        navigate(String(v));
      },
      get search() {
        return loc.search;
      },
      set search(v) {
        v = String(v);
        navigate("/" + loc.path + (v && !v.startsWith("?") ? "?" + v : v));
      },
      get hash() {
        return loc.hash;
      },
      set hash(v) {
        setHash(String(v));
      },
      get ancestorOrigins() {
        return [];
      },
      assign: (v) => navigate(String(v)),
      replace: (v) => navigate(String(v)),
      reload: () => navigate("/" + loc.path + loc.search + loc.hash),
      toString: () => url(),
      valueOf() {
        return L;
      }
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
        loc.hash = h ? h[0] : "";
      }
    };
    return {
      get length() {
        return real.length;
      },
      get state() {
        return state;
      },
      get scrollRestoration() {
        return real.scrollRestoration;
      },
      set scrollRestoration(v) {
        try {
          real.scrollRestoration = v;
        } catch {
        }
      },
      pushState: update,
      replaceState: update,
      back: () => {
      },
      forward: () => {
      },
      go: (n) => {
        if (!n) navigate(url());
      }
    };
  }
  function installFrameGlobals(ext, ctx, world, win, { worker, loc, url, navigate, setHash, opts, parentWorld }) {
    const api = ctx.api;
    const lsPrefix = `extshim:${ext.id}:ls:`;
    const fetch2 = createFetch(ext, { win, basePath: loc.path });
    const XHR = createXHR(ext, { win, basePath: loc.path });
    const localStorage2 = namespacedStorage(() => win.localStorage, lsPrefix);
    const sessionStorage2 = namespacedStorage(() => win.sessionStorage, lsPrefix);
    const indexedDB2 = namespacedIDB((() => {
      try {
        return win.indexedDB;
      } catch {
        return null;
      }
    })(), `extshim:${ext.id}:`);
    const close = () => {
      if (opts.onClose) opts.onClose();
    };
    const open = (u, target, features2) => {
      if (u == null || u === "") return null;
      const p = ext.resolvePath(String(u), loc.path);
      if (p != null) {
        ext.openTab(ext.virtualUrl(p) + (/\?[^#]*/.exec(u) || [""])[0] + (/#.*/.exec(u) || [""])[0]);
        return null;
      }
      return window.open(new URL(String(u), location.href).href, target, features2);
    };
    const realGlobals = { chrome: api, fetch: fetch2, XMLHttpRequest: XHR, localStorage: localStorage2, sessionStorage: sessionStorage2, indexedDB: indexedDB2, close, open };
    if (ext.options.exposeBrowser) realGlobals.browser = api;
    for (const [k, v] of Object.entries(realGlobals)) {
      try {
        Object.defineProperty(win, k, { value: v, writable: true, configurable: true, enumerable: k !== "chrome" && k !== "browser" });
      } catch {
      }
    }
    const proxy = world.proxy;
    world.define({
      ...realGlobals,
      location: makeLocation(ext, loc, url, navigate, setHash),
      history: makeHistory(win, loc, url, navigate),
      origin: ext.origin,
      top: parentWorld ? parentWorld.get("top") : proxy,
      parent: parentWorld ? parentWorld.proxy : proxy,
      opener: null,
      frameElement: null
    });
    if (worker) {
      const registration = {
        scope: ext.baseUrl,
        active: { state: "activated", scriptURL: url() },
        installing: null,
        waiting: null,
        showNotification: async (title, o = {}) => {
          ext.shared("notifications", () => new NotificationsState(ext)).create(null, { type: "basic", title, message: o.body || "", iconUrl: o.icon, requireInteraction: o.requireInteraction, buttons: (o.actions || []).map((a) => ({ title: a.title })) }, ctx);
        },
        getNotifications: async () => [],
        unregister: async () => false,
        update: async () => registration,
        addEventListener() {
        },
        removeEventListener() {
        }
      };
      world.define({
        window: void 0,
        document: void 0,
        localStorage: void 0,
        sessionStorage: void 0,
        XMLHttpRequest: void 0,
        registration,
        serviceWorker: registration.active,
        skipWaiting: async () => {
        },
        clients: {
          claim: async () => {
          },
          matchAll: async () => [],
          get: async () => void 0,
          openWindow: async (u) => {
            await api.tabs.create({ url: u });
            return null;
          }
        },
        importScripts: (...urls) => {
          for (const u of urls) {
            const p = ext.resolvePath(String(u), loc.path);
            if (p == null) throw new Error(`importScripts: cannot load external script ${u}`);
            const unit = ext.unitSync(p);
            if (!world.run(unit, ext.virtualUrl(p))) throw new Error(`importScripts: ${p} failed`);
          }
        }
      });
    }
    void proxy;
  }

  // src/runtime/content.js
  var RUN_ORDER = ["document_start", "document_end", "document_idle"];
  function whenState(doc, state) {
    return new Promise((resolve) => {
      const ok = () => state === "document_start" || (state === "document_end" ? doc.readyState !== "loading" : doc.readyState === "complete");
      if (ok()) return resolve();
      if (state === "document_end") {
        doc.addEventListener("DOMContentLoaded", () => resolve(), { once: true });
        return;
      }
      const go = () => setTimeout(resolve, 0);
      if (doc.readyState === "loading") {
        doc.addEventListener("DOMContentLoaded", () => setTimeout(resolve, 200), { once: true });
        (doc.defaultView || window).addEventListener("load", go, { once: true });
      } else go();
    });
  }
  var ContentManager = class {
    constructor(ext) {
      this.ext = ext;
      this.frames = /* @__PURE__ */ new Map();
      this.nextFrameId = 1;
      this.css = /* @__PURE__ */ new Map();
      this.observer = null;
      this.stopped = false;
    }
    async start() {
      const ext = this.ext;
      this.watchDom(document);
      const reg = (await ext.storage.internal().get("registeredScripts")).registeredScripts || [];
      const all = getContentScripts(ext.manifest).concat(reg.map(toEntry));
      const url = location.href;
      const matched = ext.options.contentScripts === "all" ? all : all.filter((e) => contentScriptMatches(e, url));
      if (!matched.length) {
        if (all.length) ext.log.info(`No content script matches ${url}. (Use the contentScripts:"all" option to inject anyway.)`);
        return;
      }
      const top = this.frame(window);
      for (const e of matched) if (e.css.length) this.insertCss(top, { files: e.css, key: "cs:" + e.index });
      for (const when of RUN_ORDER) {
        const group2 = matched.filter((e) => e.run_at === when);
        if (!group2.length) continue;
        await whenState(document, when);
        if (this.stopped) return;
        for (const e of group2) await this.injectEntry(top, e);
      }
      if (matched.some((e) => e.all_frames)) this.watchFrames(matched.filter((e) => e.all_frames));
    }
    stop() {
      this.stopped = true;
      if (this.observer) this.observer.disconnect();
      if (this.frameObserver) this.frameObserver.disconnect();
      for (const rm of this.css.values()) rm();
      this.css.clear();
      for (const f of this.frames.values()) if (f.ctx) f.ctx.destroy();
      this.frames.clear();
    }
    /** Per-frame bookkeeping, created lazily. */
    frame(win) {
      let f = this.frames.get(win);
      if (!f) {
        f = { win, frameId: win === window ? 0 : this.nextFrameId++, isolated: null, main: null, ctx: null };
        this.frames.set(win, f);
      }
      return f;
    }
    frameById(frameId) {
      for (const f of this.frames.values()) if (f.frameId === frameId) return f;
      return frameId === 0 ? this.frame(window) : null;
    }
    /** The extension's isolated world in a frame (one per extension per frame, like Chrome). */
    isolated(f) {
      if (f.isolated && f.ctx && f.ctx.alive) return f.isolated;
      const ext = this.ext;
      const win = f.win;
      const world = new World({ kind: "content", target: win, log: ext.log, label: "content script" });
      const ctx = new Context(ext, { type: "content", url: win.location.href, tabId: ext.shim.tabId, frameId: f.frameId, win, world });
      const api = ctx.api;
      const isTop = win === win.top;
      world.define({
        chrome: api,
        fetch: createFetch(ext, { win, basePath: null }),
        XMLHttpRequest: createXHR(ext, { win, basePath: null }),
        top: isTop ? world.proxy : win.top,
        parent: isTop ? world.proxy : win.parent,
        wrappedJSObject: win,
        cloneInto: (obj) => obj,
        exportFunction: (fn, target, o) => {
          if (o && o.defineAs && target) target[o.defineAs] = fn;
          return fn;
        }
      });
      if (ext.options.exposeBrowser) world.define({ browser: api });
      ctx.markReady();
      f.isolated = world;
      f.ctx = ctx;
      return world;
    }
    main(f) {
      if (!f.main) f.main = new World({ kind: "main", target: f.win, log: this.ext.log, label: "main world" });
      return f.main;
    }
    async injectEntry(f, e) {
      const world = e.world === "MAIN" ? this.main(f) : this.isolated(f);
      for (const p of e.js) {
        if (this.stopped) return;
        try {
          world.run(await this.ext.unit(p), this.ext.virtualUrl(p));
        } catch (err) {
          this.ext.log.error(`Could not run content script ${p}:`, err);
        }
      }
    }
    insertCss(f, { files = [], css = "", key, origin } = {}) {
      const ext = this.ext;
      const doc = f.win.document;
      const run = async () => {
        const list = [];
        for (const p of files) list.push({ css: await ext.cssText(normalizePath(p)) });
        if (css) list.push({ css: ext.transformCss("", css) });
        const target = origin === "USER" ? doc : doc;
        const rm = adoptCss(target, f.win, list);
        const k = key || JSON.stringify([f.frameId, files, css]);
        const prev = this.css.get(k);
        this.css.set(k, prev ? () => {
          prev();
          rm();
        } : rm);
      };
      return run();
    }
    removeCss(f, { files = [], css = "" } = {}) {
      const k = JSON.stringify([f.frameId, files, css]);
      const rm = this.css.get(k);
      if (rm) {
        rm();
        this.css.delete(k);
      }
    }
    targetFrames(target = {}) {
      const all = [this.frame(window), ...[...this.frames.values()].filter((f) => f.frameId !== 0)];
      if (target.allFrames) return all.filter((f) => !f.win.closed);
      if (target.frameIds && target.frameIds.length) return target.frameIds.map((id) => this.frameById(id)).filter(Boolean);
      return [all[0]];
    }
    /**
     * Shared implementation of scripting.executeScript / tabs.executeScript.
     * @returns {Promise<Array<{frameId:number, result:any, documentId:string}>>}
     */
    async execute(callerCtx, { target, files, func, args = [], code, world: worldName = "ISOLATED" }) {
      const out = [];
      for (const f of this.targetFrames(target)) {
        const w = worldName === "MAIN" ? this.main(f) : this.isolated(f);
        let result;
        if (func) {
          const useEval = (this.ext.options.dynamic || this.ext.options.evalFunctions) && canEval();
          if (useEval) result = w.callSerialized(Function.prototype.toString.call(func), JSON.parse(JSON.stringify(args)));
          else {
            const caller = callerCtx.world;
            if (caller) caller.redirect = w;
            try {
              result = func(...args);
            } finally {
              if (caller) caller.redirect = null;
            }
          }
        } else if (code != null) {
          if (!canEval()) throw new Error("executeScript({code}) needs eval, which this page's CSP blocks. Use files or func.");
          result = w.evaluate(String(code));
        } else if (files) {
          for (const p of files) {
            const path = normalizePath(p);
            w.run(await this.ext.unit(path), this.ext.virtualUrl(path));
          }
        }
        if (result && typeof result.then === "function") result = await result;
        let clean;
        try {
          clean = result === void 0 ? null : JSON.parse(JSON.stringify(result));
        } catch {
          clean = null;
        }
        out.push({ frameId: f.frameId, result: clean, documentId: f.ctx ? f.ctx.documentId : void 0 });
      }
      return out;
    }
    /** Inject all_frames scripts into same-origin child frames. */
    watchFrames(entries) {
      const inject = (iframe) => {
        const tryIt = () => {
          let win;
          try {
            win = iframe.contentWindow;
            if (!win || !win.document) return;
            void win.location.href;
          } catch {
            return;
          }
          if (this.frames.has(win)) return;
          const f = this.frame(win);
          const url = win.location.href;
          for (const e of entries) {
            if (this.ext.options.contentScripts !== "all" && url !== "about:blank" && !contentScriptMatches(e, url)) continue;
            if (e.css.length) this.insertCss(f, { files: e.css });
            this.injectEntry(f, e);
          }
        };
        iframe.addEventListener("load", () => {
          const w = iframe.contentWindow;
          if (w) this.frames.delete(w);
          tryIt();
        });
        if (iframe.contentDocument && iframe.contentDocument.readyState === "complete") tryIt();
      };
      document.querySelectorAll("iframe, frame").forEach((f) => {
        if (!f.hasAttribute("data-extshim")) inject(f);
      });
      this.frameObserver = new MutationObserver((muts) => {
        for (const m of muts) for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if ((n.localName === "iframe" || n.localName === "frame") && !n.hasAttribute("data-extshim")) inject(n);
          else if (n.querySelectorAll) n.querySelectorAll("iframe, frame").forEach(inject);
        }
      });
      this.frameObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    /**
     * Content scripts often insert extension URLs into the page: <img src=getURL(..)>,
     * <iframe src=getURL('panel.html')>. Rewrite them to loadable resources, and render
     * extension pages inside such iframes.
     */
    watchDom(doc) {
      const ext = this.ext;
      const base = ext.baseUrl;
      const fix = (el2) => {
        if (el2.nodeType !== 1 || el2.hasAttribute("data-extshim")) return;
        const tag = el2.localName;
        if (tag === "iframe" || tag === "frame") {
          const src = el2.getAttribute("src");
          const p = src ? ext.resolvePath(src) : null;
          if (p != null && /\.html?$/i.test(p) && el2.getAttribute("data-extshim-page") !== src) {
            el2.setAttribute("data-extshim-page", src);
            el2.removeAttribute("src");
            const q = /\?[^#]*/.exec(src);
            const h = /#.*/.exec(src);
            renderPage(ext, { type: "frame", iframe: el2, path: p, search: q ? q[0] : "", hash: h ? h[0] : "", tabId: ext.shim.tabId }).catch((e) => ext.log.error(e));
          }
          return;
        }
        for (const attr of ["src", "href", "poster", "data"]) {
          const v = el2.getAttribute(attr);
          if (v && v.startsWith(base)) {
            const p = ext.resolvePath(v);
            if (p != null && ext.vfs.has(p)) el2.setAttribute(attr, ext.resourceUrl(p) + (/#.*/.exec(v) || [""])[0]);
          }
        }
        const st = el2.getAttribute("style");
        if (st && st.includes(base)) el2.style.cssText = ext.transformCss("", st.split(base).join(""));
      };
      const scan = (root) => {
        if (root.nodeType !== 1) return;
        fix(root);
        if (root.querySelectorAll) for (const el2 of root.querySelectorAll("iframe,frame,img,source,video,audio,link,image,use,embed,object,[style]")) fix(el2);
      };
      this.observer = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === "attributes") fix(m.target);
          else for (const n of m.addedNodes) scan(n);
        }
      });
      const start = () => this.observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "href", "style", "poster", "data"] });
      if (doc.documentElement) start();
    }
  };
  function toEntry(s) {
    return {
      index: "reg:" + s.id,
      matches: s.matches || [],
      exclude_matches: s.excludeMatches || [],
      include_globs: [],
      exclude_globs: [],
      js: (s.js || []).map((p) => normalizePath(p)),
      css: (s.css || []).map((p) => normalizePath(p)),
      run_at: s.runAt || "document_idle",
      all_frames: !!s.allFrames,
      world: (s.world || "ISOLATED").toUpperCase()
    };
  }

  // src/runtime/extension.js
  var DEFAULTS = {
    ui: { launcher: true, position: "bottom-right" },
    storage: "auto",
    contentScripts: "manifest",
    // 'manifest' | 'all' (ignore match patterns) | false
    background: true,
    urlScheme: "chrome-extension",
    messageSerialization: "json",
    contextMenuModifier: "altKey",
    corsProxy: null,
    locale: null,
    exposeBrowser: true,
    allApis: false,
    log: "info",
    host: null
  };
  function makeLogger(name, level) {
    const tag = `[ExtShim \xB7 ${name}]`;
    const silent = () => {
    };
    const lv = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 }[level] ?? 1;
    return {
      debug: lv <= 0 ? console.debug.bind(console, tag) : silent,
      info: lv <= 1 ? console.info.bind(console, tag) : silent,
      log: lv <= 1 ? console.log.bind(console, tag) : silent,
      warn: lv <= 2 ? console.warn.bind(console, tag) : silent,
      error: lv <= 3 ? console.error.bind(console, tag) : silent
    };
  }
  var Extension = class {
    constructor(shim, { vfs, manifest, id, options = {} }) {
      this.shim = shim;
      this.vfs = vfs;
      this.manifest = manifest;
      this.options = { ...DEFAULTS, ...options, ui: { ...DEFAULTS.ui, ...options.ui || {} } };
      this.id = this.options.id || id || computeExtensionId(manifest);
      this.mv = manifestVersion(manifest);
      this.baseUrl = `${this.options.urlScheme}://${this.id}/`;
      this.origin = `${this.options.urlScheme}://${this.id}`;
      this.log = makeLogger(manifest.name || this.id, this.options.log);
      this.contexts = /* @__PURE__ */ new Set();
      this.bus = new Bus(this);
      this.storage = new StorageManager(this);
      this.content = new ContentManager(this);
      this.state = {};
      this.overlays = /* @__PURE__ */ new Map();
      this.units = /* @__PURE__ */ new Map();
      this.cleanups = [];
      this.features = features;
      this.navHooks = /* @__PURE__ */ new Set();
      this.frameHooks = /* @__PURE__ */ new Set();
      this.status = "idle";
      this.background = null;
      this._bgReady = Promise.resolve();
    }
    shared(key, init) {
      if (!(key in this.state)) this.state[key] = init();
      return this.state[key];
    }
    // ------------------------------------------------------------------ lifecycle
    async start() {
      this.status = "starting";
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
      this.cleanups.push(() => {
        this.launcher.remove();
        this.shim.ui.destroyIfEmpty();
      });
      this.cleanups.push(startCommands(this));
      const perms = manifestPermissions(this.manifest);
      for (const s of startupHooks()) {
        const c = s.cond;
        const ok = typeof c === "function" ? c(this) : !c.length || this.options.allApis || c.some((p) => perms.has(p));
        if (!ok) continue;
        try {
          await s.fn(this);
        } catch (e) {
          this.log.error("Startup hook failed:", e);
        }
      }
      let resolveBg;
      this._bgReady = new Promise((r) => {
        resolveBg = r;
      });
      if (this.options.background) {
        this._startBackground().then(resolveBg, (e) => {
          this.log.error("Background failed to start:", e);
          resolveBg();
        });
      } else resolveBg();
      if (this.options.contentScripts !== false) this.content.start();
      await this._bgReady;
      await this._lifecycleEvents();
      this.status = "running";
      this.log.debug("running", this.id);
      return this;
    }
    whenBackgroundReady() {
      return this._bgReady;
    }
    async _startBackground() {
      const bg = getBackground(this.manifest);
      if (!bg) return;
      if (this.options.dynamic && this.vfs.kind === "http" && bg.files) await this.vfs.prefetch(bg.files);
      const frame = this.shim.ui.hiddenFrame(this, "background");
      this.cleanups.push(() => frame.remove());
      const ctx = await renderPage(this, {
        type: "background",
        iframe: frame,
        path: bg.page || (bg.kind === "worker" ? bg.files[0] : "_generated_background_page.html"),
        html: bg.page ? null : this._generatedBackgroundHtml(bg),
        worker: bg.kind === "worker",
        module: bg.module
      });
      this.background = ctx;
    }
    _generatedBackgroundHtml(bg) {
      const type = bg.module ? ' type="module"' : "";
      return "<!DOCTYPE html><html><head></head><body>" + bg.files.map((f) => `<script${type} src="/${f}"><\/script>`).join("") + "</body></html>";
    }
    async _lifecycleEvents() {
      const internal = this.storage.internal();
      const meta = (await internal.get("install")).install;
      const version = this.manifest.version || "0";
      if (!meta) {
        this.dispatch("runtime.onInstalled", [{ reason: "install" }]);
      } else if (meta.version !== version) {
        this.dispatch("runtime.onInstalled", [{ reason: "update", previousVersion: meta.version }]);
      } else {
        this.dispatch("runtime.onStartup", []);
      }
      await internal.set({ install: { version, time: meta && meta.time || Date.now() } });
    }
    async stop() {
      if (this.status === "stopped") return;
      this.status = "stopped";
      if (this.popup) this.popup.panel.close();
      for (const o of [...this.overlays.values()]) o.panel.close();
      for (const c of [...this.contexts]) c.destroy();
      for (const fn of this.cleanups.splice(0)) {
        try {
          fn();
        } catch (e) {
          this.log.error(e);
        }
      }
      this.content.stop();
      for (const t of Object.values(this.state)) {
        if (t && typeof t.dispose === "function") t.dispose();
      }
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
      this.messages = /* @__PURE__ */ Object.create(null);
      this.uiLocale = (this.options.locale || navigator.language || "en").replace("-", "_");
      if (!def) return;
      const prefs = this.options.locale ? [this.options.locale] : navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"];
      const loaded = [];
      for (const l of localeCandidates(prefs, def)) {
        const t = await this.vfs.text(`_locales/${l}/messages.json`);
        if (t) {
          try {
            loaded.push(parseJSONC(t));
          } catch (e) {
            this.log.warn(`Invalid _locales/${l}/messages.json:`, e.message);
          }
        }
      }
      this.messages = mergeMessages(loaded);
    }
    getMessage(name, subs) {
      return formatMessage(this.messages, name, subs, {
        "@@extension_id": this.id,
        "@@ui_locale": this.uiLocale,
        ...bidiInfo(this.uiLocale)
      });
    }
    // ------------------------------------------------------------------ URLs & resources
    virtualUrl(path) {
      return this.baseUrl + String(path || "").replace(/^\/+/, "");
    }
    /** chrome.runtime.getURL: a URL the page can actually load. */
    getURL(path) {
      path = String(path ?? "");
      const m = /^([^?#]*)(.*)$/.exec(path);
      const p = normalizePath(m[1]);
      const suffix = m[2];
      if (!p) return this.baseUrl + suffix.replace(/^\?/, "?");
      if (this.vfs.kind === "http") return this.vfs.url(p) + suffix;
      if (this.vfs.has(p) && !/\.html?$/i.test(p) && !suffix.startsWith("?")) return this.vfs.url(p) + suffix;
      return this.virtualUrl(p) + suffix;
    }
    /** Map a URL (virtual, blob, http, or relative to an extension page) to an extension path. */
    resolvePath(url, fromPath = null) {
      if (url == null) return null;
      url = String(url).trim();
      if (!url) return null;
      if (url.startsWith(this.baseUrl)) return this._decode(url.slice(this.baseUrl.length));
      const m = /^(?:chrome|moz|ms-browser|safari-web)-extension:\/\/([^/]+)\/?(.*)$/i.exec(url);
      if (m) return m[1] === this.id || m[1] === "__MSG_@@extension_id__" ? this._decode(m[2]) : null;
      if (url.startsWith("blob:")) return this.vfs.pathForBlobUrl(url);
      if (this.vfs.kind === "http") {
        try {
          const p = this.vfs.pathForHttpUrl(new URL(url, fromPath != null ? this.vfs.base + fromPath : location.href).href);
          if (p != null) return p;
        } catch {
        }
      }
      if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) return null;
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
      if (css == null) return "";
      if (css.includes("__MSG_")) css = replaceMsgTokens(css, (n) => this.getMessage(n));
      return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (all, q, u) => {
        if (/^(data|blob|https?|about):/i.test(u) || u.startsWith("#")) return all;
        const p = this.resolvePath(u, path);
        if (p == null || p === path || !this.vfs.has(p)) return all;
        return `url("${this.resourceUrl(p)}")`;
      });
    }
    /** CSS text with imported extension stylesheets inlined (constructable stylesheets reject CSS imports). */
    async cssText(path, seen = /* @__PURE__ */ new Set()) {
      if (seen.has(path)) return "";
      seen.add(path);
      const raw = await this.vfs.text(path);
      if (raw == null) return "";
      let css = this.transformCss(path, raw);
      const imports = [];
      css = css.replace(/@import\s+(?:url\()?\s*(['"]?)([^'")\s;]+)\1\s*\)?([^;]*);/g, (all, q, u, media) => {
        const p = this.resolvePath(u, path) ?? this.vfs.pathForBlobUrl(u);
        if (p == null) return all;
        imports.push([p, media.trim()]);
        return "";
      });
      let pre = "";
      for (const [p, media] of imports) {
        const t = await this.cssText(p, seen);
        pre += media ? `@media ${media}{${t}}
` : t + "\n";
      }
      return pre + css;
    }
    /** Get a runnable unit for a classic script (precompiled in bundles, compiled on the fly otherwise). */
    async unit(path, { module = false } = {}) {
      const key = module ? "module:" + path : path;
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
        if (!c.alive || !includeContent && !c.isExtensionPage || only && !only(c) || c === exclude) continue;
        const ev = c.events.get(key);
        if (!ev || !ev.hasListeners()) continue;
        const a = typeof args === "function" ? args() : args;
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
      for (const c of this.contexts) {
        const e = c.events.get(key);
        if (c.alive && e && e.hasListeners()) return true;
      }
      return false;
    }
    views(filter = {}) {
      return [...this.contexts].filter((c) => c.alive && c.isExtensionPage && c.win && c.type !== "offscreen" && (!filter.type || c.type === filter.type || filter.type === "tab" && c.type === "options" || filter.type === "popup" && c.type === "popup") && (filter.tabId == null || c.tabId === filter.tabId));
    }
    // ------------------------------------------------------------------ tabs
    pageTab() {
      return this.shim.pageTab();
    }
    overlayTab(tabId) {
      const o = this.overlays.get(tabId);
      if (!o) return null;
      return {
        id: tabId,
        index: 1,
        windowId: this.shim.windowId,
        highlighted: false,
        active: false,
        pinned: false,
        audible: false,
        discarded: false,
        autoDiscardable: true,
        mutedInfo: { muted: false },
        incognito: false,
        selected: false,
        status: "complete",
        url: o.url,
        title: o.title || this.name,
        groupId: groupIdOf(this.shim, tabId),
        splitViewId: splitIdOf(this.shim, tabId),
        width: innerWidth,
        height: innerHeight
      };
    }
    /** Open an extension page as an overlay "tab". */
    async openTab(url, { kind = "tab", title = "", width, height } = {}) {
      const path = this.resolvePath(url, "") ?? normalizePath(url);
      const tabId = this.shim.nextTabId();
      const q = /\?[^#]*/.exec(url);
      const h = /#.*/.exec(url);
      const panel = this.shim.ui.openPanel(this, kind, {
        title: title || this.name,
        width,
        height,
        onClose: () => {
          const tab = this.overlayTab(tabId);
          this.overlays.delete(tabId);
          if (o.ctx) o.ctx.destroy();
          this.dispatch("tabs.onRemoved", [tabId, { windowId: this.shim.windowId, isWindowClosing: false }]);
          if (tab && features.noteClosedTab) features.noteClosedTab(this, tab);
        }
      });
      const o = { panel, url: this.virtualUrl(path) + (q ? q[0] : "") + (h ? h[0] : ""), ctx: null, title };
      this.overlays.set(tabId, o);
      o.ctx = await renderPage(this, {
        type: kind === "side" ? "sidepanel" : "tab",
        iframe: panel.iframe,
        path,
        search: q ? q[0] : "",
        hash: h ? h[0] : "",
        tabId,
        onClose: () => panel.close(),
        onTitle: (t) => {
          o.title = t;
          panel.setTitle(t || this.name);
        },
        onNavigate: (u) => {
          o.url = u;
        }
      });
      this.dispatch("tabs.onCreated", () => [this.overlayTab(tabId)]);
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
      const popup = st.get("popup");
      const enabled = st.get("enabled");
      if (!enabled) return;
      if (popup) return this.togglePopup(popup);
      const sp = this.state.sidePanel;
      if (sp && sp.behavior.openPanelOnActionClick) return this.openSidePanel();
      this.dispatch("action.onClicked", () => [this.pageTab()]);
      this.dispatch("browserAction.onClicked", () => [this.pageTab()]);
      this.dispatch("pageAction.onClicked", () => [this.pageTab()]);
    }
    async togglePopup(popupPath, { forceOpen = false } = {}) {
      if (this.popup) {
        if (forceOpen) return;
        this.popup.panel.close();
        return;
      }
      const path = this.resolvePath(popupPath, "") ?? normalizePath(popupPath);
      const panel = this.shim.ui.openPanel(this, "popup", {
        anchor: this.launcher,
        onClose: () => {
          if (this.popup && this.popup.panel === panel) {
            const c = this.popup.ctx;
            this.popup = null;
            if (c) c.destroy();
          }
        }
      });
      this.popup = { panel, ctx: null };
      const ctx = await renderPage(this, {
        type: "popup",
        iframe: panel.iframe,
        path,
        onClose: () => panel.close(),
        onResize: (w, h) => panel.resize(w, h)
      });
      if (this.popup && this.popup.panel === panel) this.popup.ctx = ctx;
      else ctx.destroy();
    }
    async openOptions() {
      const o = getOptionsPage(this.localized);
      if (!o) throw new Error("Could not create an options page.");
      for (const [tabId, ov] of this.overlays) {
        if (this.resolvePath(ov.url) === o.path) {
          ov.panel.focus();
          return tabId;
        }
      }
      await this.openTab(this.virtualUrl(o.path), { kind: o.openInTab ? "tab" : "dialog", title: this.name + " \u2014 Options" });
    }
    async openDevTools() {
      if (features.openDevTools) return features.openDevTools(this);
      this.log.warn("DevTools support is not included in this build.");
    }
    openOmnibox() {
      if (!this.manifest.omnibox) return;
      this.shared("omnibox", () => new OmniboxState(this)).open();
    }
    async openSidePanel(path) {
      const sp = this.state.sidePanel;
      path = path || sp && sp.options.path || getSidePanel(this.localized);
      if (!path) throw new Error("No side panel is configured.");
      for (const [, ov] of this.overlays) if (ov.panel.kind === "side") {
        ov.panel.close();
      }
      return this.openTab(this.virtualUrl(path), { kind: "side", title: this.name });
    }
  };

  // src/runtime/ui.js
  var CSS2 = `
:host{all:initial!important;position:fixed!important;top:0!important;left:0!important;width:0!important;height:0!important;z-index:2147483647!important;display:block!important;contain:none!important}
*{box-sizing:border-box}
.root{--bg:#fff;--fg:#1f1f1f;--mut:#5f6368;--bd:rgba(0,0,0,.14);--hl:rgba(26,115,232,.1);--acc:#1a73e8;--sh:0 8px 28px rgba(0,0,0,.22),0 2px 6px rgba(0,0,0,.12);font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg)}
@media (prefers-color-scheme:dark){.root{--bg:#292a2d;--fg:#e8eaed;--mut:#9aa0a6;--bd:rgba(255,255,255,.16);--hl:rgba(138,180,248,.16);--acc:#8ab4f8;--sh:0 8px 28px rgba(0,0,0,.6)}}
.dock{position:fixed;display:flex;flex-direction:column;gap:6px;padding:5px;border-radius:14px;background:var(--bg);box-shadow:var(--sh);border:1px solid var(--bd);touch-action:none;user-select:none;-webkit-user-select:none}
.dock.h{flex-direction:row}
.dock[hidden]{display:none}
.btn{position:relative;width:34px;height:34px;border:0;border-radius:9px;background:transparent;padding:5px;cursor:pointer;display:grid;place-items:center;color:var(--fg);outline:none}
.btn:hover,.btn.active{background:var(--hl)}
.btn:focus-visible{box-shadow:0 0 0 2px var(--acc)}
.btn.disabled{opacity:.45;filter:grayscale(1)}
.btn canvas,.btn img{width:24px;height:24px;display:block;image-rendering:auto;pointer-events:none}
.letter{width:24px;height:24px;border-radius:6px;display:grid;place-items:center;font-weight:600;font-size:13px;color:#fff;pointer-events:none}
.badge{position:absolute;right:-2px;bottom:-1px;min-width:16px;height:14px;padding:0 3px;border-radius:4px;font:600 9.5px/14px system-ui,sans-serif;text-align:center;color:#fff;background:#d93025;pointer-events:none;white-space:nowrap;box-shadow:0 0 0 1.5px var(--bg)}
.badge:empty{display:none}
.panel{position:fixed;background:var(--bg);color:var(--fg);box-shadow:var(--sh);border:1px solid var(--bd);display:flex;flex-direction:column;overflow:hidden;animation:pop .12s ease-out}
@keyframes pop{from{opacity:0;transform:translateY(4px) scale(.98)}}
.panel iframe{border:0;display:block;flex:1;min-height:0;width:100%;background:#fff;color-scheme:normal}
.popup{border-radius:10px}
.popup iframe{flex:none;width:100%;height:100%;visibility:hidden}
.popup.ready iframe{visibility:visible}
.bar{display:flex;align-items:center;gap:8px;padding:0 6px 0 12px;height:38px;border-bottom:1px solid var(--bd);flex:none;cursor:default}
.bar .t{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar img,.bar canvas{width:16px;height:16px}
.x{width:28px;height:28px;border:0;border-radius:7px;background:transparent;color:var(--mut);cursor:pointer;font:18px/1 system-ui,sans-serif;display:grid;place-items:center}
.x:hover{background:var(--hl);color:var(--fg)}
.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);animation:fade .15s}
@keyframes fade{from{opacity:0}}
.tab{inset:3vh 3vw;border-radius:12px}
.dialog{top:7vh;left:50%;transform:translateX(-50%);width:min(760px,94vw);height:min(80vh,720px);border-radius:12px}
.side{top:0;right:0;bottom:0;width:380px;border-radius:0;border-width:0 0 0 1px;animation:slide .16s ease-out}
@keyframes slide{from{transform:translateX(30px);opacity:0}}
.side .grip{position:absolute;left:-3px;top:0;bottom:0;width:6px;cursor:ew-resize}
.window{border-radius:10px;min-width:200px;min-height:120px;resize:both}
.window .bar{cursor:move}
.menu{position:fixed;min-width:220px;max-width:340px;padding:5px 0;background:var(--bg);color:var(--fg);border:1px solid var(--bd);border-radius:9px;box-shadow:var(--sh);animation:pop .08s}
.mi{display:flex;align-items:center;gap:8px;padding:6px 12px 6px 10px;cursor:default;white-space:nowrap;position:relative}
.mi .c{width:16px;flex:none;text-align:center;color:var(--acc);font-size:12px}
.mi .l{flex:1;overflow:hidden;text-overflow:ellipsis}
.mi .s{color:var(--mut)}
.mi:hover:not(.dis){background:var(--hl)}
.mi.dis{color:var(--mut)}
.mi.head{color:var(--mut);font-size:11.5px;font-weight:600;padding-top:7px;gap:6px}
.mi.head img,.mi.head canvas{width:14px;height:14px}
.sep{height:1px;margin:5px 0;background:var(--bd)}
.toasts{position:fixed;top:12px;right:12px;display:flex;flex-direction:column;gap:8px;width:min(360px,calc(100vw - 24px))}
.toast{display:flex;gap:10px;padding:12px;background:var(--bg);color:var(--fg);border:1px solid var(--bd);border-radius:10px;box-shadow:var(--sh);cursor:pointer;animation:slide .18s ease-out}
.toast .ic{width:40px;height:40px;flex:none;border-radius:6px;object-fit:contain}
.toast .bd{flex:1;min-width:0}
.toast .app{font-size:11px;color:var(--mut);margin-bottom:2px;display:flex;justify-content:space-between;gap:8px}
.toast .ti{font-weight:600;margin-bottom:2px;word-wrap:break-word}
.toast .ms{color:var(--fg);opacity:.85;word-wrap:break-word;white-space:pre-wrap}
.toast .cm{font-size:11.5px;color:var(--mut);margin-top:3px}
.toast .im{width:100%;margin-top:8px;border-radius:6px}
.toast .pg{height:4px;background:var(--bd);border-radius:2px;margin-top:8px;overflow:hidden}
.toast .pg i{display:block;height:100%;background:var(--acc)}
.toast .bt{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.toast .bt button{border:1px solid var(--bd);background:transparent;color:var(--acc);border-radius:6px;padding:4px 10px;font:500 12px system-ui,sans-serif;cursor:pointer}
.toast .bt button:hover{background:var(--hl)}
.toast .x{width:20px;height:20px;font-size:15px;margin:-4px -4px 0 0}
.pal{position:fixed;top:12vh;left:50%;transform:translateX(-50%);width:min(640px,92vw);background:var(--bg);color:var(--fg);border:1px solid var(--bd);border-radius:12px;box-shadow:var(--sh);overflow:hidden;animation:pop .1s}
.pal .in{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--bd)}
.pal .kw{flex:none;padding:2px 8px;border-radius:6px;background:var(--hl);color:var(--acc);font-weight:600;font-size:12px}
.pal input{flex:1;border:0;outline:0;background:transparent;color:var(--fg);font:15px system-ui,sans-serif}
.pal .sg{max-height:50vh;overflow:auto}
.pal .it{padding:7px 14px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pal .it.on{background:var(--hl)}
.pal .it .m{font-weight:700}.pal .it .d{color:var(--mut)}.pal .it .u{color:var(--acc)}
.drawer{left:0;right:0;bottom:0;height:42vh;border-radius:12px 12px 0 0;border-width:1px 0 0}
.drawer .tabs{display:flex;gap:2px;flex:1;min-width:0;overflow:auto}
.drawer .tabs button{border:0;background:transparent;color:var(--mut);font:500 12.5px system-ui,sans-serif;padding:6px 10px;border-radius:7px;cursor:pointer;white-space:nowrap}
.drawer .tabs button.on{background:var(--hl);color:var(--fg)}
.drawer .tool{border:1px solid var(--bd);background:transparent;color:var(--fg);font:12px system-ui,sans-serif;padding:4px 9px;border-radius:7px;cursor:pointer}
.drawer .tool.on{background:var(--acc);color:#fff;border-color:var(--acc)}
.drawer .body{flex:1;position:relative;min-height:0}
.drawer .body>iframe,.drawer .body>pre{position:absolute;inset:0;width:100%;height:100%;margin:0}
.drawer .body>pre{overflow:auto;padding:10px 12px;font:12px/1.5 ui-monospace,Menlo,monospace;background:var(--bg);color:var(--fg);white-space:pre-wrap}
.drawer .empty{padding:20px;color:var(--mut)}
.drawer .vgrip{position:absolute;left:0;right:0;top:-3px;height:6px;cursor:ns-resize}
.pick{position:fixed;pointer-events:none;background:rgba(26,115,232,.18);outline:2px solid #1a73e8;z-index:1}
.banner{position:fixed;top:0;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:7px 8px 7px 14px;background:#fef7e0;color:#3c4043;border:1px solid #f9d978;border-top:0;border-radius:0 0 10px 10px;box-shadow:var(--sh);font:13px system-ui,sans-serif}
.banner button{border:1px solid #dadce0;background:#fff;border-radius:6px;padding:3px 10px;cursor:pointer;font:13px system-ui,sans-serif}
.hidden{position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none}
.hidden iframe{width:800px;height:600px;border:0}
`;
  var COLORS2 = ["#1a73e8", "#d93025", "#188038", "#e37400", "#9334e6", "#007b83", "#c5221f", "#3c4043"];
  function el(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids) if (k != null) e.append(k);
    return e;
  }
  async function renderIcon(ext, holder, icon, size = 24) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const px = Math.round(size * dpr);
    const put = (node) => {
      holder.textContent = "";
      holder.append(node);
    };
    const letter = () => {
      const n = (ext.name || "?").trim();
      let hsh = 0;
      for (const c of ext.id) hsh = hsh * 31 + c.charCodeAt(0) | 0;
      const d = el("div", { class: "letter", text: (n[0] || "?").toUpperCase() });
      d.style.background = COLORS2[Math.abs(hsh) % COLORS2.length];
      put(d);
    };
    try {
      if (icon && icon.imageData) {
        const id = icon.imageData;
        const src = document.createElement("canvas");
        src.width = id.width;
        src.height = id.height;
        src.getContext("2d").putImageData(id, 0, 0);
        const c2 = document.createElement("canvas");
        c2.width = c2.height = px;
        c2.getContext("2d").drawImage(src, 0, 0, px, px);
        put(c2);
        return;
      }
      const path = icon && icon.path ? pickIcon(icon.path, px) : ext.iconPath(px);
      if (!path) return letter();
      const blob = await ext.vfs.blob(path);
      if (!blob) return letter();
      if (/svg/.test(blob.type) || typeof createImageBitmap !== "function") {
        const img = el("img", { alt: "" });
        img.onerror = letter;
        img.src = ext.resourceUrl(path);
        put(img);
        return;
      }
      const bmp = await createImageBitmap(blob);
      const c = document.createElement("canvas");
      c.width = c.height = px;
      const g = c.getContext("2d");
      const s = Math.min(px / bmp.width, px / bmp.height);
      g.imageSmoothingQuality = "high";
      g.drawImage(bmp, (px - bmp.width * s) / 2, (px - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
      put(c);
    } catch {
      letter();
    }
  }
  function readableOn(rgba) {
    const [r, g, b] = rgba || [0, 0, 0];
    return (r * 299 + g * 587 + b * 114) / 1e3 > 150 ? "#000" : "#fff";
  }
  var UI = class {
    constructor(shim) {
      this.shim = shim;
      this.providers = /* @__PURE__ */ new Map();
      this.panels = /* @__PURE__ */ new Set();
      this.lastContextTarget = null;
      this.host = null;
    }
    ensure() {
      if (this.host && this.host.isConnected) return;
      if (!this.host) {
        this.host = document.createElement("extshim-root");
        this.host.setAttribute("data-extshim", "");
        this.shadow = this.host.attachShadow({ mode: "closed" });
        adoptCss(this.shadow, window, [{ css: CSS2 }]);
        this.root = el("div", { class: "root" });
        this.dock = el("div", { class: "dock", role: "toolbar", "aria-label": "Extensions" });
        this.layer = el("div");
        this.toastBox = el("div", { class: "toasts", "aria-live": "polite" });
        this.hiddenBox = el("div", { class: "hidden", "aria-hidden": "true" });
        this.root.append(this.hiddenBox, this.layer, this.dock, this.toastBox);
        this.shadow.append(this.root);
        this._placeDock();
        this._wire();
      }
      (document.documentElement || document).appendChild(this.host);
      if (!this._keeper && document.documentElement) {
        this._keeper = new MutationObserver(() => {
          if (!this.host.isConnected && document.documentElement) document.documentElement.appendChild(this.host);
        });
        this._keeper.observe(document.documentElement, { childList: true });
      }
    }
    _placeDock() {
      let pos = null;
      try {
        pos = JSON.parse(localStorage.getItem("extshim:dock") || "null");
      } catch {
      }
      const s = this.dock.style;
      s.right = "";
      s.left = "";
      s.top = "";
      s.bottom = "";
      if (pos && typeof pos.x === "number") {
        s.left = Math.max(4, Math.min(innerWidth - 50, pos.x)) + "px";
        s.top = Math.max(4, Math.min(innerHeight - 50, pos.y)) + "px";
      } else {
        const p = this.shim.defaultPosition || "bottom-right";
        if (p.includes("top")) s.top = "16px";
        else s.bottom = "16px";
        if (p.includes("left")) s.left = "16px";
        else s.right = "16px";
      }
    }
    _wire() {
      let drag = null;
      this.dock.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        const r = this.dock.getBoundingClientRect();
        drag = { x: e.clientX, y: e.clientY, ox: r.left, oy: r.top, moved: false, id: e.pointerId };
      });
      window.addEventListener("pointermove", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) < 5) return;
        if (!drag.moved) {
          drag.moved = true;
          try {
            this.dock.setPointerCapture(drag.id);
          } catch {
          }
        }
        const s = this.dock.style;
        s.right = "";
        s.bottom = "";
        s.left = Math.max(0, Math.min(innerWidth - 44, drag.ox + dx)) + "px";
        s.top = Math.max(0, Math.min(innerHeight - 44, drag.oy + dy)) + "px";
      }, true);
      window.addEventListener("pointerup", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        if (drag.moved) {
          this._suppressClick = true;
          setTimeout(() => {
            this._suppressClick = false;
          }, 0);
          const r = this.dock.getBoundingClientRect();
          try {
            localStorage.setItem("extshim:dock", JSON.stringify({ x: r.left, y: r.top }));
          } catch {
          }
        }
        drag = null;
      }, true);
      document.addEventListener("pointerdown", (e) => {
        if (e.composedPath().includes(this.host)) return;
        this.closeMenu();
        for (const p of [...this.panels]) if (p.kind === "popup") p.close();
      }, true);
      window.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (this.menu) {
          this.closeMenu();
          return;
        }
        for (const p of [...this.panels]) if (p.kind === "popup") p.close();
      }, true);
      window.addEventListener("blur", () => this.closeMenu());
      window.addEventListener("contextmenu", (e) => {
        if (e.composedPath().includes(this.host)) {
          e.preventDefault();
          return;
        }
        const mod = this.shim.contextMenuModifier || "altKey";
        if (mod === "none" || !this.providers.size) return;
        if (mod !== "always" && !e[mod]) return;
        const info = this._contextInfo(e);
        const groups = [...this.providers.values()].map((fn) => fn(info)).filter((g) => g.items.length);
        if (!groups.length) return;
        e.preventDefault();
        e.stopPropagation();
        this.lastContextTarget = e.target;
        this.showMenu(groups, e.clientX, e.clientY);
      }, true);
    }
    _contextInfo(e) {
      const t = e.target instanceof Element ? e.target : null;
      const sel = String(window.getSelection ? window.getSelection() : "").trim();
      const contexts = [];
      const info = { pageUrl: location.href, frameUrl: location.href, contexts, editable: false };
      if (sel) {
        contexts.push("selection");
        info.selectionText = sel;
      }
      const a = t && t.closest("a[href]");
      if (a) {
        contexts.push("link");
        info.linkUrl = a.href;
        info.linkText = a.textContent.trim();
      }
      const media = t && t.closest("img,video,audio");
      if (media) {
        const type = media.localName === "img" ? "image" : media.localName;
        contexts.push(type);
        info.mediaType = type;
        info.srcUrl = media.currentSrc || media.src;
      }
      if (t && (t.isContentEditable || /^(input|textarea)$/i.test(t.localName))) {
        contexts.push("editable");
        info.editable = true;
      }
      if (window !== window.top) contexts.push("frame");
      if (!contexts.length || contexts.length === 1 && contexts[0] === "frame") contexts.push("page");
      return info;
    }
    registerMenuProvider(ext, fn) {
      this.providers.set(ext, fn);
      return () => this.providers.delete(ext);
    }
    // ---------------------------------------------------------------- launchers
    addExtension(ext) {
      this.ensure();
      if (ext.options.ui && ext.options.ui.position) this.shim.defaultPosition = ext.options.ui.position;
      const iconBox = el("span");
      const badge = el("span", { class: "badge" });
      const btn = el("button", { class: "btn", type: "button", title: ext.name, "aria-label": ext.name }, iconBox, badge);
      const visible = ext.options.ui.launcher !== false;
      if (!visible) btn.hidden = true;
      this.dock.append(btn);
      this.dock.hidden = ![...this.dock.children].some((b) => !b.hidden);
      let lastIcon;
      const L = {
        btn,
        rect: () => btn.getBoundingClientRect(),
        update: (s) => {
          btn.title = s.title || ext.name;
          btn.setAttribute("aria-label", btn.title);
          badge.textContent = (s.badgeText || "").slice(0, 4);
          badge.style.background = rgbaToCss(s.badgeBg || [217, 48, 37, 255]);
          badge.style.color = s.badgeFg ? rgbaToCss(s.badgeFg) : readableOn(s.badgeBg);
          btn.classList.toggle("disabled", s.enabled === false);
          const key = s.icon && s.icon.imageData ? s.icon.imageData : JSON.stringify(s.icon || null);
          if (key !== lastIcon) {
            lastIcon = key;
            renderIcon(ext, iconBox, s.icon);
          }
        },
        setActive: (on) => btn.classList.toggle("active", !!on),
        setVisible: (on) => {
          btn.hidden = !on;
          this.dock.hidden = ![...this.dock.children].some((b) => !b.hidden);
        },
        remove: () => {
          btn.remove();
          this.dock.hidden = ![...this.dock.children].some((b) => !b.hidden);
          this.providers.delete(ext);
        }
      };
      renderIcon(ext, iconBox, null);
      btn.addEventListener("click", () => {
        if (!this._suppressClick) ext.clickAction();
      });
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = btn.getBoundingClientRect();
        this.showMenu([this._launcherMenu(ext)], r.left, r.top, { anchor: r });
      });
      return L;
    }
    _launcherMenu(ext) {
      const items = [];
      const p = this.providers.get(ext);
      if (p) {
        const g = p({ pageUrl: location.href, contexts: ext.mv === 3 ? ["action"] : ["browser_action", "page_action"], editable: false });
        if (g.items.length) items.push(...g.items, { type: "separator" });
      }
      const opt = ext.localized.options_ui || ext.localized.options_page;
      if (opt) items.push({ label: "Options", onClick: () => ext.openOptions().catch((e) => ext.log.error(e)) });
      if (ext.manifest.devtools_page) items.push({ label: "DevTools panels", onClick: () => ext.openDevTools() });
      if (ext.state.commands && ext.state.commands.list.some((c) => c.sc)) items.push({ label: "Keyboard shortcuts", onClick: () => this.shortcuts(ext) });
      if ((ext.manifest.permissions || []).includes("bookmarks") && ext.features && ext.features.importBookmarks) items.push({ label: "Import bookmarks\u2026", onClick: () => this._importBookmarks(ext) });
      if (ext.manifest.omnibox) items.push({ label: `Omnibox: ${ext.manifest.omnibox.keyword}`, onClick: () => ext.openOmnibox() });
      if (ext.localized.side_panel || ext.localized.sidebar_action) items.push({ label: "Open side panel", onClick: () => ext.openSidePanel().catch((e) => ext.log.error(e)) });
      items.push(
        { label: "Reload extension", onClick: () => ext.reload() },
        { label: "Export storage\u2026", onClick: () => this._export(ext) },
        { label: "Import storage\u2026", onClick: () => this._import(ext) },
        { type: "separator" },
        { label: "Hide launcher", sub: "run again to show", onClick: () => ext.launcher.setVisible(false) },
        { label: "Remove from this page", onClick: () => ext.stop() }
      );
      return { title: `${ext.name}${ext.manifest.version ? " " + ext.manifest.version : ""}`, icon: ext.iconPath(16), ext, items };
    }
    /** Read-only list of the extension's keyboard shortcuts (also commands.openShortcutSettings). */
    shortcuts(ext) {
      const list = ext.state.commands && ext.state.commands.list || [];
      const items = list.map((c) => ({ label: `${c.description || c.name.replace(/^_execute_\w+$/, "Activate the extension")}`, sub: c.text || "not set", onClick: () => ext.state.commands.trigger(c.name) }));
      const r = ext.launcher ? ext.launcher.rect() : { left: innerWidth / 2, top: innerHeight / 3 };
      this.showMenu([{ title: `${ext.name} \u2014 keyboard shortcuts`, ext, items: items.length ? items : [{ label: "No shortcuts", enabled: false }] }], r.left, r.top, { anchor: r });
    }
    _importBookmarks(ext) {
      const input = el("input", { type: "file", accept: ".html,.htm,text/html" });
      input.style.display = "none";
      input.addEventListener("change", async () => {
        const f = input.files && input.files[0];
        input.remove();
        if (f) {
          try {
            ext.features.importBookmarks(ext, await f.text());
            ext.log.info("Bookmarks imported.");
          } catch (e) {
            ext.log.error("Bookmark import failed:", e);
          }
        }
      });
      this.root.append(input);
      input.click();
    }
    async _export(ext) {
      const data = await ext.storage.exportAll();
      const a = el("a", { download: `${(ext.name || "extension").replace(/[^\w.-]+/g, "_")}-storage.json` });
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      this.root.append(a);
      a.click();
      a.remove();
    }
    _import(ext) {
      const input = el("input", { type: "file", accept: "application/json,.json" });
      input.style.display = "none";
      input.addEventListener("change", async () => {
        const f = input.files && input.files[0];
        input.remove();
        if (!f) return;
        try {
          await ext.storage.importAll(JSON.parse(await f.text()));
          ext.log.info("Storage imported.");
        } catch (e) {
          ext.log.error("Import failed:", e);
        }
      });
      this.root.append(input);
      input.click();
    }
    hiddenFrame(ext, kind) {
      this.ensure();
      const f = el("iframe", { "data-extshim": kind, title: `${ext.name} (${kind})`, tabindex: "-1" });
      this.hiddenBox.append(f);
      return f;
    }
    // ---------------------------------------------------------------- panels
    openPanel(ext, kind, { title = "", anchor = null, width, height, onClose } = {}) {
      this.ensure();
      const iframe = el("iframe", { "data-extshim": kind, title: title || ext.name, allow: "clipboard-read; clipboard-write; microphone; camera; geolocation; fullscreen" });
      const box = el("div", { class: `panel ${kind === "popup" ? "popup" : kind}`, role: kind === "popup" ? "dialog" : "region", "aria-label": title || ext.name });
      let backdrop = null;
      let closed = false;
      const titleEl = el("span", { class: "t", text: title || ext.name });
      const panel = {
        kind,
        iframe,
        el: box,
        close: () => {
          if (closed) return;
          closed = true;
          box.remove();
          if (backdrop) backdrop.remove();
          this.panels.delete(panel);
          if (kind === "popup" && ext.launcher) ext.launcher.setActive(false);
          if (kind === "side") this._sideInset(0);
          if (onClose) {
            try {
              onClose();
            } catch (e) {
              ext.log.error(e);
            }
          }
        },
        setTitle: (t) => {
          titleEl.textContent = t || ext.name;
          iframe.title = t || ext.name;
        },
        resize: (w, h) => {
          if (kind !== "popup") return;
          box.style.width = w + 2 + "px";
          box.style.height = h + 2 + "px";
          box.classList.add("ready");
          this._anchorPopup(box, anchor, w + 2, h + 2);
        },
        focus: () => {
          this.layer.append(box);
          try {
            iframe.contentWindow.focus();
          } catch {
          }
        }
      };
      if (kind === "popup") {
        for (const p of [...this.panels]) if (p.kind === "popup") p.close();
        box.style.width = "802px";
        box.style.height = "27px";
        box.append(iframe);
        this._anchorPopup(box, anchor, 802, 27);
        if (ext.launcher) ext.launcher.setActive(true);
      } else {
        const icon = el("span");
        renderIcon(ext, icon, null, 16);
        const bar = el("div", { class: "bar" }, icon, titleEl, el("button", { class: "x", type: "button", title: "Close", "aria-label": "Close", text: "\xD7", onclick: () => panel.close() }));
        box.append(bar, iframe);
        if (kind === "tab" || kind === "dialog") {
          backdrop = el("div", { class: "backdrop" });
          backdrop.addEventListener("click", () => panel.close());
          this.layer.append(backdrop);
        }
        if (kind === "side") {
          for (const p of [...this.panels]) if (p.kind === "side") p.close();
          const grip = el("div", { class: "grip" });
          this._sideInset(380);
          grip.addEventListener("pointerdown", (e) => {
            grip.setPointerCapture(e.pointerId);
            const move = (ev) => {
              const w = Math.max(240, Math.min(innerWidth - 40, innerWidth - ev.clientX));
              box.style.width = w + "px";
              this._sideInset(w);
            };
            const up = () => {
              grip.removeEventListener("pointermove", move);
              grip.removeEventListener("pointerup", up);
            };
            grip.addEventListener("pointermove", move);
            grip.addEventListener("pointerup", up);
          });
          box.append(grip);
        }
        if (kind === "window") {
          box.style.width = (width || 600) + "px";
          box.style.height = (height || 480) + 38 + "px";
          box.style.left = Math.max(10, (innerWidth - (width || 600)) / 2) + "px";
          box.style.top = Math.max(10, (innerHeight - (height || 480)) / 3) + "px";
          let d = null;
          bar.addEventListener("pointerdown", (e) => {
            if (e.target.closest(".x")) return;
            bar.setPointerCapture(e.pointerId);
            const r = box.getBoundingClientRect();
            d = { x: e.clientX - r.left, y: e.clientY - r.top };
            iframe.style.pointerEvents = "none";
          });
          bar.addEventListener("pointermove", (e) => {
            if (!d) return;
            box.style.left = e.clientX - d.x + "px";
            box.style.top = Math.max(0, e.clientY - d.y) + "px";
          });
          bar.addEventListener("pointerup", () => {
            d = null;
            iframe.style.pointerEvents = "";
          });
        }
      }
      this.layer.append(box);
      this.panels.add(panel);
      return panel;
    }
    /** Keep toasts and a right-docked launcher clear of an open side panel. */
    _sideInset(px) {
      this.toastBox.style.right = 12 + px + "px";
      const d = this.dock.style;
      if (px && d.left === "") {
        this._dockShift = true;
        d.right = 16 + px + "px";
      } else if (!px && this._dockShift) {
        this._dockShift = false;
        d.right = "16px";
      }
    }
    _anchorPopup(box, anchor, w, h) {
      const r = anchor && anchor.rect ? anchor.rect() : { left: innerWidth - 60, right: innerWidth - 16, top: innerHeight - 60, bottom: innerHeight - 16 };
      const d = this.dock.getBoundingClientRect();
      let left, top;
      const roomLeft = d.left, roomRight = innerWidth - d.right;
      if (roomLeft >= w + 8 || roomLeft >= roomRight) left = d.left - w - 8;
      else left = d.right + 8;
      top = r.bottom - h;
      if (top < 8) top = Math.min(innerHeight - h - 8, r.top);
      box.style.left = Math.max(8, Math.min(innerWidth - w - 8, left)) + "px";
      box.style.top = Math.max(8, Math.min(innerHeight - h - 8, top)) + "px";
    }
    // ---------------------------------------------------------------- menus
    closeMenu() {
      if (this.menu) {
        this.menu.forEach((m) => m.remove());
        this.menu = null;
      }
    }
    showMenu(groups, x, y, { anchor = null } = {}) {
      this.closeMenu();
      this.menu = [];
      const build = (items, level) => {
        const m2 = el("div", { class: "menu", role: "menu" });
        for (const it of items) {
          if (it.type === "separator") {
            m2.append(el("div", { class: "sep" }));
            continue;
          }
          if (it.header) {
            const ic = el("span");
            if (it.ext) renderIcon(it.ext, ic, null, 14);
            m2.append(el("div", { class: "mi head" }, ic, el("span", { class: "l", text: it.label })));
            continue;
          }
          const check = it.type === "checkbox" || it.type === "radio" ? it.checked ? it.type === "radio" ? "\u25CF" : "\u2713" : "" : "";
          const row = el(
            "div",
            { class: "mi" + (it.enabled === false ? " dis" : ""), role: "menuitem", tabindex: "-1" },
            el("span", { class: "c", text: check }),
            el("span", { class: "l", text: it.label }),
            it.children && it.children.length ? el("span", { class: "s", text: "\u203A" }) : it.sub ? el("span", { class: "s", text: it.sub }) : null
          );
          if (it.enabled !== false) {
            if (it.children && it.children.length) {
              row.addEventListener("mouseenter", () => {
                this.menu.slice(level + 1).forEach((n) => n.remove());
                this.menu.length = level + 1;
                const r = row.getBoundingClientRect();
                const sub = build(it.children, level + 1);
                this._placeMenu(sub, r.right - 4, r.top - 5, r);
              });
            } else {
              row.addEventListener("mouseenter", () => {
                this.menu.slice(level + 1).forEach((n) => n.remove());
                this.menu.length = level + 1;
              });
              row.addEventListener("click", () => {
                this.closeMenu();
                try {
                  it.onClick();
                } catch (e) {
                  console.error(e);
                }
              });
            }
          }
          m2.append(row);
        }
        this.root.append(m2);
        this.menu.push(m2);
        return m2;
      };
      const flat = [];
      groups.forEach((g, i) => {
        if (i) flat.push({ type: "separator" });
        if (groups.length > 1 || g.ext || g.title) flat.push({ header: true, label: g.title, ext: g.ext });
        flat.push(...g.items);
      });
      const m = build(flat, 0);
      this._placeMenu(m, x, y, anchor);
    }
    _placeMenu(m, x, y, anchor) {
      const r = m.getBoundingClientRect();
      let left = x, top = y;
      if (left + r.width > innerWidth - 4) left = anchor ? anchor.left - r.width : innerWidth - r.width - 4;
      if (top + r.height > innerHeight - 4) top = anchor ? Math.max(4, (anchor.bottom || y) - r.height) : innerHeight - r.height - 4;
      m.style.left = Math.max(4, left) + "px";
      m.style.top = Math.max(4, top) + "px";
    }
    // ---------------------------------------------------------------- theme (Firefox theme API)
    setTheme(colors) {
      this.ensure();
      const c = (v) => Array.isArray(v) ? `rgb(${v.slice(0, 3).join(",")}${v.length > 3 ? "," + v[3] : ""})` : v;
      const s = this.root.style;
      const pick = (...keys) => {
        for (const k of keys) if (colors && colors[k] != null) return c(colors[k]);
        return "";
      };
      s.setProperty("--bg", pick("popup", "toolbar", "frame", "accentcolor"));
      s.setProperty("--fg", pick("popup_text", "toolbar_text", "tab_background_text", "textcolor", "bookmark_text"));
      s.setProperty("--acc", pick("icons_attention", "tab_line", "popup_highlight", "toolbar_field_highlight"));
      s.setProperty("--bd", pick("popup_border", "toolbar_bottom_separator", "toolbar_top_separator"));
      s.setProperty("--hl", pick("toolbar_field_focus", "button_background_hover", "popup_highlight"));
      for (const k of ["--bg", "--fg", "--acc", "--bd", "--hl"]) if (!s.getPropertyValue(k)) s.removeProperty(k);
    }
    // ---------------------------------------------------------------- banner (debugger attached)
    banner(ext, text, onCancel) {
      this.ensure();
      const b = el("div", { class: "banner", role: "status" }, el("span", { text }), el("button", { type: "button", text: "Cancel", onclick: () => {
        b.remove();
        onCancel && onCancel();
      } }));
      this.root.append(b);
      return { remove: () => b.remove() };
    }
    // ---------------------------------------------------------------- DevTools drawer
    drawer(ext, { title, onPick, onClose }) {
      this.ensure();
      const tabsEl = el("div", { class: "tabs", role: "tablist" });
      const body = el("div", { class: "body" });
      const empty = el("div", { class: "empty", text: "This extension has not created any DevTools panels yet." });
      body.append(empty);
      const tabs = [];
      let current = null;
      let picking = false;
      let hl = null;
      const stopPick = () => {
        picking = false;
        pickBtn.classList.remove("on");
        if (hl) {
          hl.remove();
          hl = null;
        }
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("click", onClick, true);
      };
      const onMove = (e) => {
        if (e.composedPath().includes(this.host)) return;
        const r = e.target.getBoundingClientRect();
        Object.assign(hl.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
      };
      const onClick = (e) => {
        if (e.composedPath().includes(this.host)) return;
        e.preventDefault();
        e.stopPropagation();
        stopPick();
        onPick && onPick(e.target);
      };
      const pickBtn = el("button", { class: "tool", type: "button", text: "Select element", title: "Pick an element on the page ($0)", onclick: () => {
        if (picking) return stopPick();
        picking = true;
        pickBtn.classList.add("on");
        hl = el("div", { class: "pick" });
        this.root.append(hl);
        document.addEventListener("mousemove", onMove, true);
        document.addEventListener("click", onClick, true);
      } });
      const icon = el("span");
      renderIcon(ext, icon, null, 16);
      const box = el(
        "div",
        { class: "panel drawer", role: "region", "aria-label": title },
        el("div", { class: "vgrip" }),
        el("div", { class: "bar" }, icon, tabsEl, pickBtn, el("button", { class: "x", type: "button", title: "Close", "aria-label": "Close", text: "\xD7", onclick: () => api.close() })),
        body
      );
      const grip = box.firstChild;
      grip.addEventListener("pointerdown", (e) => {
        grip.setPointerCapture(e.pointerId);
        const move = (ev) => {
          box.style.height = Math.max(120, Math.min(innerHeight - 40, innerHeight - ev.clientY)) + "px";
        };
        const up = () => {
          grip.removeEventListener("pointermove", move);
          grip.removeEventListener("pointerup", up);
        };
        grip.addEventListener("pointermove", move);
        grip.addEventListener("pointerup", up);
      });
      const api = {
        addTab: (label, hooks) => {
          const t = { label, hooks, btn: null, view: null };
          t.btn = el("button", { type: "button", role: "tab", text: label, onclick: () => api.select(t) });
          tabsEl.append(t.btn);
          tabs.push(t);
          empty.remove();
          if (!current) api.select(t);
          return t;
        },
        select: (t) => {
          if (current === t) return;
          if (current) {
            current.btn.classList.remove("on");
            if (current.view) current.view.style.display = "none";
            current.hooks.hide && current.hooks.hide();
          }
          current = t;
          t.btn.classList.add("on");
          if (!t.view) {
            t.view = el("iframe", { "data-extshim": "devtools-panel", title: t.label });
            body.append(t.view);
          }
          t.view.style.display = "";
          t.hooks.show && t.hooks.show(t.view);
        },
        showJson: (t, text, select) => {
          if (!t.pre) {
            t.pre = el("pre");
          }
          t.pre.textContent = text;
          if (t.view && t.view.localName === "iframe" && !t.view.contentDocument.body.childNodes.length) {
            t.view.replaceWith(t.pre);
            t.view = t.pre;
          }
          if (select) api.select(t);
        },
        close: () => {
          stopPick();
          box.remove();
          this.panels.delete(api);
          if (onClose) onClose();
        },
        kind: "drawer"
      };
      this.layer.append(box);
      this.panels.add(api);
      return api;
    }
    // ---------------------------------------------------------------- omnibox palette
    palette(ext, { keyword, defaultSuggestion, onInput, onEnter, onCancel }) {
      this.ensure();
      const input = el("input", { type: "text", "aria-label": "Omnibox", autocomplete: "off", spellcheck: "false" });
      const list = el("div", { class: "sg", role: "listbox" });
      const box = el("div", { class: "pal", role: "dialog", "aria-label": ext.name }, el("div", { class: "in" }, el("span", { class: "kw", text: keyword || ext.name }), input), list);
      let items = [];
      let sel = -1;
      let done = false;
      const styled = (desc) => {
        const out = el("span");
        const re = /<(match|dim|url)>([\s\S]*?)<\/\1>|([^<]+)|<[^>]*>/g;
        let m;
        const unesc = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
        while (m = re.exec(String(desc || ""))) {
          if (m[1]) out.append(el("span", { class: m[1][0], text: unesc(m[2].replace(/<[^>]*>/g, "")) }));
          else if (m[3]) out.append(unesc(m[3]));
        }
        return out;
      };
      const render = () => {
        list.textContent = "";
        const def = defaultSuggestion();
        const rows = [...def ? [{ content: null, description: def.replace(/%s/g, input.value) }] : [], ...items];
        rows.forEach((r, i) => {
          const row = el("div", { class: "it" + (i === sel ? " on" : ""), role: "option" }, styled(r.description || r.content));
          row.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            finish(r.content ?? input.value, "currentTab");
          });
          list.append(row);
        });
        return rows;
      };
      const close = () => {
        done = true;
        box.remove();
      };
      const finish = (text, disposition) => {
        if (done) return;
        close();
        onEnter(text, disposition);
      };
      input.addEventListener("input", () => {
        sel = -1;
        items = [];
        render();
        onInput(input.value, (r) => {
          items = r;
          render();
        });
      });
      input.addEventListener("keydown", (e) => {
        e.stopPropagation();
        const rows = render();
        if (e.key === "ArrowDown") {
          sel = Math.min(rows.length - 1, sel + 1);
          render();
          e.preventDefault();
        } else if (e.key === "ArrowUp") {
          sel = Math.max(-1, sel - 1);
          render();
          e.preventDefault();
        } else if (e.key === "Enter") {
          e.preventDefault();
          const r = rows[sel];
          finish(r && r.content != null ? r.content : input.value, e.altKey || e.metaKey ? "newForegroundTab" : "currentTab");
        } else if (e.key === "Escape") {
          e.preventDefault();
          close();
          onCancel();
        }
      });
      input.addEventListener("blur", () => setTimeout(() => {
        if (!done && !box.matches(":focus-within")) {
          close();
          onCancel();
        }
      }, 150));
      this.root.append(box);
      render();
      setTimeout(() => input.focus(), 0);
      return { focus: () => input.focus(), close, input };
    }
    // ---------------------------------------------------------------- notifications
    toast(ext, view, { onClick, onButton, onClose }) {
      this.ensure();
      const t = el("div", { class: "toast", role: "status" });
      let timer = null;
      let closed = false;
      const close = (byUser, silent) => {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        t.remove();
        onClose(byUser, silent);
      };
      const arm = (v) => {
        clearTimeout(timer);
        if (!v.requireInteraction) timer = setTimeout(() => close(false), 7e3);
      };
      const render = (v) => {
        t.textContent = "";
        const icon = el("img", { class: "ic", alt: "" });
        if (v.icon) {
          icon.src = v.icon;
          icon.onerror = () => icon.remove();
        } else icon.hidden = true;
        const body = el(
          "div",
          { class: "bd" },
          el("div", { class: "app" }, el("span", { text: v.appName }), el("button", { class: "x", type: "button", title: "Close", "aria-label": "Close", text: "\xD7", onclick: (e) => {
            e.stopPropagation();
            close(true);
          } })),
          el("div", { class: "ti", text: v.title }),
          v.message ? el("div", { class: "ms", text: v.message }) : null,
          ...v.items.map((i) => el("div", { class: "ms" }, el("b", { text: (i.title || "") + " " }), i.message || "")),
          v.contextMessage ? el("div", { class: "cm", text: v.contextMessage }) : null,
          v.image ? el("img", { class: "im", src: v.image, alt: "" }) : null,
          v.progress != null ? (() => {
            const bar = el("div", { class: "pg" }, el("i"));
            bar.firstChild.style.width = Math.max(0, Math.min(100, v.progress)) + "%";
            return bar;
          })() : null,
          v.buttons.length ? el("div", { class: "bt" }, ...v.buttons.map((label, i) => el("button", { type: "button", text: label, onclick: (e) => {
            e.stopPropagation();
            onButton(i);
            close(true);
          } }))) : null
        );
        t.append(icon, body);
        arm(v);
      };
      t.addEventListener("click", () => {
        onClick();
      });
      t.addEventListener("mouseenter", () => clearTimeout(timer));
      t.addEventListener("mouseleave", () => arm(cur));
      let cur = view;
      render(view);
      this.toastBox.prepend(t);
      return { update: (v) => {
        cur = v;
        render(v);
      }, close };
    }
    destroyIfEmpty() {
      if (!this.dock.children.length && !this.panels.size && this.host) {
        if (this._keeper) {
          this._keeper.disconnect();
          this._keeper = null;
        }
        this.host.remove();
      }
    }
  };

  // src/runtime/vfs.js
  var BaseVFS = class {
    constructor() {
      this.blobUrls = /* @__PURE__ */ new Map();
      this.blobPaths = /* @__PURE__ */ new Map();
      this.transform = null;
    }
    pathForBlobUrl(url) {
      return this.blobPaths.get(url.split("#")[0]) ?? null;
    }
    /**
     * File contents, or null if missing. Implemented by subclasses.
     * @param {string} path
     * @returns {Promise<Uint8Array|null>}
     */
    async bytes(path) {
      throw new Error(`${this.constructor.name}.bytes(${path}) is not implemented`);
    }
    async blob(path) {
      const b = await this.bytes(path);
      if (!b) return null;
      if (this.transform && /\.css$/i.test(path)) return new Blob([this.transform(path, utf8.decode(b))], { type: "text/css" });
      return new Blob([b], { type: mimeType(path) });
    }
    unit() {
      return null;
    }
  };
  var MemoryVFS = class _MemoryVFS extends BaseVFS {
    /**
     * @param {Map<string, Uint8Array|string|null>} files
     * @param {Record<string, Function>} [units] precompiled units (bundle mode)
     */
    constructor(files, units = {}) {
      super();
      this.kind = "memory";
      this.files = /* @__PURE__ */ new Map();
      for (const [p, v] of files) this.files.set(p, v);
      this.units = units;
      this._text = /* @__PURE__ */ new Map();
    }
    static fromBundle(files, units) {
      const m = /* @__PURE__ */ new Map();
      for (const p of Object.keys(files)) m.set(p, files[p]);
      return new _MemoryVFS(m, units);
    }
    paths() {
      return [...this.files.keys()];
    }
    has(path) {
      return this.files.has(path);
    }
    async exists(path) {
      return this.files.has(path);
    }
    unit(key) {
      return this.units[key] || null;
    }
    textSync(path) {
      if (this._text.has(path)) return this._text.get(path);
      if (!this.files.has(path)) return null;
      let v = this.files.get(path);
      let t;
      if (v === 0 || v === null) {
        const u = this.units[path];
        t = u ? unwrapClassicScript(Function.prototype.toString.call(u)) : null;
      } else if (typeof v === "string") t = v;
      else if (v && v.b64 != null) t = utf8.decode(base64ToBytes(v.b64));
      else t = utf8.decode(v);
      this._text.set(path, t);
      return t;
    }
    bytesSync(path) {
      if (!this.files.has(path)) return null;
      const v = this.files.get(path);
      if (v instanceof Uint8Array) return v;
      if (v && v.b64 != null) {
        const b = base64ToBytes(v.b64);
        this.files.set(path, b);
        return b;
      }
      const t = this.textSync(path);
      return t == null ? null : utf8.encode(t);
    }
    async text(path) {
      return this.textSync(path);
    }
    async bytes(path) {
      return this.bytesSync(path);
    }
    /** Synchronous URL for a resource (blob: URL created on first use). */
    url(path) {
      if (this.blobUrls.has(path)) return this.blobUrls.get(path);
      if (!this.files.has(path)) return null;
      let blob;
      if (this.transform && /\.css$/i.test(path)) blob = new Blob([this.transform(path, this.textSync(path))], { type: "text/css" });
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
  };
  var HttpVFS = class extends BaseVFS {
    constructor(baseUrl) {
      super();
      this.kind = "http";
      this.base = new URL(baseUrl, location.href).href.replace(/[^/]*$/, "");
      this.cache = /* @__PURE__ */ new Map();
    }
    paths() {
      return [...this.cache.keys()].filter((p) => this.cache.get(p));
    }
    has(path) {
      return this.cache.get(path) !== null;
    }
    // unknown files are assumed to exist
    async bytes(path) {
      if (this.cache.has(path)) return this.cache.get(path);
      let data = null;
      try {
        const r = await fetch(this.base + path.split("/").map(encodeURIComponent).join("/"));
        if (r.ok) data = new Uint8Array(await r.arrayBuffer());
      } catch {
      }
      this.cache.set(path, data);
      return data;
    }
    async exists(path) {
      return !!await this.bytes(path);
    }
    async text(path) {
      const b = await this.bytes(path);
      return b ? utf8.decode(b) : null;
    }
    async prefetch(paths) {
      await Promise.all(paths.map((p) => this.bytes(p)));
    }
    textSync(path) {
      if (this.cache.has(path)) {
        const b = this.cache.get(path);
        return b ? utf8.decode(b) : null;
      }
      try {
        const x = new XMLHttpRequest();
        x.open("GET", this.base + path, false);
        x.send();
        const ok = x.status >= 200 && x.status < 300;
        this.cache.set(path, ok ? utf8.encode(x.responseText) : null);
        return ok ? x.responseText : null;
      } catch {
        return null;
      }
    }
    bytesSync(path) {
      return this.cache.get(path) || (this.textSync(path) != null ? this.cache.get(path) : null);
    }
    url(path) {
      if (this.transform && /\.css$/i.test(path) && this.cache.get(path)) {
        if (this.blobUrls.has(path)) return this.blobUrls.get(path);
        const u = URL.createObjectURL(new Blob([this.transform(path, utf8.decode(this.cache.get(path)))], { type: "text/css" }));
        this.blobUrls.set(path, u);
        this.blobPaths.set(u, path);
        return u;
      }
      return this.base + path;
    }
    pathForHttpUrl(url) {
      return url.startsWith(this.base) ? decodeURIComponent(url.slice(this.base.length).split(/[?#]/)[0]) : null;
    }
    dispose() {
      for (const u of this.blobUrls.values()) URL.revokeObjectURL(u);
    }
  };

  // src/core/zip.js
  function u16(b, o) {
    return b[o] | b[o + 1] << 8;
  }
  function u32(b, o) {
    return (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;
  }
  function crxToZip(bytes) {
    if (bytes[0] === 67 && bytes[1] === 114 && bytes[2] === 50 && bytes[3] === 52) {
      const version = u32(bytes, 4);
      if (version === 2) return bytes.subarray(16 + u32(bytes, 8) + u32(bytes, 12));
      if (version === 3) return bytes.subarray(12 + u32(bytes, 8));
      throw new Error("Unsupported CRX version " + version);
    }
    return bytes;
  }
  async function inflateRawBrowser(data) {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([data]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function readZip(input, opts = {}) {
    const bytes = crxToZip(input instanceof Uint8Array ? input : new Uint8Array(input));
    const inflate = opts.inflateRaw || inflateRawBrowser;
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (u32(bytes, i) === 101010256) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error("Not a zip file (end of central directory not found)");
    const count = u16(bytes, eocd + 10);
    let p = u32(bytes, eocd + 16);
    const files = /* @__PURE__ */ new Map();
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (u32(bytes, p) !== 33639248) throw new Error("Corrupt zip central directory");
      const flags = u16(bytes, p + 8);
      const method = u16(bytes, p + 10);
      const compSize = u32(bytes, p + 20);
      const nameLen = u16(bytes, p + 28);
      const extraLen = u16(bytes, p + 30);
      const commentLen = u16(bytes, p + 32);
      const localOff = u32(bytes, p + 42);
      const nameBytes = bytes.subarray(p + 46, p + 46 + nameLen);
      const name = flags & 2048 ? dec.decode(nameBytes) : Array.from(nameBytes, (c) => String.fromCharCode(c)).join("");
      p += 46 + nameLen + extraLen + commentLen;
      if (name.endsWith("/")) continue;
      if (flags & 1) throw new Error("Encrypted zip entries are not supported: " + name);
      const lh = localOff;
      if (u32(bytes, lh) !== 67324752) throw new Error("Corrupt zip local header for " + name);
      const start = lh + 30 + u16(bytes, lh + 26) + u16(bytes, lh + 28);
      const raw = bytes.subarray(start, start + compSize);
      let data;
      if (method === 0) data = raw.slice();
      else if (method === 8) data = await inflate(raw);
      else throw new Error(`Unsupported zip compression method ${method} for ${name}`);
      files.set(name.replace(/\\/g, "/"), data instanceof Uint8Array ? data : new Uint8Array(data));
    }
    return files;
  }
  function rootFiles(files) {
    const candidates = [...files.keys()].filter((k) => /(^|\/)manifest\.json$/.test(k) && !/(^|\/)(__MACOSX|node_modules)\//.test(k)).sort((a, b) => a.split("/").length - b.split("/").length);
    if (!candidates.length) throw new Error("manifest.json not found");
    const prefix = candidates[0].slice(0, -"manifest.json".length);
    const out = /* @__PURE__ */ new Map();
    for (const [k, v] of files) {
      if (!k.startsWith(prefix) || /(^|\/)__MACOSX\//.test(k) || /(^|\/)\.DS_Store$/.test(k)) continue;
      out.set(k.slice(prefix.length), v);
    }
    return out;
  }

  // src/runtime/core.js
  var VERSION = "1.0.0";
  var KEY = /* @__PURE__ */ Symbol.for("extshim.runtime");
  var ExtShimRuntime = class {
    constructor() {
      this.version = VERSION;
      this.instances = /* @__PURE__ */ new Map();
      this.ui = new UI(this);
      this.tabId = 1 + Math.floor(Math.random() * 1e6);
      this.windowId = 1 + Math.floor(Math.random() * 1e3);
      this._tabCounter = this.tabId + 1;
      this.nativeFetch = window.fetch.bind(window);
      this.contextMenuModifier = "altKey";
      this.defaultPosition = "bottom-right";
      this._navWatching = false;
    }
    nextTabId() {
      return this._tabCounter++;
    }
    pageTab() {
      const icon = document.querySelector('link[rel~="icon" i]');
      return {
        id: this.tabId,
        index: 0,
        windowId: this.windowId,
        highlighted: true,
        active: true,
        pinned: false,
        audible: false,
        discarded: false,
        autoDiscardable: true,
        frozen: false,
        mutedInfo: { muted: false },
        incognito: false,
        selected: true,
        width: innerWidth,
        height: innerHeight,
        status: document.readyState === "complete" ? "complete" : "loading",
        url: location.href,
        title: document.title || location.href,
        favIconUrl: icon ? icon.href : location.origin + "/favicon.ico",
        groupId: groupIdOf(this, this.tabId),
        splitViewId: splitIdOf(this, this.tabId),
        lastAccessed: Date.now()
      };
    }
    list() {
      return [...this.instances.values()];
    }
    get(id) {
      return this.instances.get(id) || null;
    }
    async unload(id) {
      const e = this.instances.get(id);
      if (e) await e.stop();
    }
    async unloadAll() {
      for (const e of this.list()) await e.stop();
    }
    /** Entry point for CLI-generated bundles (precompiled units; no eval needed). */
    boot(data, options = {}) {
      const existing = window[KEY];
      if (existing && existing !== this && typeof existing.boot === "function") return existing.boot(data, options);
      const id = options && options.id || data.id;
      const running = this.instances.get(id);
      if (running) {
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
      if (!canEval()) throw new Error("ExtShim.load() needs eval, which this page's Content-Security-Policy blocks. Build a bundle with the ExtShim CLI instead.");
      let vfs;
      if (typeof source === "string" || source instanceof URL) {
        const url = new URL(String(source), location.href);
        if (/\.(zip|crx|xpi)$/i.test(url.pathname)) {
          const r = await this.nativeFetch(url.href);
          if (!r.ok) throw new Error(`Could not fetch ${url.href}: HTTP ${r.status}`);
          vfs = new MemoryVFS(rootFiles(await readZip(new Uint8Array(await r.arrayBuffer()))));
        } else {
          const base = /manifest\.json$/i.test(url.pathname) ? url.href.replace(/manifest\.json(\?.*)?$/i, "") : url.href.replace(/\/?(\?.*)?$/, "/");
          vfs = new HttpVFS(base);
        }
      } else if (typeof Blob !== "undefined" && source instanceof Blob && !source.webkitRelativePath) {
        vfs = new MemoryVFS(rootFiles(await readZip(new Uint8Array(await source.arrayBuffer()))));
      } else if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
        vfs = new MemoryVFS(rootFiles(await readZip(new Uint8Array(source.buffer || source))));
      } else if (source && typeof source.length === "number" && source[0] && typeof source[0].arrayBuffer === "function") {
        const m = /* @__PURE__ */ new Map();
        for (const f of Array.from(source)) m.set(f.webkitRelativePath || f.relativePath || f.name, new Uint8Array(await f.arrayBuffer()));
        vfs = new MemoryVFS(rootFiles(m));
      } else if (source instanceof Map || source && typeof source === "object") {
        const m = /* @__PURE__ */ new Map();
        const entries = source instanceof Map ? source : Object.entries(source.files || source);
        for (const [k, v] of entries) m.set(k, typeof v === "string" ? new TextEncoder().encode(v) : v instanceof Uint8Array ? v : new Uint8Array(v));
        vfs = new MemoryVFS(rootFiles(m));
      } else throw new TypeError("ExtShim.load: unsupported source");
      const text = await vfs.text("manifest.json");
      if (text == null) throw new Error("manifest.json not found");
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
        ext.log.error("Failed to start:", e);
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
          if (ext.status !== "running") continue;
          const tab = this.pageTab();
          ext.dispatch("tabs.onUpdated", () => [this.tabId, { ...info }, { ...tab }]);
        }
      };
      const nav = () => {
        if (location.href === url) return;
        const prev = url;
        url = location.href;
        changed({ url });
        for (const ext of this.instances.values()) for (const h of ext.navHooks) {
          try {
            h(url);
          } catch (e) {
            ext.log.error(e);
          }
        }
        const hashOnly = prev.split("#")[0] === url.split("#")[0];
        for (const ext of this.instances.values()) {
          if (ext.status !== "running") continue;
          const details = { tabId: this.tabId, frameId: 0, parentFrameId: -1, url, timeStamp: Date.now(), transitionType: "link", transitionQualifiers: [], documentLifecycle: "active", frameType: "outermost_frame" };
          ext.dispatch(hashOnly ? "webNavigation.onReferenceFragmentUpdated" : "webNavigation.onHistoryStateUpdated", () => [{ ...details }], { urlFilter: url });
        }
      };
      const titleCheck = () => {
        if (document.title !== title) {
          title = document.title;
          changed({ title });
        }
      };
      if (window.navigation && typeof window.navigation.addEventListener === "function") window.navigation.addEventListener("navigatesuccess", () => setTimeout(nav, 0));
      window.addEventListener("popstate", nav);
      window.addEventListener("hashchange", nav);
      setInterval(() => {
        nav();
        titleCheck();
      }, 1e3);
      if (document.readyState !== "complete") {
        const fire2 = (key) => {
          for (const ext of this.instances.values()) {
            ext.dispatch(key, () => [{ tabId: this.tabId, frameId: 0, parentFrameId: -1, url: location.href, timeStamp: Date.now(), documentLifecycle: "active", frameType: "outermost_frame" }], { urlFilter: location.href });
          }
        };
        document.addEventListener("DOMContentLoaded", () => fire2("webNavigation.onDOMContentLoaded"), { once: true });
        window.addEventListener("load", () => {
          changed({ status: "complete" });
          fire2("webNavigation.onCompleted");
        }, { once: true });
      }
    }
  };
  function getRuntime() {
    if (!window[KEY]) {
      try {
        Object.defineProperty(window, KEY, { value: new ExtShimRuntime(), configurable: true });
      } catch {
        window[KEY] = new ExtShimRuntime();
      }
    }
    return window[KEY];
  }
  var runtime = getRuntime();
  try {
    const cs = document.currentScript;
    if (cs && cs.dataset && cs.dataset.extension) {
      const opts = cs.dataset.options ? JSON.parse(cs.dataset.options) : {};
      runtime.load(cs.dataset.extension, opts).catch((e) => console.error("[ExtShim]", e));
    }
  } catch (e) {
    console.error("[ExtShim]", e);
  }
  var core_default = runtime;

  // src/runtime/api/dom-api.js
  var closedRoots = /* @__PURE__ */ new WeakMap();
  var shadowHooked = false;
  function hookShadowRoots() {
    if (shadowHooked || typeof Element === "undefined") return;
    shadowHooked = true;
    const orig = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function attachShadow(init) {
      const root = orig.call(this, init);
      if (init && init.mode === "closed") closedRoots.set(this, root);
      return root;
    };
    Object.defineProperty(Element.prototype.attachShadow, "toString", { value: () => "function attachShadow() { [native code] }" });
  }
  function domApi() {
    return {
      openOrClosedShadowRoot: (el2) => {
        if (!(el2 instanceof Element)) throw new TypeError("Error in invocation of dom.openOrClosedShadowRoot: element must be an HTMLElement.");
        return el2.shadowRoot || closedRoots.get(el2) || null;
      }
    };
  }
  defineStartup(() => hookShadowRoots());
  defineNamespace("dom", domApi, { always: true, contexts: "all" });

  // src/runtime/api/browser-data.js
  function profile(ext, key, init) {
    return ext.shared("profile:" + key, () => {
      const internal = ext.storage.internal();
      const saved = internal.data["profile:" + key];
      const p = { data: saved ? JSON.parse(JSON.stringify(saved)) : init(), timer: null };
      p.save = () => {
        clearTimeout(p.timer);
        p.timer = setTimeout(() => internal.set({ ["profile:" + key]: p.data }), 30);
      };
      return p;
    });
  }
  var clone = (v) => v === void 0 ? void 0 : JSON.parse(JSON.stringify(v));
  var now = () => Date.now();
  var ROOTS = { 0: "", 1: "Bookmarks bar", 2: "Other bookmarks", 3: "Mobile bookmarks" };
  var FOLDER_TYPE = { 1: "bookmarks-bar", 2: "other", 3: "mobile" };
  function bookmarkStore(ext) {
    return profile(ext, "bookmarks", () => {
      const t = now();
      const nodes = { 0: { id: "0", title: "", children: ["1", "2", "3"], dateAdded: t } };
      for (const id of ["1", "2", "3"]) nodes[id] = { id, parentId: "0", title: ROOTS[id], children: [], dateAdded: t, dateGroupModified: t, folderType: FOLDER_TYPE[id] };
      return { nextId: 100, nodes };
    });
  }
  function bookmarksImport(ext, html) {
    const st = bookmarkStore(ext);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const add = (dl, parentId) => {
      for (const dt of dl.children) {
        if (dt.localName !== "dt") continue;
        const a = dt.querySelector(":scope > a");
        const h = dt.querySelector(":scope > h3");
        if (a) createNode(ext, st, { parentId, title: a.textContent, url: a.getAttribute("href"), dateAdded: (+a.getAttribute("add_date") || 0) * 1e3 || void 0 });
        else if (h) {
          const f = createNode(ext, st, { parentId, title: h.textContent });
          const sub = dt.querySelector(":scope > dl");
          if (sub) add(sub, f.id);
        }
      }
    };
    const root = doc.querySelector("dl");
    if (root) add(root, "1");
    st.save();
  }
  function createNode(ext, st, o) {
    const n = st.data.nodes;
    const parentId = String(o.parentId ?? "2");
    const parent = n[parentId];
    if (!parent || !parent.children) throw new Error("Can't find parent bookmark for id.");
    if (parentId === "0") throw new Error("Can't modify the root bookmark folders.");
    const id = String(st.data.nextId++);
    const node = { id, parentId, title: o.title || "", dateAdded: o.dateAdded || now() };
    if (o.type === "separator") node.type = "separator";
    else if (o.url) node.url = String(o.url);
    else {
      node.children = [];
      node.dateGroupModified = node.dateAdded;
    }
    n[id] = node;
    const idx = o.index == null ? parent.children.length : Math.max(0, Math.min(parent.children.length, o.index));
    parent.children.splice(idx, 0, id);
    parent.dateGroupModified = now();
    return node;
  }
  function bookmarksApi(h) {
    const { ext, fn } = h;
    const st = bookmarkStore(ext);
    const N = () => st.data.nodes;
    const view = (id, deep = false) => {
      const x = N()[id];
      if (!x) return null;
      const out = { id: x.id, title: x.title, dateAdded: x.dateAdded, syncing: false };
      if (x.parentId != null) {
        out.parentId = x.parentId;
        out.index = N()[x.parentId].children.indexOf(x.id);
      }
      if (x.url) {
        out.url = x.url;
        if (x.dateLastUsed) out.dateLastUsed = x.dateLastUsed;
        out.type = "bookmark";
      } else if (x.type === "separator") out.type = "separator";
      else {
        out.dateGroupModified = x.dateGroupModified;
        out.type = "folder";
        if (x.folderType) out.folderType = x.folderType;
      }
      if (deep && x.children) out.children = x.children.map((c) => view(c, true));
      return out;
    };
    const must = (id) => {
      if (!N()[String(id)]) throw new Error("Can't find bookmark for id.");
      return String(id);
    };
    const root = (id) => {
      if (["0", "1", "2", "3"].includes(String(id))) throw new Error("Can't modify the root bookmark folders.");
    };
    const all = () => Object.values(N()).filter((x) => x.url);
    const emit = (ev, args) => ext.dispatch("bookmarks." + ev, () => clone(args));
    const api = {
      get: fn((ids) => (Array.isArray(ids) ? ids : [ids]).map((i) => view(must(i)))),
      getChildren: fn((id) => (N()[must(id)].children || []).map((c) => view(c))),
      getRecent: fn((n) => all().sort((a, b) => b.dateAdded - a.dateAdded).slice(0, Math.max(1, n | 0)).map((x) => view(x.id))),
      getTree: fn(() => [view("0", true)]),
      getSubTree: fn((id) => [view(must(id), true)]),
      search: fn((q) => {
        if (typeof q === "string") {
          const words = q.toLowerCase().split(/\s+/).filter(Boolean);
          return Object.values(N()).filter((x) => x.id !== "0" && words.length && words.every((w) => (x.title || "").toLowerCase().includes(w) || (x.url || "").toLowerCase().includes(w))).map((x) => view(x.id));
        }
        q = q || {};
        return Object.values(N()).filter((x) => x.id !== "0" && (!q.url || x.url === q.url) && (!q.title || x.title === q.title) && (!q.query || q.query.toLowerCase().split(/\s+/).every((w) => (x.title || "").toLowerCase().includes(w) || (x.url || "").toLowerCase().includes(w)))).map((x) => view(x.id));
      }),
      create: fn((o = {}) => {
        const node = createNode(ext, st, o);
        st.save();
        const v = view(node.id);
        emit("onCreated", [node.id, v]);
        return v;
      }),
      move: fn((id, d = {}) => {
        id = must(id);
        root(id);
        const x = N()[id];
        const oldParentId = x.parentId;
        const oldIndex = N()[oldParentId].children.indexOf(id);
        const parentId = String(d.parentId ?? oldParentId);
        const parent = N()[parentId];
        if (!parent || !parent.children || parentId === "0") throw new Error("Can't find parent bookmark for id.");
        for (let p = parentId; p; p = N()[p] && N()[p].parentId) if (p === id) throw new Error("Can't move a folder into itself.");
        N()[oldParentId].children.splice(oldIndex, 1);
        const idx = d.index == null ? parent.children.length : Math.max(0, Math.min(parent.children.length, d.index));
        parent.children.splice(idx, 0, id);
        x.parentId = parentId;
        st.save();
        emit("onMoved", [id, { parentId, index: idx, oldParentId, oldIndex }]);
        return view(id);
      }),
      update: fn((id, c = {}) => {
        id = must(id);
        root(id);
        const x = N()[id];
        if (c.title !== void 0) x.title = String(c.title);
        if (c.url !== void 0) {
          if (!x.url) throw new Error("Can't set URL of a bookmark folder.");
          x.url = String(c.url);
        }
        st.save();
        emit("onChanged", [id, { title: x.title, ...x.url ? { url: x.url } : {} }]);
        return view(id);
      }),
      remove: fn((id) => {
        id = must(id);
        root(id);
        if (N()[id].children && N()[id].children.length) throw new Error("Can't remove non-empty folder (use recursive to force).");
        return removeTree(id);
      }),
      removeTree: fn((id) => {
        id = must(id);
        root(id);
        return removeTree(id);
      }),
      onCreated: h.event("bookmarks.onCreated"),
      onRemoved: h.event("bookmarks.onRemoved"),
      onChanged: h.event("bookmarks.onChanged"),
      onMoved: h.event("bookmarks.onMoved"),
      onChildrenReordered: h.event("bookmarks.onChildrenReordered"),
      onImportBegan: h.event("bookmarks.onImportBegan"),
      onImportEnded: h.event("bookmarks.onImportEnded"),
      MAX_WRITE_OPERATIONS_PER_HOUR: 1e6,
      MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE: 1e6,
      ROOT_NODE_ID: "0"
    };
    function removeTree(id) {
      const x = N()[id];
      const node = view(id, true);
      const parent = N()[x.parentId];
      const index = parent.children.indexOf(id);
      parent.children.splice(index, 1);
      const kill = (i) => {
        const n = N()[i];
        if (n.children) n.children.forEach(kill);
        delete N()[i];
      };
      kill(id);
      st.save();
      emit("onRemoved", [id, { parentId: x.parentId, index, node }]);
    }
    return api;
  }
  function historyStore(ext) {
    return profile(ext, "history", () => ({ items: {}, visits: [], nextId: 1, nextVisit: 1 }));
  }
  function recordVisit(ext, url, title, transition = "link") {
    if (!/^(https?|file):/.test(url)) return;
    const st = historyStore(ext);
    const d = st.data;
    let it = d.items[url];
    if (!it) it = d.items[url] = { id: String(d.nextId++), url, title: title || "", lastVisitTime: 0, visitCount: 0, typedCount: 0 };
    it.lastVisitTime = now();
    it.visitCount++;
    if (transition === "typed") it.typedCount++;
    if (title) it.title = title;
    d.visits.push({ id: it.id, url, visitId: String(d.nextVisit++), visitTime: it.lastVisitTime, referringVisitId: "0", transition, isLocal: true });
    if (d.visits.length > 1e4) d.visits.splice(0, d.visits.length - 1e4);
    st.save();
    ext.dispatch("history.onVisited", () => [clone(it)]);
  }
  defineStartup((ext) => {
    recordVisit(ext, location.href, document.title, "link");
    let lastTitle = document.title;
    ext.navHooks.add((url) => recordVisit(ext, url, document.title, "link"));
    const t = setInterval(() => {
      if (document.title !== lastTitle) {
        lastTitle = document.title;
        const it = historyStore(ext).data.items[location.href];
        if (it) {
          it.title = lastTitle;
          historyStore(ext).save();
          ext.dispatch("history.onTitleChanged", [{ id: it.id, url: it.url, title: lastTitle }]);
        }
      }
    }, 1500);
    ext.cleanups.push(() => clearInterval(t));
  }, ["history", "topSites"]);
  function historyApi(h) {
    const { ext, fn } = h;
    const st = historyStore(ext);
    const d = () => st.data;
    const removed = (urls, all = false) => ext.dispatch("history.onVisitRemoved", [{ allHistory: all, urls }]);
    const prune = () => {
      const live = new Set(d().visits.map((v) => v.url));
      const gone = Object.keys(d().items).filter((u) => !live.has(u));
      gone.forEach((u) => delete d().items[u]);
      return gone;
    };
    return {
      search: fn((q = {}) => {
        const text = String(q.text || "").toLowerCase();
        const start = q.startTime == null ? now() - 864e5 : +q.startTime;
        const end = q.endTime == null ? Infinity : +q.endTime;
        return Object.values(d().items).filter((i) => i.lastVisitTime >= start && i.lastVisitTime <= end && (!text || text.split(/\s+/).every((w) => i.url.toLowerCase().includes(w) || (i.title || "").toLowerCase().includes(w)))).sort((a, b) => b.lastVisitTime - a.lastVisitTime).slice(0, q.maxResults == null ? 100 : q.maxResults || Infinity).map(clone);
      }),
      getVisits: fn((o = {}) => d().visits.filter((v) => v.url === o.url).map(({ url, ...v }) => clone(v))),
      addUrl: fn((o = {}) => {
        if (!o.url) throw new Error("Invalid URL.");
        recordVisit(ext, o.url, o.title, o.transition || "link");
        if (o.visitTime) {
          const it = d().items[o.url];
          if (it) {
            it.lastVisitTime = +o.visitTime;
            d().visits[d().visits.length - 1].visitTime = +o.visitTime;
            st.save();
          }
        }
      }),
      deleteUrl: fn((o = {}) => {
        d().visits = d().visits.filter((v) => v.url !== o.url);
        delete d().items[o.url];
        st.save();
        removed([o.url]);
      }),
      deleteRange: fn((o = {}) => {
        d().visits = d().visits.filter((v) => v.visitTime < o.startTime || v.visitTime > o.endTime);
        const gone = prune();
        st.save();
        removed(gone);
      }),
      deleteAll: fn(() => {
        d().visits = [];
        d().items = {};
        st.save();
        removed([], true);
      }),
      onVisited: h.event("history.onVisited"),
      onVisitRemoved: h.event("history.onVisitRemoved"),
      onTitleChanged: h.event("history.onTitleChanged")
    };
  }
  function topSitesApi(h) {
    const { ext, fn } = h;
    return {
      get: fn((o = {}) => {
        const items = Object.values(historyStore(ext).data.items).sort((a, b) => b.visitCount - a.visitCount || b.lastVisitTime - a.lastVisitTime);
        const out = [];
        const seen = /* @__PURE__ */ new Set();
        for (const i of items) {
          let host = "";
          try {
            host = new URL(i.url).hostname;
          } catch {
          }
          if (o.onePerDomain && seen.has(host)) continue;
          seen.add(host);
          out.push({ url: i.url, title: i.title, type: "url", ...o.includeFavicon ? { favicon: new URL("/favicon.ico", i.url).href } : {} });
          if (out.length >= (o.limit || 12)) break;
        }
        return out;
      })
    };
  }
  function sessionStore(ext) {
    return profile(ext, "sessions", () => ({ closed: [], current: null, tabValues: {}, windowValues: {} }));
  }
  function noteClosedTab(ext, tab) {
    if (!ext.state["profile:sessions"] && !(ext.manifest.permissions || []).includes("sessions")) return;
    const st = sessionStore(ext);
    st.data.closed.unshift({ lastModified: Math.floor(now() / 1e3), tab: { ...tab, sessionId: "s" + now().toString(36) } });
    st.data.closed = st.data.closed.slice(0, 25);
    st.save();
    ext.dispatch("sessions.onChanged", []);
  }
  defineStartup((ext) => {
    const st = sessionStore(ext);
    if (st.data.current && st.data.current.url !== location.href) {
      st.data.closed.unshift({ lastModified: Math.floor(st.data.current.time / 1e3), tab: { ...st.data.current.tab, sessionId: "s" + st.data.current.time.toString(36) } });
      st.data.closed = st.data.closed.slice(0, 25);
    }
    const update = () => {
      st.data.current = { url: location.href, time: now(), tab: { ...ext.pageTab(), active: false } };
      st.save();
    };
    update();
    ext.navHooks.add(update);
  }, ["sessions"]);
  function sessionsApi(h) {
    const { ext, fn } = h;
    const st = sessionStore(ext);
    const find = (id) => st.data.closed.findIndex((s) => s.tab && s.tab.sessionId === id || s.window && s.window.sessionId === id);
    return {
      MAX_SESSION_RESULTS: 25,
      getRecentlyClosed: fn((f = {}) => clone(st.data.closed.slice(0, f.maxResults == null ? 25 : f.maxResults))),
      getDevices: fn(() => []),
      restore: fn((id) => {
        const i = id == null ? 0 : find(id);
        if (i < 0 || !st.data.closed[i]) throw new Error("There are no sessions to restore.");
        const [s] = st.data.closed.splice(i, 1);
        st.save();
        const url = s.tab && s.tab.url;
        if (url && ext.resolvePath(url) != null) ext.openTab(url);
        else if (url) window.open(url, "_blank");
        ext.dispatch("sessions.onChanged", []);
        return clone(s);
      }),
      forgetClosedTab: fn((windowId, id) => {
        const i = find(id);
        if (i < 0) throw new Error("Invalid session id.");
        st.data.closed.splice(i, 1);
        st.save();
      }),
      forgetClosedWindow: fn((id) => {
        const i = find(id);
        if (i >= 0) {
          st.data.closed.splice(i, 1);
          st.save();
        }
      }),
      setTabValue: fn((tabId, key, value) => {
        (st.data.tabValues[tabId] = st.data.tabValues[tabId] || {})[key] = clone(value);
        st.save();
      }),
      getTabValue: fn((tabId, key) => clone((st.data.tabValues[tabId] || {})[key])),
      removeTabValue: fn((tabId, key) => {
        if (st.data.tabValues[tabId]) {
          delete st.data.tabValues[tabId][key];
          st.save();
        }
      }),
      setWindowValue: fn((windowId, key, value) => {
        (st.data.windowValues[windowId] = st.data.windowValues[windowId] || {})[key] = clone(value);
        st.save();
      }),
      getWindowValue: fn((windowId, key) => clone((st.data.windowValues[windowId] || {})[key])),
      removeWindowValue: fn((windowId, key) => {
        if (st.data.windowValues[windowId]) {
          delete st.data.windowValues[windowId][key];
          st.save();
        }
      }),
      onChanged: h.event("sessions.onChanged")
    };
  }
  function readingListApi(h) {
    const { ext, fn } = h;
    const st = profile(ext, "readingList", () => ({ entries: {} }));
    const E = () => st.data.entries;
    const norm = (u) => {
      try {
        return new URL(u).href;
      } catch {
        throw new Error("URL is not valid.");
      }
    };
    return {
      addEntry: fn((e = {}) => {
        const url = norm(e.url);
        if (E()[url]) throw new Error("Duplicate URL.");
        const t = now();
        E()[url] = { url, title: e.title || "", hasBeenRead: !!e.hasBeenRead, creationTime: t, lastUpdateTime: t };
        st.save();
        ext.dispatch("readingList.onEntryAdded", () => [clone(E()[url])]);
      }),
      query: fn((q = {}) => Object.values(E()).filter((e) => (q.url == null || e.url === norm(q.url)) && (q.title == null || e.title === q.title) && (q.hasBeenRead == null || e.hasBeenRead === q.hasBeenRead)).map(clone)),
      removeEntry: fn((q = {}) => {
        const url = norm(q.url);
        const e = E()[url];
        if (!e) throw new Error("URL not found.");
        delete E()[url];
        st.save();
        ext.dispatch("readingList.onEntryRemoved", () => [clone(e)]);
      }),
      updateEntry: fn((q = {}) => {
        const url = norm(q.url);
        const e = E()[url];
        if (!e) throw new Error("URL not found.");
        if (q.title != null) e.title = q.title;
        if (q.hasBeenRead != null) e.hasBeenRead = !!q.hasBeenRead;
        e.lastUpdateTime = now();
        st.save();
        ext.dispatch("readingList.onEntryUpdated", () => [clone(e)]);
      }),
      onEntryAdded: h.event("readingList.onEntryAdded"),
      onEntryRemoved: h.event("readingList.onEntryRemoved"),
      onEntryUpdated: h.event("readingList.onEntryUpdated")
    };
  }
  function tabGroupsApi(h) {
    const { ext, fn } = h;
    const gs = tabGroupState(ext.shim);
    const get = (id) => {
      const g = gs.groups.get(id);
      if (!g) throw new Error(`No group with id: ${id}.`);
      return g;
    };
    return {
      TAB_GROUP_ID_NONE: -1,
      get: fn((id) => ({ ...get(id) })),
      query: fn((q = {}) => [...gs.groups.values()].filter((g) => Object.keys(q).every((k) => k === "windowId" ? q[k] === -2 || q[k] === g.windowId : g[k] === q[k])).map((g) => ({ ...g }))),
      update: fn((id, p = {}) => {
        const g = get(id);
        for (const k of ["collapsed", "color", "title"]) if (p[k] !== void 0) g[k] = p[k];
        ext.dispatch("tabGroups.onUpdated", () => [{ ...g }]);
        return { ...g };
      }),
      move: fn((id) => {
        const g = get(id);
        ext.dispatch("tabGroups.onMoved", () => [{ ...g }]);
        return { ...g };
      }),
      onCreated: h.event("tabGroups.onCreated"),
      onUpdated: h.event("tabGroups.onUpdated"),
      onMoved: h.event("tabGroups.onMoved"),
      onRemoved: h.event("tabGroups.onRemoved")
    };
  }
  var CI_COLORS = { blue: "#37adff", turquoise: "#00c79a", green: "#51cd00", yellow: "#ffcb00", orange: "#ff9f00", red: "#ff613d", pink: "#ff4bda", purple: "#af51f5", toolbar: "#7c7c7d" };
  function contextualIdentitiesApi(h) {
    const { ext, fn } = h;
    const st = profile(ext, "containers", () => ({
      next: 5,
      list: [["Personal", "blue", "fingerprint"], ["Work", "orange", "briefcase"], ["Banking", "green", "dollar"], ["Shopping", "pink", "cart"]].map(([name, color, icon], i) => ({ cookieStoreId: "firefox-container-" + (i + 1), name, color, icon }))
    }));
    const view = (c) => ({ ...c, colorCode: CI_COLORS[c.color] || "#7c7c7d", iconUrl: `resource://usercontext-content/${c.icon}.svg` });
    const find = (id) => {
      const c = st.data.list.find((x) => x.cookieStoreId === id);
      if (!c) throw new Error(`Invalid contextual identity: ${id}`);
      return c;
    };
    const emit = (ev, c) => ext.dispatch("contextualIdentities." + ev, () => [{ contextualIdentity: view(c) }]);
    return {
      query: fn((d = {}) => st.data.list.filter((c) => d.name == null || c.name === d.name).map(view)),
      get: fn((id) => view(find(id))),
      create: fn((d = {}) => {
        const c = { cookieStoreId: "firefox-container-" + st.data.next++, name: d.name || "", color: d.color || "blue", icon: d.icon || "circle" };
        st.data.list.push(c);
        st.save();
        emit("onCreated", c);
        return view(c);
      }),
      update: fn((id, d = {}) => {
        const c = find(id);
        for (const k of ["name", "color", "icon"]) if (d[k] != null) c[k] = d[k];
        st.save();
        emit("onUpdated", c);
        return view(c);
      }),
      remove: fn((id) => {
        const c = find(id);
        st.data.list = st.data.list.filter((x) => x !== c);
        st.save();
        emit("onRemoved", c);
        return view(c);
      }),
      move: fn((ids, position) => {
        const list = st.data.list;
        const moving = (Array.isArray(ids) ? ids : [ids]).map(find);
        const rest = list.filter((c) => !moving.includes(c));
        const at = position < 0 ? rest.length : Math.min(position, rest.length);
        st.data.list = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
        st.save();
      }),
      onCreated: h.event("contextualIdentities.onCreated"),
      onUpdated: h.event("contextualIdentities.onUpdated"),
      onRemoved: h.event("contextualIdentities.onRemoved")
    };
  }
  var ENGINES = [
    { name: "Google", url: "https://www.google.com/search?q={searchTerms}", alias: "@google", favIconUrl: "https://www.google.com/favicon.ico" },
    { name: "Bing", url: "https://www.bing.com/search?q={searchTerms}", alias: "@bing", favIconUrl: "https://www.bing.com/favicon.ico" },
    { name: "DuckDuckGo", url: "https://duckduckgo.com/?q={searchTerms}", alias: "@ddg", favIconUrl: "https://duckduckgo.com/favicon.ico" },
    { name: "Wikipedia", url: "https://en.wikipedia.org/w/index.php?search={searchTerms}", alias: "@wikipedia", favIconUrl: "https://en.wikipedia.org/favicon.ico" }
  ];
  function searchApi(h) {
    const { ext, fn } = h;
    const engines = () => {
      const opt = ext.options.searchEngine;
      if (!opt) return ENGINES.map((e, i) => ({ ...e, isDefault: i === 0 }));
      const custom = typeof opt === "string" ? { name: "Default", url: opt } : opt;
      return [{ ...custom, isDefault: true }, ...ENGINES.filter((e) => e.name !== custom.name).map((e) => ({ ...e, isDefault: false }))];
    };
    const go = (text, engineName, disposition) => {
      const list = engines();
      const e = engineName && list.find((x) => x.name === engineName) || list.find((x) => x.isDefault);
      if (engineName && e.name !== engineName) throw new Error(`${engineName} was not found`);
      const url = e.url.replace("{searchTerms}", encodeURIComponent(String(text))).replace("%s", encodeURIComponent(String(text)));
      const d = String(disposition || "CURRENT_TAB").toUpperCase();
      if (d === "CURRENT_TAB") setTimeout(() => {
        location.href = url;
      }, 0);
      else window.open(url, "_blank", d === "NEW_WINDOW" ? "noopener,popup" : "noopener");
    };
    return {
      query: fn((q = {}) => go(q.text, null, q.disposition)),
      search: fn((q = {}) => go(q.query, q.engine, q.disposition)),
      get: fn(() => engines().map(({ name, isDefault, alias, favIconUrl }) => ({ name, isDefault, alias, favIconUrl })))
    };
  }
  features.noteClosedTab = noteClosedTab;
  features.importBookmarks = bookmarksImport;
  defineNamespace("bookmarks", bookmarksApi, { perms: ["bookmarks"] });
  defineNamespace("history", historyApi, { perms: ["history"] });
  defineNamespace("topSites", topSitesApi, { perms: ["topSites"] });
  defineNamespace("sessions", sessionsApi, { perms: ["sessions"] });
  defineNamespace("readingList", readingListApi, { perms: ["readingList"] });
  defineNamespace("tabGroups", tabGroupsApi, { perms: ["tabGroups"] });
  defineNamespace("contextualIdentities", contextualIdentitiesApi, { perms: ["contextualIdentities"] });
  defineNamespace("search", searchApi, { perms: ["search"] });

  // src/runtime/api/settings.js
  function chromeSetting(h, key, def) {
    const { ext, fn } = h;
    const internal = ext.storage.internal();
    const sk = "setting:" + key;
    const evKey = "setting." + key + ".onChange";
    const current = () => sk in internal.data ? internal.data[sk] : void 0;
    const details = () => {
      const v = current();
      return { value: v === void 0 ? JSON.parse(JSON.stringify(def)) : v, levelOfControl: v === void 0 ? "controllable_by_this_extension" : "controlled_by_this_extension", incognitoSpecific: false };
    };
    return {
      get: fn(() => details()),
      set: fn(async (d = {}) => {
        if (!("value" in d)) throw new TypeError("Error in invocation of types.ChromeSetting.set: missing 'value'.");
        if (def !== null && typeof def !== "object" && typeof d.value !== typeof def) throw new Error(`Invalid value for setting: expected ${typeof def}.`);
        await internal.set({ [sk]: d.value });
        ext.dispatch(evKey, () => [details()]);
      }),
      clear: fn(async () => {
        await internal.remove(sk);
        ext.dispatch(evKey, () => [details()]);
      }),
      onChange: h.event(evKey)
    };
  }
  function group(h, prefix, defaults) {
    const o = {};
    for (const [k, v] of Object.entries(defaults)) o[k] = chromeSetting(h, `${prefix}.${k}`, v);
    return o;
  }
  var PRIVACY = {
    network: { networkPredictionEnabled: true, webRTCIPHandlingPolicy: "default", peerConnectionEnabled: true, tlsVersionRestriction: { minimum: "TLSv1.2", maximum: "TLSv1.3" }, httpsOnlyMode: "never", globalPrivacyControl: false },
    services: {
      alternateErrorPagesEnabled: true,
      autofillAddressEnabled: true,
      autofillCreditCardEnabled: true,
      autofillEnabled: true,
      passwordSavingEnabled: true,
      safeBrowsingEnabled: true,
      safeBrowsingExtendedReportingEnabled: false,
      searchSuggestEnabled: true,
      spellingServiceEnabled: false,
      translationServiceEnabled: true
    },
    websites: {
      adMeasurementEnabled: true,
      doNotTrackEnabled: false,
      fledgeEnabled: true,
      hyperlinkAuditingEnabled: true,
      protectedContentEnabled: true,
      referrersEnabled: true,
      thirdPartyCookiesAllowed: true,
      topicsEnabled: true,
      relatedWebsiteSetsEnabled: true,
      resistFingerprinting: false,
      firstPartyIsolate: false,
      trackingProtectionMode: "private_browsing",
      cookieConfig: { behavior: "reject_trackers", nonPersistentCookies: false }
    }
  };
  var BROWSER_SETTINGS = {
    allowPopupsForUserEvents: true,
    cacheEnabled: true,
    closeTabsByDoubleClick: false,
    contextMenuShowEvent: "mouseup",
    ftpProtocolEnabled: false,
    homepageOverride: "about:home",
    imageAnimationBehavior: "normal",
    newTabPageOverride: "about:newtab",
    newTabPosition: "afterCurrent",
    openBookmarksInNewTabs: false,
    openSearchResultsInNewTabs: false,
    openUrlbarResultsInNewTabs: false,
    webNotificationsDisabled: false,
    overrideDocumentColors: "high-contrast-only",
    overrideContentColorScheme: "auto",
    useDocumentFonts: true,
    zoomFullPage: true,
    zoomSiteSpecific: true,
    verticalTabs: false
  };
  var ACCESSIBILITY = {
    animationPolicy: "allowed",
    autoclick: false,
    caretHighlight: false,
    cursorColor: false,
    cursorHighlight: false,
    dictation: false,
    dockedMagnifier: false,
    focusHighlight: false,
    highContrast: false,
    largeCursor: false,
    screenMagnifier: false,
    selectToSpeak: false,
    spokenFeedback: false,
    stickyKeys: false,
    switchAccess: false,
    virtualKeyboard: false
  };
  function privacyApi(h) {
    const out = {};
    for (const [g, defs2] of Object.entries(PRIVACY)) out[g] = group(h, "privacy." + g, defs2);
    return out;
  }
  function proxyApi(h) {
    return {
      settings: chromeSetting(h, "proxy.settings", { mode: "system" }),
      onProxyError: h.event("proxy.onProxyError"),
      onError: h.event("proxy.onError"),
      onRequest: h.event("proxy.onRequest")
    };
  }
  function browserSettingsApi(h) {
    const out = group(h, "browserSettings", BROWSER_SETTINGS);
    out.colorManagement = group(h, "browserSettings.colorManagement", { mode: "full", useNativeSRGB: false, useWebRenderCompositor: true });
    return out;
  }
  function accessibilityFeaturesApi(h) {
    const out = group(h, "accessibilityFeatures", ACCESSIBILITY);
    try {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) out.animationPolicy = chromeSetting(h, "accessibilityFeatures.animationPolicy", "none");
    } catch {
    }
    return out;
  }
  var CONTENT_DEFAULTS = {
    automaticDownloads: "ask",
    autoVerify: "allow",
    camera: "ask",
    clipboard: "ask",
    cookies: "allow",
    fullscreen: "allow",
    images: "allow",
    javascript: "allow",
    location: "ask",
    microphone: "ask",
    mouselock: "allow",
    notifications: "ask",
    plugins: "block",
    popups: "block",
    sound: "allow",
    unsandboxedPlugins: "ask"
  };
  function contentPatternToRegExp(p) {
    if (p === "<all_urls>") return /^/;
    const m = /^(?:(\*|[a-z][a-z0-9+.-]*):\/\/)?(\[\*\.\])?([^/:]*)(?::(\*|\d+))?(\/.*)?$/i.exec(p);
    if (!m) throw new Error(`The pattern "${p}" is invalid.`);
    const [, scheme, sub, host, port, path] = m;
    const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    const sch = !scheme || scheme === "*" ? "(?:https?|wss?)" : esc(scheme);
    const hst = host === "*" ? "[^/:]*" : (sub ? "(?:[^/:]*\\.)?" : "") + esc(host);
    const prt = port && port !== "*" ? ":" + port : "(?::\\d+)?";
    return new RegExp(`^${sch}:\\/\\/${hst}${prt}${path ? esc(path) : "(?:\\/.*)?"}$`, "i");
  }
  function contentSetting(h, type) {
    const { ext, fn } = h;
    const internal = ext.storage.internal();
    const sk = "contentSetting:" + type;
    const rules = () => internal.data[sk] || [];
    return {
      get: fn((d = {}) => {
        if (!d.primaryUrl) throw new TypeError("Error in invocation of contentSettings.ContentSetting.get: primaryUrl is required.");
        for (const r of [...rules()].reverse()) {
          if (r.incognito && !d.incognito) continue;
          if ((r.resourceIdentifier || null) !== (d.resourceIdentifier && d.resourceIdentifier.id || null)) continue;
          if (contentPatternToRegExp(r.primaryPattern).test(d.primaryUrl) && (!r.secondaryPattern || !d.secondaryUrl || contentPatternToRegExp(r.secondaryPattern).test(d.secondaryUrl))) return { setting: r.setting };
        }
        return { setting: CONTENT_DEFAULTS[type] };
      }),
      set: fn(async (d = {}) => {
        contentPatternToRegExp(d.primaryPattern);
        if (d.secondaryPattern) contentPatternToRegExp(d.secondaryPattern);
        const list = rules().filter((r) => !(r.primaryPattern === d.primaryPattern && (r.secondaryPattern || "") === (d.secondaryPattern || "")));
        list.push({ primaryPattern: d.primaryPattern, secondaryPattern: d.secondaryPattern || "", setting: d.setting, resourceIdentifier: d.resourceIdentifier && d.resourceIdentifier.id || null, incognito: d.scope === "incognito_session_only" });
        await internal.set({ [sk]: list });
        ext.dispatch(`contentSetting.${type}.onChange`, [{}]);
      }),
      clear: fn(async (d = {}) => {
        await internal.set({ [sk]: d.scope === "incognito_session_only" ? rules().filter((r) => !r.incognito) : [] });
        ext.dispatch(`contentSetting.${type}.onChange`, [{}]);
      }),
      getResourceIdentifiers: fn(() => []),
      onChange: h.event(`contentSetting.${type}.onChange`)
    };
  }
  function contentSettingsApi(h) {
    const out = {};
    for (const t of Object.keys(CONTENT_DEFAULTS)) out[t] = contentSetting(h, t);
    return out;
  }
  var FONT_DEFAULTS = { standard: "Times New Roman", sansserif: "Arial", serif: "Times New Roman", fixed: "Courier New", cursive: "Comic Sans MS", fantasy: "Impact", math: "Cambria Math" };
  var COMMON_FONTS = [
    "Arial",
    "Arial Black",
    "Avenir",
    "Cambria",
    "Cambria Math",
    "Comic Sans MS",
    "Consolas",
    "Courier New",
    "Georgia",
    "Helvetica",
    "Helvetica Neue",
    "Impact",
    "Inter",
    "Lucida Console",
    "Menlo",
    "Monaco",
    "Noto Sans",
    "Noto Serif",
    "Roboto",
    "Roboto Mono",
    "Segoe UI",
    "SF Pro Text",
    "Tahoma",
    "Times New Roman",
    "Trebuchet MS",
    "Ubuntu",
    "Verdana",
    "DejaVu Sans",
    "DejaVu Serif",
    "DejaVu Sans Mono",
    "Liberation Sans",
    "Liberation Serif",
    "Liberation Mono"
  ];
  function fontSettingsApi(h) {
    const { ext, fn } = h;
    const internal = ext.storage.internal();
    const key = (d) => `font:${d.genericFamily}:${d.script || "Zyyy"}`;
    const level = (k) => k in internal.data ? "controlled_by_this_extension" : "controllable_by_this_extension";
    const size = (name, def) => ({
      [`get${name}`]: fn(() => ({ pixelSize: internal.data["font:" + name] ?? def, levelOfControl: level("font:" + name) })),
      [`set${name}`]: fn(async (d = {}) => {
        await internal.set({ ["font:" + name]: d.pixelSize });
        ext.dispatch(`fontSettings.on${name}Changed`, [{ pixelSize: d.pixelSize, levelOfControl: "controlled_by_this_extension" }]);
      }),
      [`clear${name}`]: fn(async () => {
        await internal.remove("font:" + name);
        ext.dispatch(`fontSettings.on${name}Changed`, [{ pixelSize: def, levelOfControl: "controllable_by_this_extension" }]);
      }),
      [`on${name}Changed`]: h.event(`fontSettings.on${name}Changed`)
    });
    return {
      getFont: fn((d = {}) => ({ fontId: internal.data[key(d)] ?? FONT_DEFAULTS[d.genericFamily] ?? "", levelOfControl: level(key(d)) })),
      setFont: fn(async (d = {}) => {
        await internal.set({ [key(d)]: d.fontId });
        ext.dispatch("fontSettings.onFontChanged", [{ fontId: d.fontId, genericFamily: d.genericFamily, script: d.script, levelOfControl: "controlled_by_this_extension" }]);
      }),
      clearFont: fn(async (d = {}) => {
        await internal.remove(key(d));
        ext.dispatch("fontSettings.onFontChanged", [{ fontId: FONT_DEFAULTS[d.genericFamily] || "", genericFamily: d.genericFamily, script: d.script, levelOfControl: "controllable_by_this_extension" }]);
      }),
      getFontList: fn(async () => {
        let names = COMMON_FONTS;
        try {
          if (document.fonts && document.fonts.check) names = COMMON_FONTS.filter((f) => document.fonts.check(`12px "${f}"`));
        } catch {
        }
        return names.map((f) => ({ fontId: f, displayName: f }));
      }),
      ...size("DefaultFontSize", 16),
      ...size("DefaultFixedFontSize", 13),
      ...size("MinimumFontSize", 0),
      onFontChanged: h.event("fontSettings.onFontChanged")
    };
  }
  defineNamespace("privacy", privacyApi, { perms: ["privacy"] });
  defineNamespace("proxy", proxyApi, { perms: ["proxy"] });
  defineNamespace("browserSettings", browserSettingsApi, { perms: ["browserSettings"] });
  defineNamespace("accessibilityFeatures", accessibilityFeaturesApi, { perms: ["accessibilityFeatures.read", "accessibilityFeatures.modify"] });
  defineNamespace("contentSettings", contentSettingsApi, { perms: ["contentSettings"] });
  defineNamespace("fontSettings", fontSettingsApi, { perms: ["fontSettings"] });

  // src/runtime/interceptor.js
  var K2 = /* @__PURE__ */ Symbol("extshim-xhr");
  var nativeToString = (name) => () => `function ${name}() { [native code] }`;
  function headersToArray(h) {
    const out = [];
    if (!h) return out;
    if (typeof h.forEach === "function" && !Array.isArray(h)) h.forEach((value, name) => out.push({ name, value }));
    else if (Array.isArray(h)) for (const x of h) out.push(Array.isArray(x) ? { name: x[0], value: x[1] } : { name: x.name, value: x.value });
    else for (const k of Object.keys(h)) out.push({ name: k, value: String(h[k]) });
    return out;
  }
  function arrayToHeaders(arr) {
    const h = new Headers();
    for (const x of arr || []) {
      try {
        h.append(x.name, x.value != null ? x.value : x.binaryValue ? new TextDecoder().decode(new Uint8Array(x.binaryValue)) : "");
      } catch {
      }
    }
    return h;
  }
  function parseRawHeaders(raw) {
    return String(raw || "").trim().split(/\r?\n/).filter(Boolean).map((l) => {
      const i = l.indexOf(":");
      return { name: l.slice(0, i).trim(), value: l.slice(i + 1).trim() };
    });
  }
  var INITIATOR_TYPES = { img: "image", image: "image", script: "script", link: "stylesheet", css: "image", iframe: "sub_frame", frame: "sub_frame", video: "media", audio: "media", track: "media", beacon: "ping", ping: "ping", embed: "object", object: "object", font: "font", navigation: "main_frame", other: "other", "icon": "image" };
  function getInterceptor(shim) {
    if (!shim.net) shim.net = new Interceptor(shim);
    return shim.net;
  }
  var Interceptor = class _Interceptor {
    constructor(shim) {
      this.shim = shim;
      this.clients = /* @__PURE__ */ new Set();
      this.nextId = 1;
      this.installed = false;
      this.log = [];
      this.seen = /* @__PURE__ */ new Set();
      this.listeners = /* @__PURE__ */ new Set();
    }
    addClient(client) {
      this.clients.add(client);
      this.install();
      return () => this.clients.delete(client);
    }
    active() {
      return this.clients.size > 0;
    }
    base(url, method, type) {
      let thirdParty = false;
      try {
        thirdParty = new URL(url).hostname.split(".").slice(-2).join(".") !== location.hostname.split(".").slice(-2).join(".");
      } catch {
      }
      return {
        requestId: String(this.nextId++),
        url,
        method: String(method || "GET").toUpperCase(),
        frameId: 0,
        parentFrameId: -1,
        tabId: this.shim.tabId,
        windowId: this.shim.windowId,
        type,
        timeStamp: Date.now(),
        initiator: location.origin,
        originUrl: location.href,
        documentUrl: location.href,
        documentLifecycle: "active",
        frameType: "outermost_frame",
        incognito: false,
        thirdParty,
        cookieStoreId: "firefox-default",
        urlClassification: { firstParty: [], thirdParty: [] },
        frameAncestors: []
      };
    }
    static combine(out, r, d) {
      if (!r) return;
      if (r.cancel) out.cancel = true;
      if (r.upgradeToSecure && !out.redirectUrl) out.redirectUrl = d.url.replace(/^http:/, "https:").replace(/^ws:/, "wss:");
      if (r.redirectUrl) out.redirectUrl = r.redirectUrl;
      if (r.requestHeaders) {
        out.requestHeaders = r.requestHeaders;
        d.requestHeaders = r.requestHeaders;
      }
      if (r.responseHeaders) {
        out.responseHeaders = r.responseHeaders;
        d.responseHeaders = r.responseHeaders;
      }
      if (r.filters) (out.filters = out.filters || []).push(...r.filters);
      if (r.authCredentials) out.authCredentials = r.authCredentials;
    }
    async decide(stage, d) {
      const out = {};
      for (const c of [...this.clients]) {
        let r;
        try {
          r = c.decide(stage, d, false);
          if (r && typeof r.then === "function") r = await r;
        } catch (e) {
          c.ext.log.error(`webRequest ${stage}:`, e);
        }
        _Interceptor.combine(out, r, d);
        if (out.cancel) break;
      }
      return out;
    }
    decideSync(stage, d) {
      const out = {};
      for (const c of [...this.clients]) {
        let r;
        try {
          r = c.decide(stage, d, true);
        } catch (e) {
          c.ext.log.error(`webRequest ${stage}:`, e);
        }
        if (r && typeof r.then === "function") continue;
        _Interceptor.combine(out, r, d);
        if (out.cancel) break;
      }
      return out;
    }
    notify(event, d) {
      for (const c of [...this.clients]) {
        try {
          c.notify(event, d);
        } catch (e) {
          c.ext.log.error(e);
        }
      }
      if (event === "onCompleted" || event === "onErrorOccurred") {
        const entry = { ...d, event, endTime: Date.now() };
        this.log.push(entry);
        if (this.log.length > 1e3) this.log.shift();
        for (const fn of this.listeners) {
          try {
            fn(entry);
          } catch {
          }
        }
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
      const self2 = this;
      const nativeFetch = this.shim.nativeFetch;
      const f = function fetch2(input, init) {
        return self2.handleFetch(nativeFetch, input, init);
      };
      Object.defineProperty(f, "toString", { value: nativeToString("fetch") });
      try {
        window.fetch = f;
      } catch {
      }
    }
    async handleFetch(nativeFetch, input, init, depth = 0) {
      if (!this.active()) return nativeFetch(input, init);
      let req;
      try {
        req = new Request(input, init);
      } catch {
        return nativeFetch(input, init);
      }
      if (!/^(https?):/i.test(req.url)) return nativeFetch(req);
      const d = this.base(req.url, req.method, "xmlhttprequest");
      d.requestHeaders = headersToArray(req.headers);
      if (init && typeof init.body === "string") d.requestBody = { raw: [{ bytes: new TextEncoder().encode(init.body).buffer }] };
      else if (init && init.body instanceof URLSearchParams) d.requestBody = { formData: Object.fromEntries([...init.body].map(([k, v]) => [k, [v]])) };
      else if (init && typeof FormData !== "undefined" && init.body instanceof FormData) {
        const fd = {};
        for (const [k, v] of init.body) (fd[k] = fd[k] || []).push(typeof v === "string" ? v : v.name);
        d.requestBody = { formData: fd };
      }
      const fail = (error) => {
        this.notify("onErrorOccurred", { ...d, error, fromCache: false });
        return new TypeError("Failed to fetch");
      };
      const r1 = await this.decide("beforeRequest", d);
      if (r1.cancel) throw fail("net::ERR_BLOCKED_BY_CLIENT");
      let url = req.url;
      if (r1.redirectUrl && r1.redirectUrl !== url) {
        this.notify("onBeforeRedirect", { ...d, redirectUrl: r1.redirectUrl, statusCode: 307, statusLine: "HTTP/1.1 307 Internal Redirect", fromCache: false, responseHeaders: [] });
        url = r1.redirectUrl;
        d.url = url;
      }
      const r2 = await this.decide("beforeSendHeaders", d);
      if (r2.cancel) throw fail("net::ERR_BLOCKED_BY_CLIENT");
      const headers = r2.requestHeaders ? arrayToHeaders(r2.requestHeaders) : req.headers;
      this.notify("onSendHeaders", { ...d, requestHeaders: headersToArray(headers) });
      let res;
      try {
        if (url === req.url && !r2.requestHeaders) res = await nativeFetch(req);
        else {
          const hasBody = req.method !== "GET" && req.method !== "HEAD" && req.body;
          res = await nativeFetch(new Request(url, {
            method: req.method,
            headers,
            body: hasBody ? req.body : void 0,
            mode: req.mode === "navigate" ? "cors" : req.mode,
            credentials: req.credentials,
            cache: req.cache,
            redirect: req.redirect,
            referrer: req.referrer,
            referrerPolicy: req.referrerPolicy,
            integrity: req.integrity,
            keepalive: req.keepalive,
            signal: req.signal,
            ...hasBody ? { duplex: "half" } : {}
          }));
        }
      } catch (e) {
        this.notify("onErrorOccurred", { ...d, error: e && e.name === "AbortError" ? "net::ERR_ABORTED" : "net::ERR_FAILED", fromCache: false });
        throw e;
      }
      const rd = { ...d, statusCode: res.status, statusLine: `HTTP/1.1 ${res.status} ${res.statusText}`.trim(), responseHeaders: headersToArray(res.headers), fromCache: false, ip: void 0 };
      const r3 = await this.decide("headersReceived", rd);
      if (r3.cancel) throw fail("net::ERR_BLOCKED_BY_CLIENT");
      if (r3.redirectUrl && depth < 5) {
        this.notify("onBeforeRedirect", { ...rd, redirectUrl: r3.redirectUrl });
        return this.handleFetch(nativeFetch, r3.redirectUrl, { method: "GET", credentials: req.credentials, signal: req.signal }, depth + 1);
      }
      let filters = r1.filters || [];
      if (r3.responseHeaders || filters.length) res = rebuild(res, r3.responseHeaders ? arrayToHeaders(r3.responseHeaders) : null, filters);
      this.notify("onResponseStarted", rd);
      this.notify("onCompleted", rd);
      return res;
    }
    patchXHR() {
      const self2 = this;
      const P = XMLHttpRequest.prototype;
      const oOpen = P.open, oSend = P.send, oSet = P.setRequestHeader;
      P.open = function open(method, url, async, user, password) {
        let abs = String(url);
        try {
          abs = new URL(abs, location.href).href;
        } catch {
        }
        this[K2] = { method: String(method).toUpperCase(), url: abs, async: arguments.length < 3 || async !== false, user, password, headers: [] };
        return oOpen.apply(this, arguments);
      };
      P.setRequestHeader = function setRequestHeader(name, value) {
        if (this[K2]) this[K2].headers.push({ name: String(name), value: String(value) });
        return oSet.call(this, name, value);
      };
      P.send = function send(body) {
        const st = this[K2];
        if (!st || !self2.active() || !/^https?:/i.test(st.url)) return oSend.call(this, body);
        const xhr = this;
        const d = self2.base(st.url, st.method, "xmlhttprequest");
        d.requestHeaders = st.headers.slice();
        if (typeof body === "string") d.requestBody = { raw: [{ bytes: new TextEncoder().encode(body).buffer }] };
        const failed = () => {
          self2.notify("onErrorOccurred", { ...d, error: "net::ERR_BLOCKED_BY_CLIENT", fromCache: false });
          for (const [k, v] of [["readyState", 4], ["status", 0], ["statusText", ""], ["responseText", ""], ["response", xhr.responseType === "" || xhr.responseType === "text" ? "" : null]]) {
            try {
              Object.defineProperty(xhr, k, { value: v, configurable: true });
            } catch {
            }
          }
          setTimeout(() => {
            xhr.dispatchEvent(new Event("readystatechange"));
            xhr.dispatchEvent(new ProgressEvent("error"));
            xhr.dispatchEvent(new ProgressEvent("loadend"));
          }, 0);
        };
        const watch = () => {
          xhr.addEventListener("readystatechange", () => {
            if (xhr.readyState !== 2) return;
            const hd = { ...d, statusCode: xhr.status, statusLine: `HTTP/1.1 ${xhr.status} ${xhr.statusText}`.trim(), responseHeaders: parseRawHeaders(xhr.getAllResponseHeaders()) };
            const r = self2.decideSync("headersReceived", hd);
            if (r.cancel) {
              xhr.abort();
              return;
            }
            if (r.responseHeaders) {
              const map = r.responseHeaders;
              xhr.getAllResponseHeaders = () => map.map((x) => `${x.name.toLowerCase()}: ${x.value}`).join("\r\n") + "\r\n";
              xhr.getResponseHeader = (n) => {
                const v = map.filter((x) => x.name.toLowerCase() === String(n).toLowerCase()).map((x) => x.value);
                return v.length ? v.join(", ") : null;
              };
            }
            self2.notify("onResponseStarted", hd);
          });
          xhr.addEventListener("loadend", () => {
            const rd = { ...d, statusCode: xhr.status, statusLine: `HTTP/1.1 ${xhr.status} ${xhr.statusText}`.trim(), responseHeaders: parseRawHeaders(xhr.getAllResponseHeaders()), fromCache: false };
            if (xhr.status === 0) self2.notify("onErrorOccurred", { ...rd, error: "net::ERR_FAILED" });
            else self2.notify("onCompleted", rd);
          }, { once: true });
        };
        const proceed = (url, headers) => {
          if (url !== st.url || headers) {
            oOpen.call(xhr, st.method, url, st.async, st.user, st.password);
            for (const x of headers || st.headers) {
              try {
                oSet.call(xhr, x.name, x.value);
              } catch {
              }
            }
          }
          self2.notify("onSendHeaders", { ...d, url, requestHeaders: headers || st.headers });
          watch();
          try {
            oSend.call(xhr, body);
          } catch (e) {
            if (!st.async) throw e;
          }
        };
        if (!st.async) {
          const r1 = self2.decideSync("beforeRequest", d);
          if (r1.cancel) {
            failed();
            throw new DOMException("Failed to execute 'send' on 'XMLHttpRequest': Failed to load.", "NetworkError");
          }
          const url = r1.redirectUrl || st.url;
          const r2 = self2.decideSync("beforeSendHeaders", { ...d, url });
          if (r2.cancel) {
            failed();
            throw new DOMException("Network error", "NetworkError");
          }
          return proceed(url, r2.requestHeaders);
        }
        (async () => {
          const r1 = await self2.decide("beforeRequest", d);
          if (r1.cancel) return failed();
          let url = st.url;
          if (r1.redirectUrl && r1.redirectUrl !== url) {
            self2.notify("onBeforeRedirect", { ...d, redirectUrl: r1.redirectUrl, statusCode: 307, statusLine: "HTTP/1.1 307 Internal Redirect" });
            url = r1.redirectUrl;
            d.url = url;
          }
          const r2 = await self2.decide("beforeSendHeaders", d);
          if (r2.cancel) return failed();
          if (xhr.readyState !== 1) return;
          proceed(url, r2.requestHeaders);
        })();
      };
    }
    patchBeaconAndSockets() {
      const self2 = this;
      if (navigator.sendBeacon) {
        const o = navigator.sendBeacon.bind(navigator);
        const f = function sendBeacon(url, data) {
          if (!self2.active()) return o(url, data);
          let abs = String(url);
          try {
            abs = new URL(abs, location.href).href;
          } catch {
            return o(url, data);
          }
          const d = self2.base(abs, "POST", "ping");
          const r = self2.decideSync("beforeRequest", d);
          if (r.cancel) {
            self2.notify("onErrorOccurred", { ...d, error: "net::ERR_BLOCKED_BY_CLIENT" });
            return true;
          }
          self2.notify("onCompleted", { ...d, statusCode: 200, fromCache: false });
          return o(r.redirectUrl || abs, data);
        };
        Object.defineProperty(f, "toString", { value: nativeToString("sendBeacon") });
        try {
          Navigator.prototype.sendBeacon = f;
        } catch {
        }
      }
      if (window.WebSocket) {
        const WS = window.WebSocket;
        const Wrapped = function WebSocket(url, protocols) {
          if (!new.target) throw new TypeError("Failed to construct 'WebSocket': Please use the 'new' operator.");
          let abs = String(url);
          try {
            abs = new URL(abs, location.href).href.replace(/^http/, "ws");
          } catch {
          }
          if (self2.active()) {
            const d = self2.base(abs, "GET", "websocket");
            const r = self2.decideSync("beforeRequest", d);
            if (r.cancel) {
              self2.notify("onErrorOccurred", { ...d, error: "net::ERR_BLOCKED_BY_CLIENT" });
              const ws = Reflect.construct(WS, ["wss://blocked.invalid/"], new.target);
              return ws;
            }
            if (r.redirectUrl) abs = r.redirectUrl;
          }
          return protocols === void 0 ? Reflect.construct(WS, [abs], new.target) : Reflect.construct(WS, [abs, protocols], new.target);
        };
        Wrapped.prototype = WS.prototype;
        Object.setPrototypeOf(Wrapped, WS);
        Object.defineProperty(Wrapped, "toString", { value: nativeToString("WebSocket") });
        try {
          window.WebSocket = Wrapped;
        } catch {
        }
      }
    }
    isOurs(el2) {
      if (!el2 || el2.hasAttribute && el2.hasAttribute("data-extshim")) return true;
      try {
        const root = el2.getRootNode && el2.getRootNode();
        return !!root && root === (this.shim.ui && this.shim.ui.shadow);
      } catch {
        return false;
      }
    }
    /** Decide on a URL a script assigns to a resource attribute. Returns null (ok), false (block) or a new URL. */
    elementDecision(el2, value, type) {
      if (!this.active() || this.isOurs(el2)) return null;
      let abs;
      try {
        abs = new URL(String(value), document.baseURI).href;
      } catch {
        return null;
      }
      if (!/^https?:/i.test(abs)) return null;
      const d = this.base(abs, "GET", type);
      const r = this.decideSync("beforeRequest", d);
      this.seen.add(abs);
      if (r.cancel) {
        this.notify("onErrorOccurred", { ...d, error: "net::ERR_BLOCKED_BY_CLIENT", fromCache: false });
        setTimeout(() => {
          try {
            el2.dispatchEvent(new Event("error"));
          } catch {
          }
        }, 0);
        return false;
      }
      if (r.redirectUrl) {
        this.seen.add(r.redirectUrl);
        return r.redirectUrl;
      }
      return null;
    }
    patchElements() {
      const self2 = this;
      const linkType = (el2) => {
        const rel = (el2.getAttribute("rel") || "").toLowerCase();
        if (rel.includes("stylesheet")) return "stylesheet";
        if (rel.includes("icon")) return "image";
        const as = (el2.getAttribute("as") || "").toLowerCase();
        return { script: "script", style: "stylesheet", font: "font", image: "image", fetch: "xmlhttprequest" }[as] || "other";
      };
      const targets = [
        ["HTMLScriptElement", "src", () => "script"],
        ["HTMLImageElement", "src", () => "image"],
        ["HTMLIFrameElement", "src", () => "sub_frame"],
        ["HTMLFrameElement", "src", () => "sub_frame"],
        ["HTMLLinkElement", "href", linkType],
        ["HTMLSourceElement", "src", () => "media"],
        ["HTMLMediaElement", "src", () => "media"],
        ["HTMLEmbedElement", "src", () => "object"],
        ["HTMLObjectElement", "data", () => "object"],
        ["HTMLTrackElement", "src", () => "media"],
        ["HTMLInputElement", "src", () => "image"]
      ];
      const byTag = /* @__PURE__ */ new Map();
      for (const [cls, attr, typeOf] of targets) {
        const C = window[cls];
        if (!C) continue;
        const desc = Object.getOwnPropertyDescriptor(C.prototype, attr);
        if (!desc || !desc.set) continue;
        byTag.set(cls, [attr, typeOf]);
        Object.defineProperty(C.prototype, attr, {
          ...desc,
          set(v) {
            const r = self2.elementDecision(this, v, typeOf(this));
            if (r === false) {
              if (this instanceof HTMLIFrameElement) desc.set.call(this, "about:blank");
              return;
            }
            desc.set.call(this, r || v);
          }
        });
      }
      const attrOf = (el2) => {
        for (const [cls, [attr, typeOf]] of byTag) {
          const C = window[cls];
          if (C && el2 instanceof C) return [attr, typeOf];
        }
        return null;
      };
      const oSet = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function setAttribute(name, value) {
        const a = attrOf(this);
        if (a && String(name).toLowerCase() === a[0]) {
          const r = self2.elementDecision(this, value, a[1](this));
          if (r === false) return void 0;
          if (r) value = r;
        }
        return oSet.call(this, name, value);
      };
      Object.defineProperty(Element.prototype.setAttribute, "toString", { value: nativeToString("setAttribute") });
      const mo = new MutationObserver((muts) => {
        if (!self2.active()) return;
        for (const m of muts) for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          const els = [n, ...n.querySelectorAll ? n.querySelectorAll("img[src],script[src],iframe[src],link[href],video[src],audio[src],source[src],embed[src],object[data]") : []];
          for (const el2 of els) {
            const a = attrOf(el2);
            if (!a || self2.isOurs(el2)) continue;
            const v = el2.getAttribute(a[0]);
            if (!v) continue;
            let abs;
            try {
              abs = new URL(v, document.baseURI).href;
            } catch {
              continue;
            }
            if (self2.seen.has(abs)) continue;
            const r = self2.elementDecision(el2, v, a[1](el2));
            if (r === false) {
              if (el2.localName === "iframe") el2.src = "about:blank";
              else if (el2.localName === "img") {
                el2.removeAttribute("srcset");
                oSet.call(el2, "src", "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=");
              } else el2.remove();
            } else if (r) oSet.call(el2, a[0], r);
          }
        }
      });
      const start = () => mo.observe(document.documentElement, { childList: true, subtree: true });
      if (document.documentElement) start();
      else document.addEventListener("readystatechange", start, { once: true });
      document.addEventListener("click", (e) => {
        if (!self2.active() || e.defaultPrevented || e.button !== 0) return;
        const a = e.composedPath().find((x) => x && x.localName === "a" && x.href);
        if (!a || self2.isOurs(a) || !/^https?:/i.test(a.href)) return;
        const d = self2.base(a.href, "GET", "main_frame");
        const r = self2.decideSync("beforeRequest", d);
        if (r.cancel) {
          e.preventDefault();
          self2.notify("onErrorOccurred", { ...d, error: "net::ERR_BLOCKED_BY_CLIENT" });
        } else if (r.redirectUrl) {
          e.preventDefault();
          if (a.target === "_blank") window.open(r.redirectUrl, "_blank", "noopener");
          else location.href = r.redirectUrl;
        }
      }, true);
    }
    observeResources() {
      if (typeof PerformanceObserver !== "function") return;
      const report = (e) => {
        if (e.initiatorType === "fetch" || e.initiatorType === "xmlhttprequest" || !/^https?:/.test(e.name)) return;
        const type = INITIATOR_TYPES[e.initiatorType] || "other";
        const d = this.base(e.name, "GET", type);
        d.timeStamp = Math.round(performance.timeOrigin + e.startTime);
        if (!this.seen.has(e.name)) this.notify("onBeforeRequest", d);
        this.seen.delete(e.name);
        const rd = { ...d, statusCode: e.responseStatus || 200, statusLine: `HTTP/1.1 ${e.responseStatus || 200}`, fromCache: e.transferSize === 0 && e.decodedBodySize > 0, responseHeaders: [] };
        this.notify("onResponseStarted", rd);
        this.notify("onCompleted", rd);
      };
      try {
        new PerformanceObserver((list) => list.getEntries().forEach(report)).observe({ type: "resource" });
      } catch {
      }
      try {
        for (const e of performance.getEntriesByType("resource")) {
          this.log.push({ ...this.base(e.name, "GET", INITIATOR_TYPES[e.initiatorType] || "other"), event: "onCompleted", statusCode: e.responseStatus || 200, timeStamp: Math.round(performance.timeOrigin + e.startTime), endTime: Math.round(performance.timeOrigin + e.responseEnd), size: e.decodedBodySize });
        }
      } catch {
      }
    }
  };
  function rebuild(res, headers, filters) {
    if (res.type === "opaque" || res.type === "opaqueredirect" || res.status === 0) return res;
    let body = res.body;
    const h = new Headers(headers || res.headers);
    if (filters.length && body) {
      for (const f of filters) body = f._pipe(body);
      h.delete("content-length");
      h.delete("content-encoding");
    }
    const out = new Response(res.status === 204 || res.status === 304 ? null : body, { status: res.status, statusText: res.statusText, headers: h });
    for (const k of ["url", "redirected", "type"]) {
      try {
        Object.defineProperty(out, k, { value: res[k] });
      } catch {
      }
    }
    return out;
  }
  var StreamFilter = class {
    constructor(requestId) {
      this.requestId = requestId;
      this.status = "uninitialized";
      this.error = "";
      this.ondata = null;
      this.onstart = null;
      this.onstop = null;
      this.onerror = null;
      this._ctrl = null;
      this._closed = false;
      this._disconnected = false;
    }
    _pipe(src) {
      const f = this;
      return new ReadableStream({
        async start(ctrl) {
          f._ctrl = ctrl;
          f.status = "transferringdata";
          try {
            if (f.onstart) f.onstart({});
          } catch (e) {
            console.error(e);
          }
          const reader = src.getReader();
          try {
            for (; ; ) {
              const { done, value } = await reader.read();
              if (done) break;
              if (f._disconnected || !f.ondata) {
                if (!f._closed) ctrl.enqueue(value);
                continue;
              }
              const data = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
              try {
                f.ondata({ data });
              } catch (e) {
                console.error(e);
              }
            }
            f.status = "finishedtransferringdata";
            if (f.onstop && !f._disconnected) {
              try {
                f.onstop({});
              } catch (e) {
                console.error(e);
              }
            }
            if (!f.onstop || f._disconnected) f.close();
          } catch (e) {
            f.status = "failed";
            f.error = String(e);
            if (f.onerror) f.onerror({});
            try {
              ctrl.error(e);
            } catch {
            }
          }
        }
      });
    }
    write(data) {
      if (this._closed || !this._ctrl) throw new Error("StreamFilter is not ready for writing");
      const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      this._ctrl.enqueue(bytes);
    }
    close() {
      if (this._closed) return;
      this._closed = true;
      this.status = "closed";
      try {
        this._ctrl && this._ctrl.close();
      } catch {
      }
    }
    disconnect() {
      this._disconnected = true;
      this.status = "disconnected";
    }
    suspend() {
      this.status = "suspended";
    }
    resume() {
      this.status = "transferringdata";
    }
  };

  // src/runtime/psl.js
  var MULTI = new Set(`
ac.uk co.uk gov.uk ltd.uk me.uk net.uk nhs.uk org.uk plc.uk police.uk sch.uk
com.au net.au org.au edu.au gov.au asn.au id.au co.nz net.nz org.nz govt.nz ac.nz
co.jp ne.jp or.jp ac.jp go.jp gr.jp ed.jp lg.jp co.kr or.kr ne.kr go.kr ac.kr re.kr
com.br net.br org.br gov.br edu.br com.mx org.mx gob.mx edu.mx com.ar gob.ar com.co gov.co com.pe
com.cn net.cn org.cn gov.cn edu.cn ac.cn com.hk org.hk gov.hk edu.hk com.tw org.tw gov.tw edu.tw idv.tw
com.sg edu.sg gov.sg org.sg com.my gov.my edu.my co.id or.id go.id ac.id co.th go.th ac.th in.th
co.in net.in org.in gov.in ac.in edu.in res.in firm.in gen.in ind.in com.pk gov.pk edu.pk com.bd
co.za org.za gov.za ac.za com.ng gov.ng com.eg gov.eg co.ke or.ke ac.ke co.il org.il gov.il ac.il
com.tr gov.tr edu.tr org.tr com.sa gov.sa com.ua gov.ua org.ua com.ru gov.ru net.ru org.ru
co.at or.at gv.at com.pl net.pl org.pl gov.pl com.es org.es gob.es com.pt gov.pt com.gr
github.io gitlab.io pages.dev workers.dev vercel.app netlify.app herokuapp.com web.app firebaseapp.com
appspot.com blogspot.com azurewebsites.net cloudfront.net amazonaws.com s3.amazonaws.com fly.dev
onrender.com glitch.me repl.co surge.sh now.sh ngrok.io ngrok-free.app github.dev codesandbox.io
`.split(/\s+/).filter(Boolean));
  function isIp(host) {
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
  }
  function publicSuffix(host) {
    host = String(host || "").toLowerCase().replace(/\.$/, "");
    if (!host || isIp(host) || !host.includes(".")) return "";
    const labels = host.split(".");
    for (let n = Math.min(3, labels.length - 1); n >= 2; n--) {
      const s = labels.slice(-n).join(".");
      if (MULTI.has(s)) return s;
    }
    return labels[labels.length - 1];
  }
  function registrableDomain(host) {
    host = String(host || "").toLowerCase().replace(/\.$/, "");
    const suffix = publicSuffix(host);
    if (!suffix || host === suffix) return host;
    const rest = host.slice(0, -suffix.length - 1).split(".");
    return rest[rest.length - 1] + "." + suffix;
  }

  // src/runtime/api/network-apis.js
  var WR_EVENTS = ["onBeforeRequest", "onBeforeSendHeaders", "onSendHeaders", "onHeadersReceived", "onAuthRequired", "onResponseStarted", "onBeforeRedirect", "onCompleted", "onErrorOccurred", "onActionIgnored"];
  var STAGE_EVENT = { beforeRequest: "onBeforeRequest", beforeSendHeaders: "onBeforeSendHeaders", headersReceived: "onHeadersReceived" };
  var hostOf = (u) => {
    try {
      return new URL(u).hostname.toLowerCase();
    } catch {
      return "";
    }
  };
  var domainMatch = (host, list) => list.some((d) => host === d || host.endsWith("." + d));
  var ACTION_RANK = { allow: 0, allowAllRequests: 1, block: 2, upgradeScheme: 3, redirect: 4, modifyHeaders: 5 };
  var ALL_TYPES = ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object", "xmlhttprequest", "ping", "csp_report", "media", "websocket", "webtransport", "webbundle", "other"];
  function urlFilterToRegExp(filter, caseSensitive = false) {
    let s = String(filter);
    let prefix = "";
    let suffix = "";
    if (s.startsWith("||")) {
      prefix = "^[a-z][a-z0-9+.-]*:\\/\\/(?:[^/?#@]*@)?(?:[^/?#:]*\\.)?";
      s = s.slice(2);
    } else if (s.startsWith("|")) {
      prefix = "^";
      s = s.slice(1);
    }
    if (s.endsWith("|") && !s.endsWith("\\|")) {
      suffix = "$";
      s = s.slice(0, -1);
    }
    let body = "";
    for (const ch of s) body += ch === "*" ? ".*" : ch === "^" ? "(?:[^A-Za-z0-9_\\-.%]|$)" : ch.replace(/[.+?${}()|[\]\\/]/g, "\\$&");
    return new RegExp(prefix + body + suffix, caseSensitive ? "" : "i");
  }
  function validateRule(r) {
    if (!r || !Number.isInteger(r.id) || r.id < 1) throw new Error("Rule with id must have a positive integer id.");
    if (!r.action || !Object.hasOwn(ACTION_RANK, r.action.type)) throw new Error(`Rule with id ${r.id} specifies an invalid action type.`);
    if (r.condition && r.condition.regexFilter) {
      try {
        new RegExp(r.condition.regexFilter);
      } catch {
        throw new Error(`Rule with id ${r.id} specified a non-ascii or invalid regexFilter.`);
      }
    }
    if (r.action.type === "redirect" && !r.action.redirect) throw new Error(`Rule with id ${r.id} does not specify the value for "action.redirect" key.`);
  }
  var DNR = class {
    constructor(ext) {
      this.ext = ext;
      this.internal = ext.storage.internal();
      this.static = /* @__PURE__ */ new Map();
      this.dynamic = this.internal.data["dnr:dynamic"] || [];
      this.session = [];
      this.disabled = this.internal.data["dnr:disabled"] || {};
      this.matched = [];
      this.badge = { enabled: false, counts: /* @__PURE__ */ new Map() };
      this.compiled = [];
      this.ready = this.load();
    }
    async load() {
      const res = (this.ext.manifest.declarative_net_request || {}).rule_resources || [];
      const enabledOverride = this.internal.data["dnr:enabled"];
      for (const r of res) {
        let rules = [];
        const t = await this.ext.vfs.text(normalizePath(r.path));
        if (t) {
          try {
            rules = parseJSONC(t);
          } catch (e) {
            this.ext.log.warn(`declarative_net_request ${r.path}:`, e.message);
          }
        }
        this.static.set(r.id, { rules: Array.isArray(rules) ? rules : [], enabled: enabledOverride ? enabledOverride.includes(r.id) : r.enabled !== false });
      }
      this.compile();
    }
    compile() {
      const list = [];
      const add = (rules, rulesetId, rank) => {
        for (const rule of rules) {
          try {
            list.push(compileRule(rule, rulesetId, rank));
          } catch (e) {
            this.ext.log.warn(`Invalid rule ${rule && rule.id} in ${rulesetId}:`, e.message);
          }
        }
      };
      add(this.session, "_session", 0);
      add(this.dynamic, "_dynamic", 1);
      for (const [id, set] of this.static) {
        if (!set.enabled) continue;
        const off = new Set(this.disabled[id] || []);
        add(set.rules.filter((r) => !off.has(r.id)), id, 2);
      }
      list.sort((a, b) => b.priority - a.priority || ACTION_RANK[a.type] - ACTION_RANK[b.type] || a.rank - b.rank);
      this.compiled = list;
      this.pageAllow = null;
      const page = { url: location.href, type: "main_frame", method: "GET", initiator: null, tabId: this.ext.shim.tabId };
      for (const c of list) if (c.type === "allowAllRequests" && c.test(page)) {
        this.pageAllow = c;
        break;
      }
    }
    match(d) {
      return this.compiled.filter((c) => c.test(d));
    }
    record(c, d) {
      const info = { rule: { ruleId: c.rule.id, rulesetId: c.rulesetId }, timeStamp: Date.now(), tabId: d.tabId };
      this.matched.push(info);
      if (this.matched.length > 1e3) this.matched.shift();
      const perms = this.ext.manifest.permissions || [];
      if (perms.includes("declarativeNetRequestFeedback")) {
        this.ext.dispatch("declarativeNetRequest.onRuleMatchedDebug", () => [{ request: { requestId: d.requestId, url: d.url, method: d.method, type: d.type, tabId: d.tabId, frameId: d.frameId, parentFrameId: d.parentFrameId, initiator: d.initiator }, rule: { ...info.rule } }]);
      }
      if (this.badge.enabled && (c.type === "block" || c.type === "redirect" || c.type === "upgradeScheme")) this.bump(d.tabId, 1);
    }
    bump(tabId, n) {
      const v = (this.badge.counts.get(tabId) || 0) + n;
      this.badge.counts.set(tabId, v);
      const st = this.ext.state.action;
      if (st) st.set("badgeText", v ? String(v) : "", tabId);
    }
    /** Main decision: returns a webRequest-style BlockingResponse. */
    evaluate(stage, d) {
      if (!this.compiled.length) return null;
      if (stage === "beforeRequest") {
        const m = this.match(d).filter((c) => c.type !== "modifyHeaders");
        const best = m[0];
        if (!best) return null;
        if (this.pageAllow && this.pageAllow.priority >= best.priority) return null;
        this.record(best, d);
        if (best.type === "block") return { cancel: true };
        if (best.type === "upgradeScheme") return /^(http|ws):/.test(d.url) ? { upgradeToSecure: true } : null;
        if (best.type === "redirect") {
          const u = best.redirect(d, this.ext);
          return u && u !== d.url ? { redirectUrl: u } : null;
        }
        return null;
      }
      const which = stage === "beforeSendHeaders" ? "requestHeaders" : "responseHeaders";
      const all = this.match(d);
      const allow = all.find((c) => c.type === "allow" || c.type === "allowAllRequests");
      const floor = Math.max(allow ? allow.priority : -Infinity, this.pageAllow ? this.pageAllow.priority : -Infinity);
      const mods = all.filter((c) => c.type === "modifyHeaders" && c.priority > floor && c.rule.action[which]);
      if (!mods.length) return null;
      let headers = (d[which] || []).map((x) => ({ ...x }));
      const touched = /* @__PURE__ */ new Map();
      for (const c of mods) {
        this.record(c, d);
        for (const op of c.rule.action[which]) {
          const name = String(op.header).toLowerCase();
          const prev = touched.get(name);
          if (prev && prev !== "append") continue;
          if (op.operation === "remove") headers = headers.filter((x) => x.name.toLowerCase() !== name);
          else if (op.operation === "set") {
            headers = headers.filter((x) => x.name.toLowerCase() !== name);
            headers.push({ name: op.header, value: op.value });
          } else if (op.operation === "append") headers.push({ name: op.header, value: op.value });
          touched.set(name, op.operation);
        }
      }
      return { [which]: headers };
    }
    save() {
      return this.internal.set({ "dnr:dynamic": this.dynamic, "dnr:disabled": this.disabled, "dnr:enabled": [...this.static].filter(([, s]) => s.enabled).map(([id]) => id) });
    }
  };
  function compileRule(rule, rulesetId, rank) {
    validateRule(rule);
    const c = rule.condition || {};
    const re = c.regexFilter ? new RegExp(c.regexFilter, c.isUrlFilterCaseSensitive ? "" : "i") : c.urlFilter ? urlFilterToRegExp(c.urlFilter, !!c.isUrlFilterCaseSensitive) : null;
    const types = c.resourceTypes || ALL_TYPES.filter((t) => t !== "main_frame" && !(c.excludedResourceTypes || []).includes(t));
    const lower = (a) => a && a.map((x) => String(x).toLowerCase());
    const reqDomains = lower(c.requestDomains);
    const exReqDomains = lower(c.excludedRequestDomains) || [];
    const initDomains = lower(c.initiatorDomains || c.domains);
    const exInitDomains = lower(c.excludedInitiatorDomains || c.excludedDomains) || [];
    const methods = lower(c.requestMethods);
    const exMethods = lower(c.excludedRequestMethods) || [];
    const headerCond = (list, headers) => (list || []).every((hc) => {
      const vals = (headers || []).filter((x) => x.name.toLowerCase() === hc.header.toLowerCase()).map((x) => x.value);
      if (!vals.length) return false;
      const pat = (p) => new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");
      if (hc.values && !hc.values.some((p) => vals.some((v) => pat(p).test(v)))) return false;
      if (hc.excludedValues && hc.excludedValues.some((p) => vals.some((v) => pat(p).test(v)))) return false;
      return true;
    });
    return {
      rule,
      rulesetId,
      rank,
      priority: rule.priority || 1,
      type: rule.action.type,
      re,
      test(d) {
        if (re && !re.test(d.url)) return false;
        if (!types.includes(d.type)) return false;
        if (c.excludedResourceTypes && c.excludedResourceTypes.includes(d.type)) return false;
        const m = String(d.method || "GET").toLowerCase();
        if (methods && !methods.includes(m)) return false;
        if (exMethods.includes(m)) return false;
        const host = hostOf(d.url);
        if (reqDomains && !domainMatch(host, reqDomains)) return false;
        if (exReqDomains.length && domainMatch(host, exReqDomains)) return false;
        const ih = d.initiator ? hostOf(d.initiator) : "";
        if (initDomains && !domainMatch(ih, initDomains)) return false;
        if (exInitDomains.length && ih && domainMatch(ih, exInitDomains)) return false;
        if (c.domainType && ih) {
          const third = registrableDomain(host) !== registrableDomain(ih);
          if (c.domainType === "thirdParty" !== third) return false;
        }
        if (c.tabIds && !c.tabIds.includes(d.tabId)) return false;
        if (c.excludedTabIds && c.excludedTabIds.includes(d.tabId)) return false;
        if (c.responseHeaders && !(d.responseHeaders && headerCond(c.responseHeaders, d.responseHeaders))) return false;
        if (c.excludedResponseHeaders && d.responseHeaders && c.excludedResponseHeaders.some((hc) => headerCond([hc], d.responseHeaders))) return false;
        return true;
      },
      redirect(d, ext) {
        const r = rule.action.redirect || {};
        if (r.url) return r.url;
        if (r.extensionPath) return ext.getURL(r.extensionPath);
        if (r.regexSubstitution && re) return d.url.replace(re, r.regexSubstitution.replace(/\$/g, "$$$$").replace(/\\(\d)/g, (_, n) => n === "0" ? "$&" : "$" + n));
        if (r.transform) {
          const u = new URL(d.url);
          const t = r.transform;
          if (t.scheme) u.protocol = t.scheme + ":";
          if (t.host != null) u.hostname = t.host;
          if (t.port != null) u.port = t.port;
          if (t.path != null) u.pathname = t.path;
          if (t.query != null) u.search = t.query;
          if (t.queryTransform) {
            for (const k of t.queryTransform.removeParams || []) u.searchParams.delete(k);
            for (const p of t.queryTransform.addOrReplaceParams || []) {
              if (p.replaceOnly && !u.searchParams.has(p.key)) continue;
              u.searchParams.set(p.key, p.value);
            }
          }
          if (t.fragment != null) u.hash = t.fragment;
          if (t.username != null) u.username = t.username;
          if (t.password != null) u.password = t.password;
          return u.href;
        }
        return null;
      }
    };
  }
  function filterMatches(filter, d) {
    if (!filter) return true;
    if (filter.urls && !matchesAny(filter.urls, d.url)) return false;
    if (filter.types && !filter.types.includes(d.type)) return false;
    if (filter.tabId != null && filter.tabId !== d.tabId) return false;
    if (filter.windowId != null && filter.windowId !== d.windowId) return false;
    return true;
  }
  function shape(d, ev, spec = []) {
    const o = { ...d };
    const wantReq = spec.includes("requestHeaders") && (ev === "onBeforeSendHeaders" || ev === "onSendHeaders");
    const wantRes = spec.includes("responseHeaders") && /^on(HeadersReceived|ResponseStarted|Completed|BeforeRedirect|AuthRequired)$/.test(ev);
    if (!wantReq) delete o.requestHeaders;
    else o.requestHeaders = o.requestHeaders.map((x) => ({ ...x }));
    if (!wantRes) delete o.responseHeaders;
    else o.responseHeaders = (o.responseHeaders || []).map((x) => ({ ...x }));
    if (!(ev === "onBeforeRequest" && spec.includes("requestBody"))) delete o.requestBody;
    if (!/^on(HeadersReceived|ResponseStarted|Completed|BeforeRedirect|AuthRequired|ErrorOccurred)$/.test(ev)) {
      delete o.statusCode;
      delete o.statusLine;
    }
    return o;
  }
  function networkClient(ext) {
    return ext.shared("netClient", () => {
      const perms = /* @__PURE__ */ new Set([...ext.manifest.permissions || [], ...ext.manifest.optional_permissions || []]);
      const useDnr = ext.options.allApis || [...perms].some((p) => /^declarativeNetRequest/.test(p));
      const client = {
        ext,
        dnr: useDnr ? new DNR(ext) : null,
        filters: /* @__PURE__ */ new Map(),
        listeners(ev) {
          const out = [];
          for (const c of ext.contexts) {
            if (!c.alive || !c.isExtensionPage) continue;
            const e = c.events.get("webRequest." + ev);
            if (e) for (const l of e._listeners) out.push([c, l]);
          }
          return out;
        },
        decide(stage, d, sync) {
          const ev = STAGE_EVENT[stage];
          const out = {};
          if (client.dnr) {
            const r = client.dnr.evaluate(stage, d);
            if (r) Object.assign(out, r);
            if (out.cancel || out.redirectUrl || out.upgradeToSecure) return out;
            if (r && r.requestHeaders) d.requestHeaders = r.requestHeaders;
            if (r && r.responseHeaders) d.responseHeaders = r.responseHeaders;
          }
          const pending = [];
          for (const [c, l] of client.listeners(ev)) {
            const [filter, spec = []] = l.extra;
            if (!filterMatches(filter, d)) continue;
            const details = shape(d, ev, spec);
            const blocking = spec.includes("blocking");
            if (!blocking) {
              nextTask(() => {
                if (c.alive) {
                  try {
                    l.fn(details);
                  } catch (e) {
                    c.log.error(`Error in webRequest.${ev} listener:`, e);
                  }
                }
              });
              continue;
            }
            let r;
            try {
              r = l.fn(details);
            } catch (e) {
              c.log.error(`Error in webRequest.${ev} listener:`, e);
              continue;
            }
            if (r && typeof r.then === "function") pending.push(r);
            else if (r) Object.assign(out, r);
          }
          if (stage === "beforeRequest" && client.filters.has(d.requestId)) {
            out.filters = [client.filters.get(d.requestId)];
            client.filters.delete(d.requestId);
          }
          if (!pending.length || sync) return out;
          return Promise.all(pending.map((p) => p.catch(() => null))).then((rs) => {
            for (const r of rs) if (r) Object.assign(out, r);
            if (stage === "beforeRequest" && client.filters.has(d.requestId)) {
              out.filters = [client.filters.get(d.requestId)];
              client.filters.delete(d.requestId);
            }
            return out;
          });
        },
        notify(ev, d) {
          if (ev === "onBeforeRequest" || ev === "onBeforeSendHeaders" || ev === "onHeadersReceived") {
            for (const [c, l] of client.listeners(ev)) {
              const [filter, spec = []] = l.extra;
              if (!filterMatches(filter, d)) continue;
              const details = shape(d, ev, spec);
              nextTask(() => {
                if (c.alive) {
                  try {
                    l.fn(details);
                  } catch (e) {
                    c.log.error(e);
                  }
                }
              });
            }
            return;
          }
          for (const [c, l] of client.listeners(ev)) {
            const [filter, spec = []] = l.extra;
            if (!filterMatches(filter, d)) continue;
            const details = shape(d, ev, spec);
            nextTask(() => {
              if (c.alive) {
                try {
                  l.fn(details);
                } catch (e) {
                  c.log.error(`Error in webRequest.${ev} listener:`, e);
                }
              }
            });
          }
        }
      };
      const remove = getInterceptor(ext.shim).addClient(client);
      ext.cleanups.push(remove);
      return client;
    });
  }
  defineStartup(async (ext) => {
    const client = networkClient(ext);
    if (!client.dnr) return;
    await client.dnr.ready;
    const page = { ...getInterceptor(ext.shim).base(location.href, "GET", "main_frame"), initiator: null };
    const r = client.dnr.evaluate("beforeRequest", page);
    if (r && r.redirectUrl && r.redirectUrl !== location.href) location.replace(r.redirectUrl);
    else if (r && r.upgradeToSecure && location.protocol === "http:") location.replace(location.href.replace(/^http:/, "https:"));
    else if (r && r.cancel) {
      const box = document.createElement("div");
      box.style.cssText = "font:16px system-ui,sans-serif;padding:15vh 10vw;color:#202124";
      box.textContent = `This page has been blocked by an extension (${ext.name}). ERR_BLOCKED_BY_CLIENT`;
      document.documentElement.replaceChildren(document.createElement("head"), Object.assign(document.createElement("body"), {}));
      document.body.append(box);
    }
  }, ["webRequest", "webRequestBlocking", "declarativeNetRequest", "declarativeNetRequestWithHostAccess", "declarativeNetRequestFeedback"]);
  function webRequestApi(h) {
    const { ext, fn } = h;
    const client = networkClient(ext);
    const api = {
      MAX_HANDLER_BEHAVIOR_CHANGED_CALLS_PER_10_MINUTES: 20,
      handlerBehaviorChanged: fn(() => {
      }),
      filterResponseData: (requestId) => {
        const f = new StreamFilter(String(requestId));
        client.filters.set(String(requestId), f);
        return f;
      },
      getSecurityInfo: fn((requestId) => {
        const e = getInterceptor(ext.shim).log.find((x) => x.requestId === String(requestId));
        return { state: e && /^https:/.test(e.url) ? "secure" : "insecure", certificates: [] };
      })
    };
    for (const ev of WR_EVENTS) api[ev] = h.event("webRequest." + ev);
    return api;
  }
  function declarativeNetRequestApi(h) {
    const { ext, fn } = h;
    const client = networkClient(ext);
    const dnr = client.dnr;
    const clone3 = (v) => JSON.parse(JSON.stringify(v));
    const update = (listName) => fn(async (o = {}) => {
      await dnr.ready;
      const list = dnr[listName].filter((r) => !(o.removeRuleIds || []).includes(r.id));
      for (const r of o.addRules || []) {
        validateRule(r);
        if (list.some((x) => x.id === r.id)) throw new Error(`Rule with id ${r.id} does not have a unique ID.`);
        list.push(clone3(r));
      }
      dnr[listName] = list;
      dnr.compile();
      if (listName === "dynamic") await dnr.save();
    });
    return {
      MAX_NUMBER_OF_RULES: 3e4,
      MAX_NUMBER_OF_DYNAMIC_RULES: 3e4,
      MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES: 5e3,
      MAX_NUMBER_OF_SESSION_RULES: 5e3,
      MAX_NUMBER_OF_UNSAFE_SESSION_RULES: 5e3,
      MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES: 5e3,
      MAX_NUMBER_OF_REGEX_RULES: 1e3,
      MAX_NUMBER_OF_STATIC_RULESETS: 100,
      MAX_NUMBER_OF_ENABLED_STATIC_RULESETS: 50,
      MAX_NUMBER_OF_DISABLED_STATIC_RULES: 5e3,
      GUARANTEED_MINIMUM_STATIC_RULES: 3e4,
      GETMATCHEDRULES_QUOTA_INTERVAL: 10,
      MAX_GETMATCHEDRULES_CALLS_PER_INTERVAL: 20,
      DYNAMIC_RULESET_ID: "_dynamic",
      SESSION_RULESET_ID: "_session",
      updateDynamicRules: update("dynamic"),
      getDynamicRules: fn(async (f = {}) => {
        await dnr.ready;
        return clone3(dnr.dynamic.filter((r) => !f.ruleIds || f.ruleIds.includes(r.id)));
      }),
      updateSessionRules: update("session"),
      getSessionRules: fn(async (f = {}) => {
        await dnr.ready;
        return clone3(dnr.session.filter((r) => !f.ruleIds || f.ruleIds.includes(r.id)));
      }),
      updateEnabledRulesets: fn(async (o = {}) => {
        await dnr.ready;
        for (const id of [...o.enableRulesetIds || [], ...o.disableRulesetIds || []]) if (!dnr.static.has(id)) throw new Error(`Invalid ruleset id: ${id}.`);
        for (const id of o.disableRulesetIds || []) dnr.static.get(id).enabled = false;
        for (const id of o.enableRulesetIds || []) dnr.static.get(id).enabled = true;
        dnr.compile();
        await dnr.save();
      }),
      getEnabledRulesets: fn(async () => {
        await dnr.ready;
        return [...dnr.static].filter(([, s]) => s.enabled).map(([id]) => id);
      }),
      updateStaticRules: fn(async (o = {}) => {
        await dnr.ready;
        if (!dnr.static.has(o.rulesetId)) throw new Error(`Invalid ruleset id: ${o.rulesetId}.`);
        const set = new Set(dnr.disabled[o.rulesetId] || []);
        for (const id of o.disableRuleIds || []) set.add(id);
        for (const id of o.enableRuleIds || []) set.delete(id);
        dnr.disabled[o.rulesetId] = [...set];
        dnr.compile();
        await dnr.save();
      }),
      getDisabledRuleIds: fn(async (o = {}) => {
        await dnr.ready;
        return [...dnr.disabled[o.rulesetId] || []];
      }),
      getAvailableStaticRuleCount: fn(async () => {
        await dnr.ready;
        return 3e4 - [...dnr.static.values()].filter((s) => s.enabled).reduce((n, s) => n + s.rules.length, 0);
      }),
      getMatchedRules: fn(async (f = {}) => ({ rulesMatchedInfo: clone3(dnr.matched.filter((m) => (f.tabId == null || m.tabId === f.tabId) && (f.minTimeStamp == null || m.timeStamp >= f.minTimeStamp))) })),
      setExtensionActionOptions: fn((o = {}) => {
        if (o.displayActionCountAsBadgeText !== void 0) dnr.badge.enabled = !!o.displayActionCountAsBadgeText;
        if (o.tabUpdate) dnr.bump(o.tabUpdate.tabId, o.tabUpdate.increment || 0);
      }),
      isRegexSupported: fn((o = {}) => {
        try {
          new RegExp(o.regex, o.isCaseSensitive === false ? "i" : "");
          return { isSupported: true };
        } catch {
          return { isSupported: false, reason: "syntaxError" };
        }
      }),
      testMatchOutcome: fn(async (req = {}) => {
        await dnr.ready;
        const d = { url: req.url, type: req.type || "xmlhttprequest", method: req.method || "get", initiator: req.initiator, tabId: req.tabId ?? -1, responseHeaders: req.responseHeaders ? Object.entries(req.responseHeaders).flatMap(([name, v]) => v.map((value) => ({ name, value }))) : void 0 };
        return { matchedRules: dnr.match(d).map((c) => ({ ruleId: c.rule.id, rulesetId: c.rulesetId })) };
      }),
      onRuleMatchedDebug: h.event("declarativeNetRequest.onRuleMatchedDebug")
    };
  }
  function toCookie(c) {
    const host = location.hostname;
    const domain = c.domain ? c.domain.startsWith(".") ? c.domain : "." + c.domain : host;
    const ss = { strict: "strict", lax: "lax", none: "no_restriction" }[String(c.sameSite || "").toLowerCase()] || "unspecified";
    const out = { name: c.name, value: c.value, domain, hostOnly: !c.domain, path: c.path || "/", secure: c.secure ?? location.protocol === "https:", httpOnly: false, sameSite: ss, session: !c.expires, storeId: "0", firstPartyDomain: "" };
    if (c.expires) out.expirationDate = c.expires / 1e3;
    if (c.partitioned) out.partitionKey = { topLevelSite: location.origin };
    return out;
  }
  async function pageCookies() {
    if (window.cookieStore) {
      try {
        return (await cookieStore.getAll()).map(toCookie);
      } catch {
      }
    }
    return document.cookie.split(";").map((s) => s.trim()).filter(Boolean).map((s) => {
      const i = s.indexOf("=");
      return toCookie({ name: i < 0 ? "" : s.slice(0, i), value: i < 0 ? s : s.slice(i + 1) });
    });
  }
  function sameSite(url) {
    try {
      const u = new URL(url);
      const h = u.hostname;
      const here = location.hostname;
      return h === here || h.endsWith("." + here) || here.endsWith("." + h) || registrableDomain(h) === registrableDomain(here);
    } catch {
      return false;
    }
  }
  function cookiesApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("cookies", () => {
      const s = { last: null, timer: null };
      const fire2 = (cookie, removed, cause) => ext.dispatch("cookies.onChanged", () => [{ removed, cookie: { ...cookie }, cause }]);
      if (window.cookieStore && cookieStore.addEventListener) {
        const onChange = (e) => {
          for (const c of e.changed || []) fire2(toCookie(c), false, "explicit");
          for (const c of e.deleted || []) fire2(toCookie(c), true, "explicit");
        };
        cookieStore.addEventListener("change", onChange);
        s.dispose = () => cookieStore.removeEventListener("change", onChange);
      } else {
        let prev = document.cookie;
        s.timer = setInterval(async () => {
          if (document.cookie === prev) return;
          const before = new Map(prev.split(";").map((x) => x.trim()).filter(Boolean).map((x) => [x.split("=")[0], x]));
          prev = document.cookie;
          const now2 = await pageCookies();
          for (const c of now2) {
            const b = before.get(c.name);
            if (b !== `${c.name}=${c.value}`) fire2(c, false, "explicit");
            before.delete(c.name);
          }
          for (const [name] of before) fire2(toCookie({ name, value: "" }), true, "explicit");
        }, 1500);
        s.dispose = () => clearInterval(s.timer);
      }
      return s;
    });
    void st;
    const check = (url) => {
      if (url && !sameSite(url)) return false;
      return true;
    };
    return {
      get: fn(async (d = {}) => {
        if (!check(d.url)) return null;
        return (await pageCookies()).find((c) => c.name === d.name) || null;
      }),
      getAll: fn(async (d = {}) => {
        if (d.url && !check(d.url)) return [];
        if (d.domain && !sameSite("https://" + String(d.domain).replace(/^\./, "") + "/")) return [];
        return (await pageCookies()).filter((c) => (d.name == null || c.name === d.name) && (d.path == null || c.path === d.path) && (d.secure == null || c.secure === d.secure) && (d.session == null || c.session === d.session));
      }),
      set: fn(async (d = {}) => {
        if (!d.url || !check(d.url)) throw new Error(`Failed to parse or set cookie named "${d.name || ""}".`);
        if (d.httpOnly) throw new Error(`Failed to set cookie "${d.name || ""}": HttpOnly cookies cannot be set from a web page.`);
        const opts = { name: d.name || "", value: d.value || "", path: d.path || "/" };
        if (d.domain) opts.domain = String(d.domain).replace(/^\./, "");
        if (d.expirationDate) opts.expires = Math.round(d.expirationDate * 1e3);
        if (d.sameSite && d.sameSite !== "unspecified") opts.sameSite = d.sameSite === "no_restriction" ? "none" : d.sameSite;
        if (window.cookieStore) await cookieStore.set(opts);
        else {
          let s = `${encodeURIComponent(opts.name)}=${opts.value}; path=${opts.path}`;
          if (opts.domain) s += `; domain=${opts.domain}`;
          if (opts.expires) s += `; expires=${new Date(opts.expires).toUTCString()}`;
          if (d.secure) s += "; secure";
          if (opts.sameSite) s += `; samesite=${opts.sameSite}`;
          document.cookie = s;
        }
        return (await pageCookies()).find((c) => c.name === opts.name) || toCookie({ ...opts, expires: opts.expires });
      }),
      remove: fn(async (d = {}) => {
        if (!check(d.url)) return null;
        const c = (await pageCookies()).find((x) => x.name === d.name);
        if (!c) return null;
        if (window.cookieStore) await cookieStore.delete({ name: d.name, path: c.path, domain: c.hostOnly ? void 0 : c.domain.replace(/^\./, "") });
        else document.cookie = `${encodeURIComponent(d.name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${c.path}`;
        return { url: d.url, name: d.name, storeId: "0" };
      }),
      getAllCookieStores: fn(() => [{ id: "0", tabIds: [ext.shim.tabId], incognito: false }]),
      getPartitionKey: fn(() => ({ partitionKey: { topLevelSite: location.origin, hasCrossSiteAncestor: false } })),
      onChanged: h.event("cookies.onChanged")
    };
  }
  function browsingDataApi(h) {
    const { ext, fn } = h;
    const TYPES = ["appcache", "cache", "cacheStorage", "cookies", "downloads", "fileSystems", "formData", "history", "indexedDB", "localStorage", "passwords", "pluginData", "serverBoundCertificates", "serviceWorkers", "webSQL"];
    const applies = (o = {}) => {
      if (o.origins && !o.origins.some((x) => {
        try {
          return new URL(x).origin === location.origin;
        } catch {
          return false;
        }
      })) return false;
      if (o.excludeOrigins && o.excludeOrigins.some((x) => {
        try {
          return new URL(x).origin === location.origin;
        } catch {
          return false;
        }
      })) return false;
      return true;
    };
    const removers = {
      async cookies() {
        for (const c of await pageCookies()) {
          if (window.cookieStore) await cookieStore.delete({ name: c.name, path: c.path }).catch(() => {
          });
          else document.cookie = `${c.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${c.path}`;
        }
      },
      async localStorage() {
        for (const k of Object.keys(localStorage)) if (!k.startsWith("extshim:")) localStorage.removeItem(k);
        try {
          sessionStorage.clear();
        } catch {
        }
      },
      async indexedDB() {
        if (indexedDB.databases) {
          for (const d of await indexedDB.databases()) if (d.name && !d.name.startsWith("extshim:")) indexedDB.deleteDatabase(d.name);
        }
      },
      async cacheStorage() {
        if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
      },
      async cache() {
        return removers.cacheStorage();
      },
      async serviceWorkers() {
        if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
      },
      async history(since) {
        const p = ext.state["profile:history"];
        if (p) {
          p.data.visits = p.data.visits.filter((v) => v.visitTime < since);
          for (const u of Object.keys(p.data.items)) if (!p.data.visits.some((v) => v.url === u)) delete p.data.items[u];
          p.save();
        }
      },
      async downloads() {
        const d = ext.state.downloads;
        if (d) d.items.clear();
      }
    };
    const remove = async (o = {}, data = {}) => {
      if (!applies(o)) return;
      for (const [k, on] of Object.entries(data)) if (on && removers[k]) await removers[k](o.since || 0);
    };
    const api = {
      settings: fn(() => ({ options: { since: 0 }, dataToRemove: Object.fromEntries(TYPES.map((t) => [t, !!removers[t]])), dataRemovalPermitted: Object.fromEntries(TYPES.map((t) => [t, true])) })),
      remove: fn(remove)
    };
    for (const t of TYPES) api["remove" + t[0].toUpperCase() + t.slice(1)] = fn((o) => remove(o, { [t]: true }));
    api.removeWebSQL = fn(() => {
    });
    api.removeAppcache = fn(() => {
    });
    return api;
  }
  function dnsApi(h) {
    const { ext, fn } = h;
    return {
      resolve: fn(async (hostname, flags = []) => {
        const endpoint = ext.options.dnsResolver || "https://cloudflare-dns.com/dns-query";
        const q = async (type) => {
          const r = await ext.shim.nativeFetch(`${endpoint}?name=${encodeURIComponent(hostname)}&type=${type}`, { headers: { accept: "application/dns-json" } });
          return r.ok ? r.json() : { Answer: [] };
        };
        const wantV6 = !(flags || []).includes("disable_ipv6");
        const wantV4 = !(flags || []).includes("disable_ipv4");
        const [a, aaaa] = await Promise.all([wantV4 ? q("A") : { Answer: [] }, wantV6 ? q("AAAA") : { Answer: [] }]);
        const ans = [...a.Answer || [], ...aaaa.Answer || []];
        const addresses = ans.filter((x) => x.type === 1 || x.type === 28).map((x) => x.data);
        if (!addresses.length) throw new Error("NS_ERROR_UNKNOWN_HOST");
        const cname = ans.filter((x) => x.type === 5).map((x) => x.data.replace(/\.$/, "")).pop();
        return { addresses, canonicalName: (flags || []).includes("canonical_name") ? cname || hostname : void 0, isTRR: true, resultCode: 0, address: addresses[0] };
      })
    };
  }
  function networkStatusApi(h) {
    const { ext, fn } = h;
    ext.shared("networkStatus", () => {
      const fire2 = () => ext.dispatch("networkStatus.onConnectionChanged", [linkInfo()]);
      window.addEventListener("online", fire2);
      window.addEventListener("offline", fire2);
      if (navigator.connection) navigator.connection.addEventListener("change", fire2);
      return { dispose() {
        window.removeEventListener("online", fire2);
        window.removeEventListener("offline", fire2);
        if (navigator.connection) navigator.connection.removeEventListener("change", fire2);
      } };
    });
    return { getLinkInfo: fn(() => linkInfo()), onConnectionChanged: h.event("networkStatus.onConnectionChanged") };
  }
  function linkInfo() {
    const c = navigator.connection || {};
    return { status: navigator.onLine ? "up" : "down", type: { wifi: "wifi", ethernet: "ethernet", cellular: "wwan", bluetooth: "unknown", wimax: "wimax", none: "unknown" }[c.type] || "unknown", id: void 0 };
  }
  function declarativeWebRequestApi(h) {
    return { onRequest: h.event("declarativeWebRequest.onRequest"), onMessage: h.event("declarativeWebRequest.onMessage") };
  }
  var WR_PERMS = ["webRequest", "webRequestBlocking", "webRequestAuthProvider", "webRequestFilterResponse"];
  defineNamespace("webRequest", webRequestApi, { perms: WR_PERMS });
  defineNamespace("declarativeNetRequest", declarativeNetRequestApi, { perms: ["declarativeNetRequest", "declarativeNetRequestWithHostAccess", "declarativeNetRequestFeedback"] });
  defineNamespace("declarativeWebRequest", declarativeWebRequestApi, { perms: ["declarativeWebRequest", "webRequest"] });
  defineNamespace("cookies", cookiesApi, { perms: ["cookies"] });
  defineNamespace("browsingData", browsingDataApi, { perms: ["browsingData"] });
  defineNamespace("dns", dnsApi, { perms: ["dns"] });
  defineNamespace("networkStatus", networkStatusApi, { perms: ["networkStatus"] });

  // src/runtime/api/page-apis.js
  var clone2 = (v) => v === void 0 ? void 0 : JSON.parse(JSON.stringify(v));
  var PageStateMatcher = class {
    constructor(o = {}) {
      this.instanceType = "declarativeContent.PageStateMatcher";
      Object.assign(this, clone2(o));
    }
  };
  var ShowAction = class {
    constructor() {
      this.instanceType = "declarativeContent.ShowAction";
    }
  };
  var ShowPageAction = class {
    constructor() {
      this.instanceType = "declarativeContent.ShowPageAction";
    }
  };
  var SetIcon = class {
    constructor(o = {}) {
      this.instanceType = "declarativeContent.SetIcon";
      if (o.imageData) this.imageData = o.imageData;
      if (o.path) this.path = o.path;
    }
  };
  var RequestContentScript = class {
    constructor(o = {}) {
      this.instanceType = "declarativeContent.RequestContentScript";
      Object.assign(this, clone2(o));
    }
  };
  var DeclarativeContent = class {
    constructor(ext) {
      this.ext = ext;
      this.internal = ext.storage.internal();
      this.rules = (this.internal.data["dc:rules"] || []).map((r) => ({ ...r }));
      this.next = 1;
      this.injected = /* @__PURE__ */ new Set();
      this.shown = false;
      this.mo = null;
      this.timer = null;
      ext.navHooks.add(() => this.evaluate());
      ext.whenBackgroundReady().then(() => this.evaluate());
    }
    dispose() {
      if (this.mo) this.mo.disconnect();
    }
    save() {
      this.internal.set({ "dc:rules": this.rules.map((r) => ({ ...r, actions: r.actions.map((a) => a.imageData ? { instanceType: a.instanceType } : a) })) });
    }
    condition(c) {
      if (c.pageUrl && !matchUrlFilters([c.pageUrl], location.href)) return false;
      if (c.css && !c.css.every((sel) => {
        try {
          return !!document.querySelector(sel);
        } catch {
          return false;
        }
      })) return false;
      if (c.isBookmarked != null) {
        const b = this.ext.state["profile:bookmarks"];
        const marked = !!b && Object.values(b.data.nodes).some((n) => n.url === location.href);
        if (marked !== c.isBookmarked) return false;
      }
      return true;
    }
    evaluate() {
      const ext = this.ext;
      const active = this.rules.filter((r) => r.conditions.some((c) => this.condition(c)));
      const show = active.some((r) => r.actions.some((a) => /Show(Page)?Action$/.test(a.instanceType)));
      const st = ext.state.action;
      if (st && this.rules.some((r) => r.actions.some((a) => /Show(Page)?Action$/.test(a.instanceType)))) {
        if (show) st.set("enabled", true, ext.shim.tabId);
        else if (this.shown) st.set("enabled", null, ext.shim.tabId);
      }
      this.shown = show;
      for (const r of active) {
        for (const a of r.actions) {
          if (a.instanceType === "declarativeContent.SetIcon" && st) st.set("icon", a.imageData ? { imageData: a.imageData } : { path: a.path }, ext.shim.tabId);
          if (a.instanceType === "declarativeContent.RequestContentScript" && !this.injected.has(r.id)) {
            this.injected.add(r.id);
            const f = ext.content.frame(window);
            if (a.css && a.css.length) ext.content.insertCss(f, { files: a.css });
            if (a.js && a.js.length) ext.content.injectEntry(f, { js: a.js.map((p) => normalizePath(p)), world: "ISOLATED" });
          }
        }
      }
      const needDom = this.rules.some((r) => r.conditions.some((c) => c.css));
      if (needDom && !this.mo && document.documentElement) {
        this.mo = new MutationObserver(() => {
          clearTimeout(this.timer);
          this.timer = setTimeout(() => this.evaluate(), 250);
        });
        this.mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "id"] });
      }
    }
  };
  function declarativeContentApi(h) {
    const { ext } = h;
    const st = ext.shared("declarativeContent", () => new DeclarativeContent(ext));
    const ev = h.event("declarativeContent.onPageChanged");
    const done = (cb, v) => {
      if (typeof cb === "function") setTimeout(() => h.ctx.callback(cb, null, v), 0);
      return Promise.resolve(v);
    };
    ev.addRules = (rules = [], cb) => {
      const added = rules.map((r) => ({ id: r.id || `_${st.next++}_`, priority: r.priority || 100, tags: r.tags || [], conditions: clone2(r.conditions || []), actions: (r.actions || []).map((a) => a.imageData ? { instanceType: a.instanceType, imageData: a.imageData } : clone2(a)) }));
      for (const r of added) {
        st.rules = st.rules.filter((x) => x.id !== r.id);
        st.rules.push(r);
      }
      st.save();
      st.evaluate();
      return done(cb, clone2(added.map((r) => ({ ...r, actions: r.actions.map((a) => a.imageData ? { instanceType: a.instanceType } : a) }))));
    };
    ev.removeRules = (ids, cb) => {
      if (typeof ids === "function") {
        cb = ids;
        ids = null;
      }
      st.rules = ids ? st.rules.filter((r) => !ids.includes(r.id)) : [];
      st.save();
      st.evaluate();
      return done(cb);
    };
    ev.getRules = (ids, cb) => {
      if (typeof ids === "function") {
        cb = ids;
        ids = null;
      }
      return done(cb, clone2(st.rules.filter((r) => !ids || ids.includes(r.id)).map((r) => ({ ...r, actions: r.actions.map((a) => a.imageData ? { instanceType: a.instanceType } : a) }))));
    };
    return { PageStateMatcher, ShowAction, ShowPageAction, SetIcon, RequestContentScript, onPageChanged: ev };
  }
  function userScriptState(ext) {
    return ext.shared("userScripts", () => {
      const internal = ext.storage.internal();
      return {
        scripts: new Map((internal.data["us:scripts"] || []).map((s) => [s.id, s])),
        worlds: internal.data["us:worlds"] || {},
        saveScripts() {
          internal.set({ "us:scripts": [...this.scripts.values()] });
        },
        saveWorlds() {
          internal.set({ "us:worlds": this.worlds });
        },
        worldsById: /* @__PURE__ */ new Map()
      };
    });
  }
  function userScriptWorld(ext, worldId = "") {
    const st = userScriptState(ext);
    if (st.worldsById.has(worldId)) return st.worldsById.get(worldId);
    const cfg = st.worlds[worldId] || st.worlds[""] || {};
    const world = new World({ kind: "content", target: window, log: ext.log, label: "user script" });
    const ctx = new Context(ext, { type: "content", url: location.href, tabId: ext.shim.tabId, frameId: 0, win: window, world });
    ctx.userScript = true;
    const api = {};
    if (cfg.messaging) {
      api.runtime = {
        get id() {
          return ext.id;
        },
        sendMessage: (...a) => ctx.api.runtime.sendMessage(...a),
        connect: (...a) => ctx.api.runtime.connect(...a),
        get lastError() {
          return ctx.api.runtime.lastError;
        }
      };
    }
    world.define({ chrome: api, browser: api });
    ctx.markReady();
    st.worldsById.set(worldId, world);
    return world;
  }
  async function runUserScript(ext, script, opts = {}) {
    const world = script.world === "MAIN" ? ext.content.main(ext.content.frame(window)) : userScriptWorld(ext, script.worldId || "");
    const results = [];
    for (const src of script.js || []) {
      try {
        if (src.file) world.run(await ext.unit(normalizePath(src.file)), ext.virtualUrl(src.file));
        else if (src.code != null) {
          if (!canEval()) throw new Error("User scripts given as code need eval, which this page's CSP blocks.");
          if (opts.collect) results.push(world.evaluate(String(src.code)));
          else world.run(compileUnit(String(src.code), `userscript:${script.id || "anonymous"}`), "user script " + (script.id || ""));
        }
      } catch (e) {
        ext.log.error("User script failed:", e);
        results.push(void 0);
      }
    }
    return results;
  }
  defineStartup(async (ext) => {
    const st = userScriptState(ext);
    const url = location.href;
    for (const s of st.scripts.values()) {
      const entry = { matches: s.matches || [], exclude_matches: s.excludeMatches || [], include_globs: s.includeGlobs || [], exclude_globs: s.excludeGlobs || [] };
      if (!contentScriptMatches(entry, url)) continue;
      const go = () => runUserScript(ext, s);
      const when = s.runAt || "document_idle";
      if (when === "document_start" || document.readyState === "complete" || when === "document_end" && document.readyState !== "loading") go();
      else document.addEventListener(when === "document_end" ? "DOMContentLoaded" : "readystatechange", function f() {
        if (when === "document_end" || document.readyState === "complete") {
          document.removeEventListener("readystatechange", f);
          go();
        }
      });
    }
  }, ["userScripts"]);
  function userScriptsApi(h) {
    const { ext, fn } = h;
    const st = userScriptState(ext);
    const norm = (s) => {
      if (!s.id || String(s.id).startsWith("_")) throw new Error('User script id must be a non-empty string not starting with "_".');
      if (!s.js || !s.js.length) throw new Error(`User script with ID '${s.id}' must specify at least one js source.`);
      return { id: s.id, matches: s.matches || [], excludeMatches: s.excludeMatches || [], includeGlobs: s.includeGlobs || [], excludeGlobs: s.excludeGlobs || [], js: clone2(s.js), runAt: s.runAt || "document_idle", allFrames: !!s.allFrames, world: s.world || "USER_SCRIPT", worldId: s.worldId };
    };
    const firefoxRegister = (o) => {
      const s = norm({ id: "ff-" + Math.random().toString(36).slice(2), ...o });
      const entry = { matches: s.matches, exclude_matches: s.excludeMatches, include_globs: s.includeGlobs, exclude_globs: s.excludeGlobs };
      if (contentScriptMatches(entry, location.href)) runUserScript(ext, s);
      return { unregister: fn(() => {
      }) };
    };
    return {
      register: fn(async (scripts) => {
        if (!Array.isArray(scripts)) return firefoxRegister(scripts || {});
        const list = scripts.map(norm);
        for (const s of list) if (st.scripts.has(s.id)) throw new Error(`Duplicate script ID '${s.id}'`);
        for (const s of list) st.scripts.set(s.id, s);
        st.saveScripts();
      }),
      update: fn(async (scripts = []) => {
        for (const s of scripts) {
          const cur = st.scripts.get(s.id);
          if (!cur) throw new Error(`Script with ID '${s.id}' does not exist or is not fully registered`);
          st.scripts.set(s.id, norm({ ...cur, ...s }));
        }
        st.saveScripts();
      }),
      getScripts: fn(async (f = {}) => [...st.scripts.values()].filter((s) => !f.ids || f.ids.includes(s.id)).map(clone2)),
      unregister: fn(async (f = {}) => {
        for (const id of f.ids || [...st.scripts.keys()]) st.scripts.delete(id);
        st.saveScripts();
      }),
      execute: fn(async (inj = {}) => {
        if (!inj.target || inj.target.tabId !== ext.shim.tabId) throw new Error("Cannot access contents of the page.");
        const out = await runUserScript(ext, { id: "execute", js: inj.js, world: inj.world, worldId: inj.worldId }, { collect: true });
        const last = out[out.length - 1];
        let result;
        try {
          result = last === void 0 ? null : clone2(await last);
        } catch {
          result = null;
        }
        return [{ frameId: 0, documentId: "D" + ext.shim.tabId, result }];
      }),
      configureWorld: fn((cfg = {}) => {
        st.worlds[cfg.worldId || ""] = { csp: cfg.csp, messaging: !!cfg.messaging, worldId: cfg.worldId };
        st.worldsById.delete(cfg.worldId || "");
        st.saveWorlds();
      }),
      getWorldConfigurations: fn(() => Object.values(st.worlds).map(clone2)),
      resetWorldConfiguration: fn((worldId) => {
        delete st.worlds[worldId || ""];
        st.worldsById.delete(worldId || "");
        st.saveWorlds();
      }),
      onBeforeScript: h.event("userScripts.onBeforeScript")
    };
  }
  function contentScriptsApi(h) {
    const { ext, fn } = h;
    return {
      register: fn(async (o = {}) => {
        const entry = { index: "ff:" + Date.now(), matches: o.matches || [], exclude_matches: o.excludeMatches || [], include_globs: o.includeGlobs || [], exclude_globs: o.excludeGlobs || [], js: (o.js || []).map((x) => x.file && normalizePath(x.file)).filter(Boolean), css: (o.css || []).map((x) => x.file && normalizePath(x.file)).filter(Boolean), run_at: o.runAt || "document_idle", world: o.world || "ISOLATED" };
        const code = (o.js || []).filter((x) => x.code != null).map((x) => x.code);
        const cssCode = (o.css || []).filter((x) => x.code != null).map((x) => x.code).join("\n");
        const f = ext.content.frame(window);
        if (ext.options.contentScripts === "all" || contentScriptMatches(entry, location.href)) {
          if (entry.css.length || cssCode) ext.content.insertCss(f, { files: entry.css, css: cssCode, key: entry.index });
          await ext.content.injectEntry(f, entry);
          if (code.length) {
            const w = ext.content.isolated(f);
            for (const c of code) w.run(compileUnit(c, "contentScripts.register"), "registered content script");
          }
        }
        return { unregister: fn(() => {
          const rm = ext.content.css.get(entry.index);
          if (rm) {
            rm();
            ext.content.css.delete(entry.index);
          }
        }) };
      })
    };
  }
  function findState(ext) {
    return ext.shared("find", () => ({ ranges: [], sheet: null, dispose() {
      clearHighlight();
    } }));
  }
  function clearHighlight() {
    if (window.CSS && CSS.highlights) {
      CSS.highlights.delete("extshim-find");
      CSS.highlights.delete("extshim-find-active");
    }
  }
  function findApi(h) {
    const { ext, fn } = h;
    const st = findState(ext);
    const host = () => ext.shim.ui && ext.shim.ui.host;
    return {
      find: fn((query, o = {}) => {
        query = String(query || "");
        st.ranges = [];
        const texts = [];
        const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
          acceptNode: (n) => n.parentElement && (n.parentElement.closest("script,style,noscript,template") || host() && host().contains(n)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
        });
        while (walker.nextNode()) texts.push(walker.currentNode);
        const fold = (s) => o.matchDiacritics ? s : s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const flags = o.caseSensitive ? "g" : "gi";
        const esc = fold(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(o.entireWord ? `(?<![\\p{L}\\p{N}_])${esc}(?![\\p{L}\\p{N}_])` : esc, flags + "u");
        const rangeData = [];
        const rectData = [];
        texts.forEach((node, i) => {
          const value = fold(node.nodeValue);
          if (!query || value.length !== node.nodeValue.length) return;
          let m;
          re.lastIndex = 0;
          while (m = re.exec(value)) {
            const r = document.createRange();
            r.setStart(node, m.index);
            r.setEnd(node, m.index + m[0].length);
            st.ranges.push(r);
            if (o.includeRangeData) rangeData.push({ framePos: 0, startTextNodePos: i, endTextNodePos: i, startOffset: m.index, endOffset: m.index + m[0].length, text: node.nodeValue.slice(m.index, m.index + m[0].length) });
            if (o.includeRectData) {
              const rects = [...r.getClientRects()].map((x) => ({ top: x.top + scrollY, left: x.left + scrollX, bottom: x.bottom + scrollY, right: x.right + scrollX }));
              rectData.push({ rectsAndTexts: { rectList: rects, textList: [m[0]] }, textList: m[0] });
            }
            if (!m[0].length) re.lastIndex++;
          }
        });
        const out = { count: st.ranges.length };
        if (o.includeRangeData) out.rangeData = rangeData;
        if (o.includeRectData) out.rectData = rectData;
        return out;
      }),
      highlightResults: fn((o = {}) => {
        if (!st.ranges.length) throw new Error("No search results to highlight.");
        const idx = o.rangeIndex == null ? 0 : o.rangeIndex;
        if (window.CSS && CSS.highlights && typeof Highlight === "function") {
          if (!st.sheet) {
            st.sheet = true;
            adoptCss(document, window, [{ css: "::highlight(extshim-find){background:#ff0;color:#000}::highlight(extshim-find-active){background:#38d878;color:#000}" }]);
          }
          CSS.highlights.set("extshim-find", new Highlight(...st.ranges));
          if (st.ranges[idx]) CSS.highlights.set("extshim-find-active", new Highlight(st.ranges[idx]));
        } else {
          const sel = getSelection();
          sel.removeAllRanges();
          if (st.ranges[idx]) sel.addRange(st.ranges[idx]);
        }
        if (!o.noScroll && st.ranges[idx]) {
          const el2 = st.ranges[idx].startContainer.parentElement;
          if (el2) el2.scrollIntoView({ block: "center" });
        }
      }),
      removeHighlighting: fn(() => {
        clearHighlight();
      })
    };
  }
  function themeApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("theme", () => ({ current: ext.storage.internal().data.theme || null }));
    const apply = () => ext.shim.ui.setTheme(st.current && st.current.colors);
    if (st.current) apply();
    return {
      getCurrent: fn(() => clone2(st.current || {})),
      update: fn(async (a, b) => {
        const theme = b === void 0 ? a : b;
        st.current = clone2(theme || {});
        await ext.storage.internal().set({ theme: st.current });
        apply();
        ext.dispatch("theme.onUpdated", () => [{ theme: clone2(st.current), windowId: typeof a === "number" ? a : void 0 }]);
      }),
      reset: fn(async () => {
        st.current = null;
        await ext.storage.internal().remove("theme");
        apply();
        ext.dispatch("theme.onUpdated", () => [{ theme: {} }]);
      }),
      onUpdated: h.event("theme.onUpdated")
    };
  }
  function pageCaptureApi(h) {
    const { fn } = h;
    return {
      saveAsMHTML: fn(async () => {
        const boundary = "----MultipartBoundary--" + Math.random().toString(36).slice(2);
        const parts = [];
        const qp = (s) => s.replace(/[^\t\n\r\x20-\x3c\x3e-\x7e]/g, (c) => "=" + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0"));
        const html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
        parts.push(`Content-Type: text/html\r
Content-ID: <frame-main@mhtml.blink>\r
Content-Transfer-Encoding: quoted-printable\r
Content-Location: ${location.href}\r
\r
${qp(unescape(encodeURIComponent(html)))}`);
        for (const sheet of document.styleSheets) {
          let css;
          try {
            css = [...sheet.cssRules].map((r) => r.cssText).join("\n");
          } catch {
            continue;
          }
          parts.push(`Content-Type: text/css\r
Content-Transfer-Encoding: quoted-printable\r
Content-Location: ${sheet.href || location.href + "#inline-style"}\r
\r
${qp(unescape(encodeURIComponent(css)))}`);
        }
        const head = `From: <Saved by ExtShim>\r
Snapshot-Content-Location: ${location.href}\r
Subject: ${document.title}\r
Date: ${(/* @__PURE__ */ new Date()).toUTCString()}\r
MIME-Version: 1.0\r
Content-Type: multipart/related;\r
	type="text/html";\r
	boundary="${boundary}"\r
\r
`;
        return new Blob([head + parts.map((p) => `--${boundary}\r
${p}\r
`).join("") + `--${boundary}--\r
`], { type: "multipart/related" });
      })
    };
  }
  function tabCaptureApi(h) {
    const { ext, fn, ctx } = h;
    const st = ext.shared("tabCapture", () => ({ captured: /* @__PURE__ */ new Map() }));
    const track = (stream) => {
      const info = { tabId: ext.shim.tabId, status: "active", fullscreen: false };
      st.captured.set(stream, info);
      ext.dispatch("tabCapture.onStatusChanged", [{ ...info }]);
      stream.getTracks().forEach((t) => t.addEventListener("ended", () => {
        if (!st.captured.has(stream)) return;
        st.captured.delete(stream);
        ext.dispatch("tabCapture.onStatusChanged", [{ ...info, status: "stopped" }]);
      }));
    };
    return {
      capture(options = {}, cb) {
        displayStream({ video: options.video !== false && (options.videoConstraints || true), audio: !!options.audio, currentTab: true }).then((s) => {
          track(s);
          cb && cb(s);
        }).catch((e) => cb && ctx.withLastError(e, () => cb(null)));
      },
      getMediaStreamId: fn(async () => {
        const s = await displayStream({ video: true, audio: true, currentTab: true });
        track(s);
        return registerStream(s);
      }),
      getCapturedTabs: fn(() => [...st.captured.values()].map((x) => ({ ...x }))),
      onStatusChanged: h.event("tabCapture.onStatusChanged")
    };
  }
  function desktopCaptureApi(h) {
    const { ctx } = h;
    const pending = /* @__PURE__ */ new Map();
    let n = 0;
    return {
      chooseDesktopMedia(sources, targetTab, cb) {
        if (typeof targetTab === "function") cb = targetTab;
        const id = ++n;
        const wantAudio = (sources || []).includes("audio");
        const onlyTab = (sources || []).length && sources.every((s) => s === "tab" || s === "audio");
        pending.set(id, true);
        displayStream({ video: true, audio: wantAudio, currentTab: onlyTab }).then((s) => {
          if (!pending.delete(id)) {
            s.getTracks().forEach((t) => t.stop());
            return;
          }
          cb && cb(registerStream(s), { canRequestAudioTrack: s.getAudioTracks().length > 0 });
        }).catch(() => {
          if (pending.delete(id) && cb) ctx.callback(cb, null, "", { canRequestAudioTrack: false });
        });
        return id;
      },
      cancelChooseDesktopMedia(id) {
        pending.delete(id);
      }
    };
  }
  function powerApi(h) {
    const { ext } = h;
    const st = ext.shared("power", () => ({ lock: null, want: false, dispose() {
      if (this.lock) this.lock.release().catch(() => {
      });
    } }));
    const acquire = async () => {
      if (!navigator.wakeLock || !st.want) return;
      try {
        st.lock = await navigator.wakeLock.request("screen");
        st.lock.addEventListener("release", () => {
          st.lock = null;
        });
      } catch (e) {
        ext.log.debug("wake lock:", e.message);
      }
    };
    if (!st.vis) {
      st.vis = () => {
        if (document.visibilityState === "visible" && st.want && !st.lock) acquire();
      };
      document.addEventListener("visibilitychange", st.vis);
    }
    return {
      requestKeepAwake: () => {
        st.want = true;
        acquire();
      },
      releaseKeepAwake: () => {
        st.want = false;
        if (st.lock) st.lock.release().catch(() => {
        });
        st.lock = null;
      },
      reportActivity: h.fn(() => {
      })
    };
  }
  function systemCpuApi(h) {
    return {
      getInfo: h.fn(() => {
        const n = navigator.hardwareConcurrency || 4;
        const ua = navigator.userAgent;
        return {
          numOfProcessors: n,
          archName: /arm|aarch64/i.test(ua) ? "arm64" : "x86_64",
          modelName: "",
          features: [],
          processors: Array.from({ length: n }, () => ({ usage: { user: 0, kernel: 0, idle: 0, total: 0 } })),
          temperatures: []
        };
      })
    };
  }
  function systemMemoryApi(h) {
    return {
      getInfo: h.fn(() => {
        const cap = (navigator.deviceMemory || 8) * 1073741824;
        const used = performance.memory ? performance.memory.usedJSHeapSize : 0;
        return { capacity: cap, availableCapacity: Math.max(0, cap - used) };
      })
    };
  }
  function systemStorageApi(h) {
    const est = async () => navigator.storage && navigator.storage.estimate ? navigator.storage.estimate() : { quota: 0, usage: 0 };
    return {
      getInfo: h.fn(async () => {
        const e = await est();
        return [{ id: "browser-storage", name: "Browser storage", type: "fixed", capacity: e.quota || 0 }];
      }),
      ejectDevice: h.fn(() => "no_such_device"),
      getAvailableCapacity: h.fn(async (id) => {
        const e = await est();
        return { id, availableCapacity: Math.max(0, (e.quota || 0) - (e.usage || 0)) };
      }),
      onAttached: h.event("system.storage.onAttached"),
      onDetached: h.event("system.storage.onDetached")
    };
  }
  function systemDisplayApi(h) {
    const { ext, fn } = h;
    ext.shared("systemDisplay", () => {
      const fire2 = () => ext.dispatch("system.display.onDisplayChanged", []);
      if (screen.addEventListener) screen.addEventListener("change", fire2);
      const mq = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mq.addEventListener && mq.addEventListener("change", fire2);
      return { dispose() {
        if (screen.removeEventListener) screen.removeEventListener("change", fire2);
      } };
    });
    const no = () => fn(() => {
      throw new Error("Not supported on this platform.");
    });
    const info = () => {
      const s = screen;
      const bounds = { left: s.left || 0, top: s.top || 0, width: s.width, height: s.height };
      const workArea = { left: s.availLeft || 0, top: s.availTop || 0, width: s.availWidth, height: s.availHeight };
      const dpi = 96 * (window.devicePixelRatio || 1);
      const mode = { width: s.width, height: s.height, widthInNativePixels: Math.round(s.width * devicePixelRatio), heightInNativePixels: Math.round(s.height * devicePixelRatio), deviceScaleFactor: devicePixelRatio, refreshRate: 60, isNative: true, isSelected: true, isInterlaced: false };
      return {
        id: "0",
        name: "Display",
        mirroringSourceId: "",
        mirroringDestinationIds: [],
        isPrimary: true,
        isInternal: !!s.isInternal,
        isEnabled: true,
        isUnified: false,
        dpiX: dpi,
        dpiY: dpi,
        rotation: s.orientation && s.orientation.angle || 0,
        bounds,
        overscan: { left: 0, top: 0, right: 0, bottom: 0 },
        workArea,
        modes: [mode],
        hasTouchSupport: navigator.maxTouchPoints > 0,
        hasAccelerometerSupport: false,
        availableDisplayZoomFactors: [1],
        displayZoomFactor: 1,
        activeState: "active"
      };
    };
    return {
      getInfo: fn(() => [info()]),
      getDisplayLayout: fn(() => []),
      setDisplayProperties: no(),
      setDisplayLayout: no(),
      enableUnifiedDesktop: () => {
      },
      overscanCalibrationStart: () => {
      },
      overscanCalibrationAdjust: () => {
      },
      overscanCalibrationReset: () => {
      },
      overscanCalibrationComplete: () => {
      },
      showNativeTouchCalibration: no(),
      startCustomTouchCalibration: () => {
      },
      completeCustomTouchCalibration: () => {
      },
      clearTouchCalibration: () => {
      },
      setMirrorMode: no(),
      onDisplayChanged: h.event("system.display.onDisplayChanged")
    };
  }
  function clipboardApi(h) {
    return {
      setImageData: h.fn(async (data, type) => {
        let blob = new Blob([data], { type: type === "jpeg" ? "image/jpeg" : "image/png" });
        if (type === "jpeg") {
          const bmp = await createImageBitmap(blob);
          const c = document.createElement("canvas");
          c.width = bmp.width;
          c.height = bmp.height;
          c.getContext("2d").drawImage(bmp, 0, 0);
          blob = await new Promise((r) => c.toBlob(r, "image/png"));
        }
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      })
    };
  }
  function captivePortalApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("captivePortal", () => {
      const s = { checked: Date.now() };
      const fire2 = () => {
        s.checked = Date.now();
        ext.dispatch("captivePortal.onStateChanged", [{ state: navigator.onLine ? "not_captive" : "unknown" }]);
        if (navigator.onLine) ext.dispatch("captivePortal.onConnectivityAvailable", ["clear"]);
      };
      window.addEventListener("online", fire2);
      window.addEventListener("offline", fire2);
      s.dispose = () => {
        window.removeEventListener("online", fire2);
        window.removeEventListener("offline", fire2);
      };
      return s;
    });
    return {
      getState: fn(() => navigator.onLine ? "not_captive" : "unknown"),
      getLastChecked: fn(() => Date.now() - st.checked),
      onStateChanged: h.event("captivePortal.onStateChanged"),
      onConnectivityAvailable: h.event("captivePortal.onConnectivityAvailable"),
      canonicalURL: chromeSetting(h, "captivePortal.canonicalURL", "http://detectportal.firefox.com/canonical.html")
    };
  }
  function printJobs(ext) {
    return ext.shared("printJobs", () => ({ jobs: /* @__PURE__ */ new Map(), n: 1 }));
  }
  function printBlob(blob, title) {
    return new Promise((resolve) => {
      const f = document.createElement("iframe");
      f.setAttribute("data-extshim", "print");
      f.style.cssText = "position:fixed;width:0;height:0;border:0;left:-9999px";
      f.src = URL.createObjectURL(blob);
      f.title = title || "print";
      f.onload = () => {
        try {
          f.contentWindow.focus();
          f.contentWindow.print();
        } catch {
          window.open(f.src, "_blank");
        }
        setTimeout(() => {
          f.remove();
          resolve();
        }, 1e3);
      };
      document.documentElement.appendChild(f);
    });
  }
  function printingApi(h) {
    const { ext, fn } = h;
    const st = printJobs(ext);
    const printer = { id: "extshim-print-dialog", name: "Browser print dialog", description: "Prints through the browser's print dialog", uri: "browser://print", source: "USER", isDefault: true, recentlyUsedRank: 0 };
    return {
      MAX_SUBMIT_JOB_CALLS_PER_MINUTE: 40,
      MAX_GET_PRINTER_INFO_CALLS_PER_MINUTE: 20,
      getPrinters: fn(() => [{ ...printer }]),
      getPrinterInfo: fn(() => ({ status: "AVAILABLE", capabilities: { version: "1.0", printer: { supported_content_type: [{ content_type: "application/pdf" }], color: { option: [{ type: "STANDARD_COLOR", is_default: true }, { type: "STANDARD_MONOCHROME" }] }, copies: { default: 1, max: 99 }, media_size: { option: [{ name: "ISO_A4", width_microns: 21e4, height_microns: 297e3, is_default: true }, { name: "NA_LETTER", width_microns: 215900, height_microns: 279400 }] } } } })),
      submitJob: fn(async (req = {}) => {
        const job = req.job || {};
        const id = String(st.n++);
        st.jobs.set(id, { id, title: job.title || "", status: "IN_PROGRESS", creationTime: Date.now() });
        ext.dispatch("printing.onJobStatusChanged", [id, "IN_PROGRESS"]);
        printBlob(job.document instanceof Blob ? job.document : new Blob([job.document || ""], { type: job.contentType || "application/pdf" }), job.title).then(() => {
          st.jobs.get(id).status = "PRINTED";
          st.jobs.get(id).completionTime = Date.now();
          ext.dispatch("printing.onJobStatusChanged", [id, "PRINTED"]);
          ext.dispatch("printingMetrics.onPrintJobFinished", () => [jobInfo(st.jobs.get(id))]);
        });
        return { status: "OK", jobId: id };
      }),
      cancelJob: fn((id) => {
        const j = st.jobs.get(id);
        if (!j) throw new Error("No print job with this id.");
        j.status = "CANCELED";
        ext.dispatch("printing.onJobStatusChanged", [id, "CANCELED"]);
      }),
      getJobStatus: fn((id) => {
        const j = st.jobs.get(id);
        if (!j) throw new Error("No print job with this id.");
        return j.status;
      }),
      onJobStatusChanged: h.event("printing.onJobStatusChanged")
    };
  }
  function jobInfo(j) {
    return { id: j.id, title: j.title, source: "EXTENSION", sourceId: "", status: j.status === "PRINTED" ? "PRINTED" : j.status === "CANCELED" ? "CANCELED" : "FAILED", creationTime: j.creationTime, completionTime: j.completionTime || Date.now(), printer: { name: "Browser print dialog", uri: "browser://print", source: "USER" }, settings: { color: "COLOR", duplex: "ONE_SIDED", mediaSize: { width: 21e4, height: 297e3, vendorId: "iso_a4_210x297mm" }, copies: 1 }, numberOfPages: 0, printer_status: "AVAILABLE" };
  }
  function printingMetricsApi(h) {
    const { ext, fn } = h;
    return { getPrintJobs: fn(() => [...printJobs(ext).jobs.values()].filter((j) => j.status !== "IN_PROGRESS").map(jobInfo)), onPrintJobFinished: h.event("printingMetrics.onPrintJobFinished") };
  }
  function printerProviderApi(h) {
    return {
      onGetPrintersRequested: h.event("printerProvider.onGetPrintersRequested"),
      onGetUsbPrinterInfoRequested: h.event("printerProvider.onGetUsbPrinterInfoRequested"),
      onGetCapabilityRequested: h.event("printerProvider.onGetCapabilityRequested"),
      onPrintRequested: h.event("printerProvider.onPrintRequested")
    };
  }
  function publicSuffixApi(h) {
    const host = (u) => {
      try {
        return new URL(u).hostname;
      } catch {
        return String(u || "");
      }
    };
    return {
      getDomain: h.fn((u) => {
        const x = host(u);
        return isIp(x) ? "" : registrableDomain(x);
      }),
      getKnownSuffix: h.fn((u) => publicSuffix(host(u))),
      isKnownSuffix: h.fn((u) => {
        const x = host(u);
        return !!x && publicSuffix(x) === x;
      })
    };
  }
  function systemLogApi(h) {
    return { add: h.fn((o = {}) => {
      console.info(`[systemLog \xB7 ${h.ext.name}]`, o.message);
    }) };
  }
  defineStartup((ext) => {
    ext.frameHooks.add((win) => wrapGetUserMedia(win));
  }, ["desktopCapture", "tabCapture"]);
  defineNamespace("declarativeContent", declarativeContentApi, { perms: ["declarativeContent"] });
  defineNamespace("userScripts", userScriptsApi, { perms: ["userScripts"] });
  defineNamespace("contentScripts", contentScriptsApi, { always: true, when: (ext) => ext.mv === 2 || ext.options.allApis || !!ext.options.exposeBrowser });
  defineNamespace("find", findApi, { perms: ["find"] });
  defineNamespace("theme", themeApi, { perms: ["theme"] });
  defineNamespace("pageCapture", pageCaptureApi, { perms: ["pageCapture"] });
  defineNamespace("tabCapture", tabCaptureApi, { perms: ["tabCapture"] });
  defineNamespace("desktopCapture", desktopCaptureApi, { perms: ["desktopCapture"] });
  defineNamespace("power", powerApi, { perms: ["power"] });
  defineNamespace("system.cpu", systemCpuApi, { perms: ["system.cpu"] });
  defineNamespace("system.memory", systemMemoryApi, { perms: ["system.memory"] });
  defineNamespace("system.storage", systemStorageApi, { perms: ["system.storage"] });
  defineNamespace("system.display", systemDisplayApi, { perms: ["system.display"] });
  defineNamespace("clipboard", clipboardApi, { perms: ["clipboardWrite"] });
  defineNamespace("captivePortal", captivePortalApi, { perms: ["captivePortal"] });
  defineNamespace("printing", printingApi, { perms: ["printing"] });
  defineNamespace("printingMetrics", printingMetricsApi, { perms: ["printingMetrics"] });
  defineNamespace("printerProvider", printerProviderApi, { perms: ["printerProvider"] });
  defineNamespace("publicSuffix", publicSuffixApi, { perms: ["publicSuffix"] });
  defineNamespace("systemLog", systemLogApi, { perms: ["systemLog"] });

  // src/runtime/api/platform-apis.js
  var rid = (n = 22) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[b & 63]).join("");
  function identityApi(h) {
    const { ext, fn } = h;
    const cfg = () => ext.options.identity || {};
    const redirect = (path = "") => (cfg().redirectUrl ? cfg().redirectUrl.replace(/\/?$/, "/") : `https://${ext.id}.chromiumapp.org/`) + String(path).replace(/^\//, "");
    return {
      getRedirectURL: (path) => redirect(path),
      launchWebAuthFlow: fn((d = {}) => new Promise((resolve, reject) => {
        const base = redirect();
        const w = window.open(d.url, "extshim-auth-" + ext.id, "popup,width=520,height=680");
        if (!w) {
          reject(new Error("Authorization page could not be loaded."));
          return;
        }
        const started = Date.now();
        const timeout = d.interactive === false && d.timeoutMsForNonInteractive ? d.timeoutMsForNonInteractive : 10 * 60 * 1e3;
        const t = setInterval(() => {
          let href = null;
          try {
            href = w.location.href;
          } catch {
          }
          if (href && href.startsWith(base)) {
            clearInterval(t);
            w.close();
            resolve(href);
            return;
          }
          if (w.closed) {
            clearInterval(t);
            reject(new Error("The user did not approve access."));
            return;
          }
          if (Date.now() - started > timeout) {
            clearInterval(t);
            w.close();
            reject(new Error("Authorization page could not be loaded."));
          }
        }, 250);
      })),
      getAuthToken: fn(async (d = {}) => {
        if (typeof cfg().getAuthToken === "function") {
          const r = await cfg().getAuthToken(d);
          return typeof r === "string" ? { token: r, grantedScopes: d.scopes || [] } : r;
        }
        throw new Error("OAuth2 not granted or revoked.");
      }),
      removeCachedAuthToken: fn(() => {
      }),
      clearAllCachedAuthTokens: fn(() => {
      }),
      getProfileUserInfo: fn(() => ({ email: cfg().profile && cfg().profile.email || "", id: cfg().profile && cfg().profile.id || "" })),
      getAccounts: fn(() => cfg().profile ? [{ id: cfg().profile.id || "" }] : []),
      onSignInChanged: h.event("identity.onSignInChanged")
    };
  }
  function idStore(ext) {
    const internal = ext.storage.internal();
    return {
      get: (k) => internal.data["iid:" + k],
      set: (k, v) => internal.set({ ["iid:" + k]: v }),
      remove: (k) => internal.remove("iid:" + k)
    };
  }
  function gcmApi(h) {
    const { ext, fn } = h;
    const s = idStore(ext);
    return {
      MAX_MESSAGE_SIZE: 4096,
      register: fn(async (senderIds = []) => {
        if (!senderIds.length) throw new Error("At least one sender ID is required.");
        let t = s.get("gcm");
        if (!t) {
          t = rid(11) + ":" + rid(140);
          await s.set("gcm", t);
        }
        return t;
      }),
      unregister: fn(() => s.remove("gcm")),
      send: fn((m = {}) => {
        if (JSON.stringify(m.data || {}).length > 4096) throw new Error("Message is too large.");
        return m.messageId;
      }),
      onMessage: h.event("gcm.onMessage"),
      onMessagesDeleted: h.event("gcm.onMessagesDeleted"),
      onSendError: h.event("gcm.onSendError")
    };
  }
  function instanceIDApi(h) {
    const { ext, fn } = h;
    const s = idStore(ext);
    const ensure = async () => {
      let id = s.get("id");
      if (!id) {
        id = rid(11);
        await s.set("id", id);
        await s.set("created", Date.now());
      }
      return id;
    };
    return {
      getID: fn(ensure),
      getCreationTime: fn(async () => {
        await ensure();
        return s.get("created");
      }),
      getToken: fn(async (o = {}) => {
        await ensure();
        const key = `token:${o.authorizedEntity}:${o.scope}`;
        let t = s.get(key);
        if (!t) {
          t = await ensure() + ":" + rid(140);
          await s.set(key, t);
        }
        return t;
      }),
      deleteToken: fn((o = {}) => s.remove(`token:${o.authorizedEntity}:${o.scope}`)),
      deleteID: fn(async () => {
        for (const k of Object.keys(ext.storage.internal().data)) if (k.startsWith("iid:")) await ext.storage.internal().remove(k);
      }),
      onTokenRefresh: h.event("instanceID.onTokenRefresh")
    };
  }
  function engineVoices(ext) {
    return ext.shared("ttsEngineVoices", () => (ext.manifest.tts_engine && ext.manifest.tts_engine.voices || []).map((v) => ({
      voiceName: v.voice_name,
      lang: v.lang,
      eventTypes: v.event_types || [],
      remote: !!v.remote,
      extensionId: ext.id
    })));
  }
  function ttsEngineApi(h) {
    const { ext } = h;
    const evs = {};
    for (const e of ["onSpeak", "onSpeakWithAudioStream", "onStop", "onPause", "onResume", "onInstallLanguageRequest", "onLanguageStatusRequest", "onUninstallLanguageRequest"]) evs[e] = h.event("ttsEngine." + e);
    return {
      updateVoices: (voices = []) => {
        const list = engineVoices(ext);
        list.splice(0, list.length, ...voices.map((v) => ({ ...v, extensionId: ext.id })));
        ext.dispatch("tts.onVoicesChanged", []);
      },
      updateLanguage: (status) => ext.dispatch("ttsEngine.onLanguageStatusUpdate", [status]),
      sendTtsEvent: (requestId, event) => {
        const r = ext.state.ttsRequests && ext.state.ttsRequests.get(requestId);
        if (r) r(event);
      },
      sendTtsAudio: () => {
      },
      ...evs
    };
  }
  var b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  var unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)).buffer;
  function toJSONish(v) {
    if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return b64u(v);
    if (Array.isArray(v)) return v.map(toJSONish);
    if (v && typeof v === "object") {
      const o = {};
      for (const k in v) if (v[k] !== void 0 && typeof v[k] !== "function" && !(v[k] instanceof AbortSignal)) o[k] = toJSONish(v[k]);
      return o;
    }
    return v;
  }
  function credentialFromJSON(j) {
    const r = j.response || {};
    const response = {};
    for (const k of ["clientDataJSON", "attestationObject", "authenticatorData", "signature", "userHandle", "publicKey"]) if (r[k]) response[k] = unb64u(r[k]);
    response.getTransports = () => r.transports || [];
    response.getPublicKeyAlgorithm = () => r.publicKeyAlgorithm;
    response.getPublicKey = () => r.publicKey ? unb64u(r.publicKey) : null;
    response.getAuthenticatorData = () => r.authenticatorData ? unb64u(r.authenticatorData) : null;
    return { id: j.id, rawId: unb64u(j.rawId || j.id), type: "public-key", authenticatorAttachment: j.authenticatorAttachment || null, response, getClientExtensionResults: () => j.clientExtensionResults || {}, toJSON: () => j };
  }
  function webAuthenticationProxyApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("webauthnProxy", () => ({ attached: false, pending: /* @__PURE__ */ new Map(), orig: null, n: 1, dispose() {
      this.restore && this.restore();
    } }));
    const request = (event, details) => new Promise((resolve, reject) => {
      const requestId = st.n++;
      st.pending.set(requestId, { resolve, reject });
      ext.dispatch("webAuthenticationProxy." + event, () => [{ requestId, ...details }]);
    });
    return {
      attach: fn(() => {
        if (st.attached) throw new Error("Another extension is already attached.");
        if (!navigator.credentials) throw new Error("WebAuthn is not available on this page.");
        st.attached = true;
        const c = navigator.credentials;
        const orig = { create: c.create.bind(c), get: c.get.bind(c), uvpaa: window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable };
        c.create = (opts = {}) => opts.publicKey ? request("onCreateRequest", { requestDetailsJson: JSON.stringify(toJSONish(opts.publicKey)) }) : orig.create(opts);
        c.get = (opts = {}) => opts.publicKey ? request("onGetRequest", { requestDetailsJson: JSON.stringify(toJSONish(opts.publicKey)) }) : orig.get(opts);
        if (orig.uvpaa) PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = () => request("onIsUvpaaRequest", {});
        st.restore = () => {
          c.create = orig.create;
          c.get = orig.get;
          if (orig.uvpaa) PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = orig.uvpaa;
          st.attached = false;
        };
      }),
      detach: fn(() => {
        if (st.restore) st.restore();
        for (const [id, p] of st.pending) {
          p.reject(new DOMException("The operation either timed out or was not allowed.", "NotAllowedError"));
          ext.dispatch("webAuthenticationProxy.onRequestCanceled", [id]);
        }
        st.pending.clear();
      }),
      completeCreateRequest: fn((d = {}) => {
        const p = st.pending.get(d.requestId);
        if (!p) throw new Error("Invalid requestId.");
        st.pending.delete(d.requestId);
        if (d.error) p.reject(new DOMException(d.error.message || "error", d.error.name || "NotAllowedError"));
        else p.resolve(credentialFromJSON(JSON.parse(d.responseJson)));
      }),
      completeGetRequest: fn((d = {}) => {
        const p = st.pending.get(d.requestId);
        if (!p) throw new Error("Invalid requestId.");
        st.pending.delete(d.requestId);
        if (d.error) p.reject(new DOMException(d.error.message || "error", d.error.name || "NotAllowedError"));
        else p.resolve(credentialFromJSON(JSON.parse(d.responseJson)));
      }),
      completeIsUvpaaRequest: fn((d = {}) => {
        const p = st.pending.get(d.requestId);
        if (!p) throw new Error("Invalid requestId.");
        st.pending.delete(d.requestId);
        p.resolve(!!d.isUvpaa);
      }),
      onCreateRequest: h.event("webAuthenticationProxy.onCreateRequest"),
      onGetRequest: h.event("webAuthenticationProxy.onGetRequest"),
      onIsUvpaaRequest: h.event("webAuthenticationProxy.onIsUvpaaRequest"),
      onRemoteSessionStateChange: h.event("webAuthenticationProxy.onRemoteSessionStateChange"),
      onRequestCanceled: h.event("webAuthenticationProxy.onRequestCanceled")
    };
  }
  function mimeHandlerApi(h) {
    const { fn } = h;
    return {
      getStreamInfo: fn(() => {
        throw new Error("This page is not a MIME handler view.");
      }),
      abortAndFallbackToNativeHandler: fn(() => {
      }),
      getMimeHandlerOptions: fn(() => ({})),
      setMimeHandlerOptions: fn(() => {
      })
    };
  }
  function telemetryApi(h) {
    const noop = h.fn(() => {
    });
    return {
      submitPing: noop,
      submitEncryptedPing: noop,
      canUpload: h.fn(() => false),
      scalarAdd: noop,
      scalarSet: noop,
      scalarSetMaximum: noop,
      keyedScalarAdd: noop,
      keyedScalarSet: noop,
      keyedScalarSetMaximum: noop,
      recordEvent: noop,
      registerScalars: noop,
      registerEvents: noop,
      setEventRecordingEnabled: noop
    };
  }
  function geckoProfilerApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("profiler", () => ({ running: false, start: 0 }));
    const profile2 = () => ({ meta: { version: 27, startTime: st.start, interval: 1, product: "ExtShim", platform: navigator.platform }, threads: [], libs: [], processes: [], pausedRanges: [] });
    return {
      start: fn(() => {
        st.running = true;
        st.start = Date.now();
        ext.dispatch("geckoProfiler.onRunning", [true]);
      }),
      stop: fn(() => {
        st.running = false;
        ext.dispatch("geckoProfiler.onRunning", [false]);
      }),
      pause: fn(() => {
      }),
      resume: fn(() => {
      }),
      getProfile: fn(() => profile2()),
      getProfileAsArrayBuffer: fn(() => new TextEncoder().encode(JSON.stringify(profile2())).buffer),
      getProfileAsGzippedArrayBuffer: fn(async () => new Response(new Blob([JSON.stringify(profile2())]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer()),
      dumpProfileToFile: fn((name) => {
        const a = document.createElement("a");
        a.download = name || "profile.json";
        a.href = URL.createObjectURL(new Blob([JSON.stringify(profile2())]));
        a.click();
      }),
      getSymbols: fn(() => [new Uint32Array(0), new Uint32Array(0), new Uint8Array(0)]),
      onRunning: h.event("geckoProfiler.onRunning")
    };
  }
  function normandyAddonStudyApi(h) {
    const { fn } = h;
    return {
      getStudy: fn(() => void 0),
      endStudy: fn(() => {
      }),
      getClientMetadata: fn(() => ({ updateChannel: "release", fxVersion: "", clientID: "" })),
      onUnenroll: h.event("normandyAddonStudy.onUnenroll")
    };
  }
  function pkcs11Api(h) {
    const { fn } = h;
    return {
      isModuleInstalled: fn(() => false),
      installModule: fn((name) => {
        throw new Error(`No such PKCS#11 module ${name}`);
      }),
      uninstallModule: fn((name) => {
        throw new Error(`No such PKCS#11 module ${name}`);
      }),
      getModuleSlots: fn((name) => {
        throw new Error(`No such PKCS#11 module ${name}`);
      })
    };
  }
  function urlbarApi(h) {
    const { ext, fn } = h;
    return {
      closeView: fn(() => {
      }),
      focus: fn(() => {
      }),
      search: fn((s) => {
        if (ext.state.omnibox) ext.state.omnibox.open();
        void s;
      }),
      engagementTelemetry: { get: fn(() => ({ value: false, levelOfControl: "not_controllable" })), set: fn(() => {
      }), clear: fn(() => {
      }), onChange: h.event("urlbar.engagementTelemetry.onChange") },
      onBehaviorRequested: h.event("urlbar.onBehaviorRequested"),
      onEngagement: h.event("urlbar.onEngagement"),
      onQueryCanceled: h.event("urlbar.onQueryCanceled"),
      onResultsRequested: h.event("urlbar.onResultsRequested"),
      onResultPicked: h.event("urlbar.onResultPicked")
    };
  }
  function activityLogApi(h) {
    return { onExtensionActivity: h.event("activityLog.onExtensionActivity") };
  }
  function audioApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("audio", () => {
      const s = { mute: { INPUT: false, OUTPUT: false }, levels: {}, active: /* @__PURE__ */ new Set() };
      const changed = async () => ext.dispatch("audio.onDeviceListChanged", [await devices()]);
      if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener("devicechange", changed);
      s.dispose = () => navigator.mediaDevices && navigator.mediaDevices.removeEventListener && navigator.mediaDevices.removeEventListener("devicechange", changed);
      return s;
    });
    const devices = async () => {
      let list = [];
      try {
        list = await navigator.mediaDevices.enumerateDevices();
      } catch {
      }
      return list.filter((d) => d.kind === "audioinput" || d.kind === "audiooutput").map((d, i) => ({
        id: d.deviceId || String(i),
        stableDeviceId: d.groupId || d.deviceId,
        streamType: d.kind === "audioinput" ? "INPUT" : "OUTPUT",
        deviceType: d.kind === "audioinput" ? "MIC" : "HEADPHONE",
        displayName: d.label || (d.kind === "audioinput" ? "Microphone" : "Speaker"),
        deviceName: d.label || d.kind,
        isActive: d.deviceId === "default" || st.active.has(d.deviceId),
        level: st.levels[d.deviceId] ?? 50
      }));
    };
    return {
      getDevices: fn(async (f = {}) => (await devices()).filter((d) => (!f.streamTypes || f.streamTypes.includes(d.streamType)) && (f.isActive == null || d.isActive === f.isActive))),
      getMute: fn((t) => !!st.mute[t]),
      setMute: fn((t, m) => {
        st.mute[t] = !!m;
        ext.dispatch("audio.onMuteChanged", [{ streamType: t, isMuted: !!m }]);
      }),
      setActiveDevices: fn((ids = {}) => {
        st.active = /* @__PURE__ */ new Set([...ids.input || [], ...ids.output || []]);
      }),
      setProperties: fn((id, p = {}) => {
        if (p.level != null) {
          st.levels[id] = p.level;
          ext.dispatch("audio.onLevelChanged", [{ deviceId: id, level: p.level }]);
        }
      }),
      onDeviceListChanged: h.event("audio.onDeviceListChanged"),
      onLevelChanged: h.event("audio.onLevelChanged"),
      onMuteChanged: h.event("audio.onMuteChanged")
    };
  }
  function certificateProviderApi(h) {
    const { fn } = h;
    return {
      setCertificates: fn(() => {
      }),
      reportSignature: fn(() => {
      }),
      stopPinRequest: fn(() => {
      }),
      requestPin: fn(() => ({ userInput: "" })),
      onCertificatesUpdateRequested: h.event("certificateProvider.onCertificatesUpdateRequested"),
      onSignatureRequested: h.event("certificateProvider.onSignatureRequested"),
      onCertificatesRequested: h.event("certificateProvider.onCertificatesRequested"),
      onSignDigestRequested: h.event("certificateProvider.onSignDigestRequested")
    };
  }
  function documentScanApi(h) {
    const { fn } = h;
    const none = { result: "NO_SUCH_SCANNER" };
    return {
      getScannerList: fn(() => ({ result: "SUCCESS", scanners: [] })),
      scan: fn(() => {
        throw new Error("No scanners are available.");
      }),
      openScanner: fn((id) => ({ ...none, scannerId: id })),
      closeScanner: fn((h2) => ({ ...none, scannerHandle: h2 })),
      getOptionGroups: fn((h2) => ({ ...none, scannerHandle: h2 })),
      setOptions: fn((h2) => ({ scannerHandle: h2, results: [] })),
      startScan: fn((h2) => ({ ...none, scannerHandle: h2 })),
      readScanData: fn((j) => ({ ...none, job: j })),
      cancelScan: fn((j) => ({ ...none, job: j }))
    };
  }
  function enterpriseApis(h) {
    const { ext, fn } = h;
    const certs = ext.shared("enterpriseCerts", () => ({ user: [], system: [] }));
    const tokens = () => [{ id: "user", subtleCrypto: crypto.subtle, softwareBackedSubtleCrypto: crypto.subtle }];
    return {
      deviceAttributes: {
        getDirectoryDeviceId: fn(() => ""),
        getDeviceSerialNumber: fn(() => ""),
        getDeviceAssetId: fn(() => ""),
        getDeviceAnnotatedLocation: fn(() => ""),
        getDeviceHostname: fn(() => location.hostname)
      },
      hardwarePlatform: {
        getHardwarePlatformInfo: fn(async () => {
          try {
            const hi = navigator.userAgentData ? await navigator.userAgentData.getHighEntropyValues(["model", "platform"]) : {};
            return { manufacturer: hi.platform || "", model: hi.model || "" };
          } catch {
            return { manufacturer: "", model: "" };
          }
        })
      },
      login: { exitCurrentManagedGuestSession: fn(() => {
        throw new Error("Not a managed guest session.");
      }) },
      networkingAttributes: { getNetworkDetails: fn(() => {
        throw new Error("Network details are only available on managed devices.");
      }) },
      platformKeys: {
        getTokens: fn(() => tokens()),
        getCertificates: fn((tokenId) => (certs[tokenId] || []).slice()),
        importCertificate: fn((tokenId, cert) => {
          (certs[tokenId] = certs[tokenId] || []).push(cert);
        }),
        removeCertificate: fn((tokenId, cert) => {
          certs[tokenId] = (certs[tokenId] || []).filter((c) => c !== cert);
        }),
        challengeKey: fn(() => {
          throw new Error("Key attestation is only available on managed ChromeOS devices.");
        }),
        challengeMachineKey: fn(() => {
          throw new Error("Key attestation is only available on managed ChromeOS devices.");
        }),
        challengeUserKey: fn(() => {
          throw new Error("Key attestation is only available on managed ChromeOS devices.");
        })
      }
    };
  }
  function fileBrowserHandlerApi(h) {
    return { onExecute: h.event("fileBrowserHandler.onExecute") };
  }
  function fileSystemProviderApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("fsp", () => ({ mounts: /* @__PURE__ */ new Map() }));
    const out = {
      mount: fn((o = {}) => {
        if (st.mounts.has(o.fileSystemId)) throw new Error("EXISTS");
        st.mounts.set(o.fileSystemId, { fileSystemId: o.fileSystemId, displayName: o.displayName, writable: !!o.writable, openedFilesLimit: o.openedFilesLimit || 0, openedFiles: [], supportsNotifyTag: !!o.supportsNotifyTag, watchers: [] });
      }),
      unmount: fn((o = {}) => {
        if (!st.mounts.delete(o.fileSystemId)) throw new Error("NOT_FOUND");
      }),
      get: fn((id) => {
        const m = st.mounts.get(id);
        if (!m) throw new Error("NOT_FOUND");
        return { ...m };
      }),
      getAll: fn(() => [...st.mounts.values()].map((m) => ({ ...m }))),
      notify: fn(() => {
      })
    };
    for (const e of ["onAbortRequested", "onAddWatcherRequested", "onCloseFileRequested", "onConfigureRequested", "onCopyEntryRequested", "onCreateDirectoryRequested", "onCreateFileRequested", "onDeleteEntryRequested", "onExecuteActionRequested", "onGetActionsRequested", "onGetMetadataRequested", "onMountRequested", "onMoveEntryRequested", "onOpenFileRequested", "onReadDirectoryRequested", "onReadFileRequested", "onRemoveWatcherRequested", "onTruncateRequested", "onUnmountRequested", "onWriteFileRequested"]) out[e] = h.event("fileSystemProvider." + e);
    return out;
  }
  function inputImeApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("ime", () => {
      const s = { ctx: /* @__PURE__ */ new Map(), next: 1, el: null };
      const editable = (el2) => el2 && (el2.isContentEditable || /^(input|textarea)$/i.test(el2.localName));
      const onFocus = (e) => {
        const el2 = e.target;
        if (!editable(el2)) return;
        const id = s.next++;
        s.ctx.set(id, el2);
        s.el = el2;
        el2.__imeId = id;
        ext.dispatch("input.ime.onFocus", [{ contextID: id, type: el2.type === "password" ? "password" : el2.type === "email" ? "email" : el2.type === "url" ? "url" : el2.type === "number" ? "number" : el2.type === "tel" ? "tel" : "text", autoCorrect: true, autoComplete: true, autoCapitalize: "off", spellCheck: el2.spellcheck, shouldDoLearning: true }]);
      };
      const onBlur = (e) => {
        if (e.target.__imeId) {
          ext.dispatch("input.ime.onBlur", [e.target.__imeId]);
          s.ctx.delete(e.target.__imeId);
        }
      };
      document.addEventListener("focusin", onFocus, true);
      document.addEventListener("focusout", onBlur, true);
      s.dispose = () => {
        document.removeEventListener("focusin", onFocus, true);
        document.removeEventListener("focusout", onBlur, true);
      };
      return s;
    });
    const target = (id) => {
      const el2 = st.ctx.get(id);
      if (!el2) throw new Error("Invalid context ID.");
      el2.focus();
      return el2;
    };
    const insert = (el2, text) => {
      if (!document.execCommand("insertText", false, text) && "value" in el2) {
        el2.setRangeText(text, el2.selectionStart, el2.selectionEnd, "end");
        el2.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
      }
    };
    const out = {
      commitText: fn((p = {}) => {
        insert(target(p.contextID), p.text);
        return true;
      }),
      setComposition: fn((p = {}) => {
        const el2 = target(p.contextID);
        el2.dataset.extshimComposition = p.text;
        return true;
      }),
      clearComposition: fn((p = {}) => {
        const el2 = target(p.contextID);
        delete el2.dataset.extshimComposition;
        return true;
      }),
      deleteSurroundingText: fn((p = {}) => {
        const el2 = target(p.contextID);
        if ("value" in el2) {
          const s = el2.selectionStart + p.offset;
          el2.setRangeText("", Math.max(0, s), Math.max(0, s) + p.length, "end");
        }
      }),
      sendKeyEvents: fn((p = {}) => {
        const el2 = target(p.contextID);
        for (const k of p.keyData || []) {
          el2.dispatchEvent(new KeyboardEvent(k.type === "keyup" ? "keyup" : "keydown", { key: k.key, code: k.code, altKey: !!k.altKey, ctrlKey: !!k.ctrlKey, shiftKey: !!k.shiftKey, bubbles: true }));
          if (k.type !== "keyup" && k.key && k.key.length === 1 && !k.ctrlKey && !k.altKey) insert(el2, k.key);
        }
      }),
      keyEventHandled: () => {
      },
      hideInputView: () => {
      },
      setCandidateWindowProperties: fn(() => true),
      setCandidates: fn(() => true),
      setCursorPosition: fn(() => true),
      setAssistiveWindowProperties: fn(() => true),
      setAssistiveWindowButtonHighlighted: fn(() => {
      }),
      setMenuItems: fn(() => {
      }),
      updateMenuItems: fn(() => {
      })
    };
    for (const e of ["onBlur", "onAssistiveWindowButtonClicked", "onCandidateClicked", "onKeyEvent", "onDeactivated", "onInputContextUpdate", "onActivate", "onFocus", "onMenuItemActivated", "onSurroundingTextChanged", "onReset"]) out[e] = h.event("input.ime." + e);
    void st;
    return { ime: out };
  }
  function loginStateApi(h) {
    return { getProfileType: h.fn(() => "USER_PROFILE"), getSessionState: h.fn(() => "IN_SESSION"), onSessionStateChanged: h.event("loginState.onSessionStateChanged") };
  }
  function platformKeysApi(h) {
    const { fn } = h;
    return {
      selectClientCertificates: fn(() => []),
      getKeyPair: fn(() => {
        throw new Error("No client certificates are available.");
      }),
      getKeyPairBySpki: fn(() => {
        throw new Error("No client certificates are available.");
      }),
      subtleCrypto: () => crypto.subtle,
      verifyTLSServerCertificate: fn(() => ({ trusted: false, debug_errors: ["UNKNOWN"] }))
    };
  }
  function vpnProviderApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("vpn", () => ({ configs: /* @__PURE__ */ new Map(), n: 1 }));
    return {
      createConfig: fn((name) => {
        const id = "vpn-" + st.n++;
        st.configs.set(id, name);
        ext.dispatch("vpnProvider.onConfigCreated", [id, name, {}]);
        return id;
      }),
      destroyConfig: fn((id) => {
        if (!st.configs.delete(id)) throw new Error("Unknown configuration.");
        ext.dispatch("vpnProvider.onConfigRemoved", [id]);
      }),
      setParameters: fn(() => {
      }),
      sendPacket: fn(() => {
      }),
      notifyConnectionStateChanged: fn(() => {
      }),
      onPlatformMessage: h.event("vpnProvider.onPlatformMessage"),
      onPacketReceived: h.event("vpnProvider.onPacketReceived"),
      onConfigRemoved: h.event("vpnProvider.onConfigRemoved"),
      onConfigCreated: h.event("vpnProvider.onConfigCreated"),
      onUIEvent: h.event("vpnProvider.onUIEvent")
    };
  }
  function wallpaperApi(h) {
    return { setWallpaper: h.fn(() => {
      throw new Error("Wallpaper can only be changed on ChromeOS.");
    }) };
  }
  defineStartup((ext) => {
    engineVoices(ext);
  }, (ext) => !!ext.manifest.tts_engine);
  defineNamespace("identity", identityApi, { perms: ["identity"] });
  defineNamespace("gcm", gcmApi, { perms: ["gcm"] });
  defineNamespace("instanceID", instanceIDApi, { perms: ["gcm"] });
  defineNamespace("ttsEngine", ttsEngineApi, { perms: ["ttsEngine"] });
  defineNamespace("webAuthenticationProxy", webAuthenticationProxyApi, { perms: ["webAuthenticationProxy"] });
  defineNamespace("mimeHandler", mimeHandlerApi, { perms: ["mimeHandler"] });
  defineNamespace("telemetry", telemetryApi, { perms: ["telemetry"] });
  defineNamespace("geckoProfiler", geckoProfilerApi, { perms: ["geckoProfiler"] });
  defineNamespace("normandyAddonStudy", normandyAddonStudyApi, { perms: ["normandyAddonStudy"] });
  defineNamespace("pkcs11", pkcs11Api, { perms: ["pkcs11"] });
  defineNamespace("urlbar", urlbarApi, { perms: ["urlbar"] });
  defineNamespace("activityLog", activityLogApi, { perms: ["activityLog"] });
  defineNamespace("audio", audioApi, { perms: ["audio"] });
  defineNamespace("certificateProvider", certificateProviderApi, { perms: ["certificateProvider"] });
  defineNamespace("documentScan", documentScanApi, { perms: ["documentScan"] });
  defineNamespace("enterprise", enterpriseApis, { perms: ["enterprise.deviceAttributes", "enterprise.hardwarePlatform", "enterprise.networkingAttributes", "enterprise.platformKeys", "enterprise.login"] });
  defineNamespace("fileBrowserHandler", fileBrowserHandlerApi, { perms: ["fileBrowserHandler"] });
  defineNamespace("fileSystemProvider", fileSystemProviderApi, { perms: ["fileSystemProvider"] });
  defineNamespace("input", inputImeApi, { perms: ["input"] });
  defineNamespace("loginState", loginStateApi, { perms: ["loginState"] });
  defineNamespace("platformKeys", platformKeysApi, { perms: ["platformKeys"] });
  defineNamespace("vpnProvider", vpnProviderApi, { perms: ["vpnProvider"] });
  defineNamespace("wallpaper", wallpaperApi, { perms: ["wallpaper"] });

  // src/runtime/api/devtools-apis.js
  function devtoolsState(ext) {
    return ext.shared("devtools", () => ({
      page: null,
      frame: null,
      drawer: null,
      panels: [],
      panes: [],
      selected: null,
      openResource: null,
      themeHandlers: /* @__PURE__ */ new Set(),
      dispose() {
        if (this.drawer) this.drawer.close();
        if (this.page) this.page.destroy();
        if (this.frame) this.frame.remove();
      }
    }));
  }
  async function openDevTools(ext) {
    if (!ext.manifest.devtools_page) return;
    const st = devtoolsState(ext);
    if (!st.page) {
      st.frame = ext.shim.ui.hiddenFrame(ext, "devtools");
      st.page = await renderPage(ext, { type: "devtools", iframe: st.frame, path: normalizePath(ext.manifest.devtools_page) });
    }
    if (!st.drawer) {
      st.drawer = ext.shim.ui.drawer(ext, {
        title: `${ext.name} \u2014 DevTools`,
        onPick: (el2) => {
          st.selected = el2;
          try {
            Object.defineProperty(window, "$0", { value: el2, configurable: true, writable: true });
          } catch {
          }
          ext.dispatch("devtools.panels.elements.onSelectionChanged", []);
        },
        onClose: () => {
          st.drawer = null;
          for (const p of [...st.panels, ...st.panes]) if (p.ctx) {
            p.ctx.destroy();
            p.ctx = null;
          }
        }
      });
      for (const p of [...st.panels, ...st.panes]) addTab(ext, st, p);
    }
  }
  function addTab(ext, st, p) {
    if (!st.drawer) return;
    p.tab = st.drawer.addTab(p.title, {
      show: async (iframe) => {
        if (p.json !== void 0 && !p.path) {
          st.drawer.showJson(p.tab, p.json);
          p.onShown.dispatch(null);
          return;
        }
        if (!p.path) return;
        if (!p.ctx) p.ctx = await renderPage(ext, { type: "devtools", iframe, path: p.path });
        p.onShown.dispatch(p.ctx.win);
      },
      hide: () => p.onHidden.dispatch()
    });
  }
  defineStartup((ext) => {
    const client = { ext, decide: () => null, notify: () => {
    } };
    ext.cleanups.push(getInterceptor(ext.shim).addClient(client));
    const fn = (entry) => ext.dispatch("devtools.network.onRequestFinished", () => [harEntry(ext, entry)]);
    getInterceptor(ext.shim).listeners.add(fn);
    ext.cleanups.push(() => getInterceptor(ext.shim).listeners.delete(fn));
    ext.navHooks.add((url) => ext.dispatch("devtools.network.onNavigated", [url]));
  }, (ext) => !!ext.manifest.devtools_page);
  function harEntry(ext, e) {
    const q = (() => {
      try {
        return [...new URL(e.url).searchParams].map(([name, value]) => ({ name, value }));
      } catch {
        return [];
      }
    })();
    const time = Math.max(0, (e.endTime || e.timeStamp) - e.timeStamp);
    const mime = ((e.responseHeaders || []).find((x) => x.name.toLowerCase() === "content-type") || {}).value || "";
    return {
      startedDateTime: new Date(e.timeStamp).toISOString(),
      time,
      request: { method: e.method || "GET", url: e.url, httpVersion: "HTTP/1.1", headers: (e.requestHeaders || []).map((x) => ({ ...x })), queryString: q, cookies: [], headersSize: -1, bodySize: -1 },
      response: { status: e.statusCode || 0, statusText: "", httpVersion: "HTTP/1.1", headers: (e.responseHeaders || []).map((x) => ({ ...x })), cookies: [], content: { size: e.size || -1, mimeType: mime }, redirectURL: "", headersSize: -1, bodySize: -1, _error: e.error },
      cache: {},
      timings: { blocked: -1, dns: -1, connect: -1, send: 0, wait: time, receive: 0, ssl: -1 },
      serverIPAddress: "",
      _resourceType: e.type,
      getContent(cb) {
        const p = ext.shim.nativeFetch(e.url).then((r) => r.text()).then((t) => [t, ""], () => ["", ""]);
        if (typeof cb === "function") p.then(([c, enc]) => cb(c, enc));
        return p;
      }
    };
  }
  function devtoolsApi(h) {
    const { ext, ctx } = h;
    const st = devtoolsState(ext);
    const cbOrPromise = (cb, p) => {
      if (typeof cb === "function") {
        p.then((v) => cb(...Array.isArray(v) ? v : [v]));
        return void 0;
      }
      return p;
    };
    const dark = () => matchMedia("(prefers-color-scheme: dark)").matches;
    if (!st.themeWatch) {
      st.themeWatch = true;
      matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        for (const f of st.themeHandlers) try {
          f(dark() ? "dark" : "default");
        } catch {
        }
      });
    }
    const makeEvent = (name) => new ExtEvent(name, ctx.log);
    const createSidebarPane = (where) => (title, cb) => {
      const pane = { title: `${where} \u203A ${title}`, path: null, json: void 0, onShown: makeEvent("ExtensionSidebarPane.onShown"), onHidden: makeEvent("ExtensionSidebarPane.onHidden") };
      st.panes.push(pane);
      addTab(ext, st, pane);
      const api = {
        onShown: pane.onShown,
        onHidden: pane.onHidden,
        setHeight() {
        },
        setPage(path) {
          pane.path = ext.resolvePath(path, ctx.path) ?? normalizePath(path);
        },
        setObject(json, rootTitle, cb2) {
          pane.json = typeof json === "string" ? json : JSON.stringify(json, null, 2);
          if (st.drawer && pane.tab) st.drawer.showJson(pane.tab, pane.json, true);
          if (typeof cb2 === "function") cb2();
          return Promise.resolve();
        },
        setExpression(expr, rootTitle, cb2) {
          let v;
          try {
            v = canEval() ? (0, eval)(expr) : "(eval blocked by the page)";
          } catch (e) {
            v = String(e);
          }
          try {
            v = JSON.stringify(v, null, 2);
          } catch {
            v = String(v);
          }
          return api.setObject(v, rootTitle, cb2);
        }
      };
      return cbOrPromise(cb, Promise.resolve(api));
    };
    const panels = {
      get themeName() {
        return dark() ? "dark" : "default";
      },
      create(title, iconPath, pagePath, cb) {
        const panel = { title, path: ext.resolvePath(pagePath, ctx.path) ?? normalizePath(pagePath), onShown: makeEvent("ExtensionPanel.onShown"), onHidden: makeEvent("ExtensionPanel.onHidden") };
        st.panels.push(panel);
        addTab(ext, st, panel);
        const api = {
          onShown: panel.onShown,
          onHidden: panel.onHidden,
          onSearch: makeEvent("ExtensionPanel.onSearch"),
          createStatusBarButton: () => ({ onClicked: makeEvent("Button.onClicked"), update() {
          } }),
          show() {
            if (st.drawer && panel.tab) st.drawer.select(panel.tab);
          }
        };
        return cbOrPromise(cb, Promise.resolve(api));
      },
      setOpenResourceHandler(cb) {
        st.openResource = cb || null;
      },
      openResource(url, line, col, cb) {
        if (st.openResource) st.openResource({ url, type: "document" }, line);
        else window.open(url, "_blank");
        return cbOrPromise(cb, Promise.resolve());
      },
      setThemeChangeHandler(cb) {
        if (cb) st.themeHandlers.add(cb);
      },
      onThemeChanged: (() => {
        const e = makeEvent("devtools.panels.onThemeChanged");
        st.themeHandlers.add((t) => e.dispatch(t));
        return e;
      })(),
      elements: { createSidebarPane: createSidebarPane("Elements"), onSelectionChanged: h.event("devtools.panels.elements.onSelectionChanged") },
      sources: { createSidebarPane: createSidebarPane("Sources"), onSelectionChanged: h.event("devtools.panels.sources.onSelectionChanged") }
    };
    const resources = () => {
      const list = [{ url: location.href, type: "document" }];
      for (const e of performance.getEntriesByType("resource")) list.push({ url: e.name, type: { script: "script", link: "stylesheet", css: "image", img: "image", font: "font" }[e.initiatorType] || "other" });
      return list.map((r) => ({
        ...r,
        getContent(cb) {
          const p = (r.url === location.href ? Promise.resolve(document.documentElement.outerHTML) : ext.shim.nativeFetch(r.url).then((x) => x.text())).then((t) => [t, ""], () => ["", ""]);
          return cbOrPromise(cb, p);
        },
        setContent(content, commit, cb) {
          return cbOrPromise(cb, Promise.resolve({ code: "E_NOTSUPPORTED", description: "Resources cannot be edited from a page." }));
        }
      }));
    };
    return {
      inspectedWindow: {
        tabId: ext.shim.tabId,
        eval(expression, options, cb) {
          if (typeof options === "function") {
            cb = options;
            options = {};
          }
          options = options || {};
          let result;
          let exc;
          try {
            if (!canEval()) throw Object.assign(new Error("eval is blocked by the page's Content-Security-Policy"), { protocol: true });
            if (options.useContentScriptContext) result = ext.content.isolated(ext.content.frame(window)).evaluate(String(expression));
            else result = (0, eval)(String(expression));
            result = result === void 0 ? void 0 : JSON.parse(JSON.stringify(result));
          } catch (e) {
            exc = e && e.protocol ? { isError: true, code: "E_PROTOCOLERROR", description: "Inspector protocol error: %s", details: [e.message] } : { isException: true, value: String(e && e.stack ? e.stack.split("\n")[0] : e) };
            result = void 0;
          }
          const p = Promise.resolve([result, exc]);
          if (typeof cb === "function") {
            setTimeout(() => cb(result, exc), 0);
            return void 0;
          }
          return p;
        },
        reload() {
          setTimeout(() => location.reload(), 0);
        },
        getResources(cb) {
          return cbOrPromise(cb, Promise.resolve(resources()));
        },
        onResourceAdded: h.event("devtools.inspectedWindow.onResourceAdded"),
        onResourceContentCommitted: h.event("devtools.inspectedWindow.onResourceContentCommitted")
      },
      network: {
        getHAR(cb) {
          const har = { version: "1.2", creator: { name: "ExtShim", version: ext.shim.version }, pages: [{ startedDateTime: new Date(performance.timeOrigin).toISOString(), id: "page_1", title: document.title, pageTimings: {} }], entries: getInterceptor(ext.shim).log.map((e) => harEntry(ext, e)) };
          return cbOrPromise(cb, Promise.resolve(har));
        },
        onRequestFinished: h.event("devtools.network.onRequestFinished"),
        onNavigated: h.event("devtools.network.onNavigated")
      },
      panels,
      performance: { onProfilingStarted: h.event("devtools.performance.onProfilingStarted"), onProfilingStopped: h.event("devtools.performance.onProfilingStopped") },
      recorder: {
        createView(title, pagePath) {
          const view = { title: "Recorder \u203A " + title, path: ext.resolvePath(pagePath, ctx.path) ?? normalizePath(pagePath), onShown: makeEvent("RecorderView.onShown"), onHidden: makeEvent("RecorderView.onHidden") };
          st.panels.push(view);
          addTab(ext, st, view);
          return { onShown: view.onShown, onHidden: view.onHidden, show() {
            openDevTools(ext).then(() => st.drawer && view.tab && st.drawer.select(view.tab));
          } };
        },
        registerRecorderExtensionPlugin() {
        }
      }
    };
  }
  function remoteObject(v, byValue) {
    const t = typeof v;
    if (v === null) return { type: "object", subtype: "null", value: null };
    if (t === "undefined") return { type: "undefined" };
    if (t === "object" || t === "function") {
      const o = { type: t, className: v && v.constructor && v.constructor.name || "Object", description: t === "function" ? String(v).slice(0, 100) : v instanceof Node ? v.nodeName : Array.isArray(v) ? `Array(${v.length})` : "Object" };
      if (v instanceof Node) o.subtype = "node";
      else if (Array.isArray(v)) o.subtype = "array";
      if (byValue) {
        try {
          o.value = JSON.parse(JSON.stringify(v));
        } catch {
        }
      }
      return o;
    }
    return { type: t, value: v, description: String(v) };
  }
  function debuggerApi(h) {
    const { ext, fn } = h;
    const st = ext.shared("debugger", () => ({ attached: /* @__PURE__ */ new Map(), nodes: /* @__PURE__ */ new Map(), nodeIds: /* @__PURE__ */ new WeakMap(), next: 1, headers: null, netOff: null, dispose() {
      for (const a of this.attached.values()) a.banner.remove();
    } }));
    const key = (t = {}) => String(t.tabId ?? t.targetId ?? t.extensionId);
    const target = () => ({ type: "page", id: "T" + ext.shim.tabId, title: document.title, url: location.href, attached: st.attached.size > 0, tabId: ext.shim.tabId, faviconUrl: ext.pageTab().favIconUrl });
    const emit = (source, method, params) => ext.dispatch("debugger.onEvent", () => [{ ...source }, method, JSON.parse(JSON.stringify(params))]);
    const nodeId = (n) => {
      if (!n) return 0;
      let id = st.nodeIds.get(n);
      if (!id) {
        id = st.next++;
        st.nodeIds.set(n, id);
        st.nodes.set(id, n);
      }
      return id;
    };
    const node = (id) => {
      const n = id ? st.nodes.get(id) : document;
      if (!n) throw new Error('{"code":-32000,"message":"Could not find node with given id"}');
      return n;
    };
    const describe = (n, depth = 1) => {
      const d = { nodeId: nodeId(n), backendNodeId: nodeId(n), nodeType: n.nodeType, nodeName: n.nodeName, localName: n.localName || "", nodeValue: n.nodeValue || "", childNodeCount: n.childNodes.length };
      if (n.attributes) d.attributes = [...n.attributes].flatMap((a) => [a.name, a.value]);
      if (n === document) {
        d.documentURL = location.href;
        d.baseURL = document.baseURI;
      }
      if (depth > 0 || depth === -1) d.children = [...n.childNodes].filter((c) => c.nodeType !== 3 || c.nodeValue.trim()).map((c) => describe(c, depth === -1 ? -1 : depth - 1));
      return d;
    };
    const mouse = (p) => {
      const el2 = document.elementFromPoint(p.x, p.y) || document.body;
      const map = { mousePressed: "mousedown", mouseReleased: "mouseup", mouseMoved: "mousemove", mouseWheel: "wheel" };
      const init = { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, button: { left: 0, middle: 1, right: 2 }[p.button] ?? 0, detail: p.clickCount || 1, altKey: !!(p.modifiers & 1), ctrlKey: !!(p.modifiers & 2), metaKey: !!(p.modifiers & 4), shiftKey: !!(p.modifiers & 8) };
      if (p.type === "mouseWheel") el2.dispatchEvent(new WheelEvent("wheel", { ...init, deltaX: p.deltaX || 0, deltaY: p.deltaY || 0 }));
      else {
        el2.dispatchEvent(new PointerEvent(map[p.type].replace("mouse", "pointer"), init));
        el2.dispatchEvent(new MouseEvent(map[p.type], init));
        if (p.type === "mousePressed" && el2.focus) el2.focus();
        if (p.type === "mouseReleased") el2.dispatchEvent(new MouseEvent(init.button === 2 ? "contextmenu" : "click", init));
      }
    };
    const key2 = (p) => {
      const el2 = document.activeElement || document.body;
      const init = { key: p.key, code: p.code, keyCode: p.windowsVirtualKeyCode || 0, bubbles: true, cancelable: true, altKey: !!(p.modifiers & 1), ctrlKey: !!(p.modifiers & 2), metaKey: !!(p.modifiers & 4), shiftKey: !!(p.modifiers & 8) };
      if (p.type === "keyUp") el2.dispatchEvent(new KeyboardEvent("keyup", init));
      else if (p.type === "char") document.execCommand("insertText", false, p.text || "");
      else {
        const ok = el2.dispatchEvent(new KeyboardEvent("keydown", init));
        if (ok && p.type === "keyDown" && p.text) document.execCommand("insertText", false, p.text);
      }
    };
    const commands = {
      "Browser.getVersion": () => ({ protocolVersion: "1.3", product: "ExtShim/" + ext.shim.version, revision: "", userAgent: navigator.userAgent, jsVersion: "" }),
      "Target.getTargets": () => ({ targetInfos: [{ targetId: target().id, type: "page", title: document.title, url: location.href, attached: true, canAccessOpener: false }] }),
      "Page.navigate": (p) => {
        setTimeout(() => {
          location.href = p.url;
        }, 0);
        return { frameId: "main", loaderId: "L" + Date.now() };
      },
      "Page.reload": () => {
        setTimeout(() => location.reload(), 0);
        return {};
      },
      "Page.captureScreenshot": async (p) => {
        const url = await captureVisibleTab({ format: p.format === "png" || !p.format ? "png" : "jpeg", quality: p.quality });
        return { data: url.split(",")[1] };
      },
      "Page.getLayoutMetrics": () => {
        const vp = { pageX: scrollX, pageY: scrollY, clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight };
        const size = { x: 0, y: 0, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight };
        return { layoutViewport: vp, cssLayoutViewport: vp, visualViewport: { offsetX: 0, offsetY: 0, ...vp, scale: 1, zoom: 1 }, cssVisualViewport: { offsetX: 0, offsetY: 0, ...vp, scale: 1, zoom: 1 }, contentSize: size, cssContentSize: size };
      },
      "Page.getFrameTree": () => ({ frameTree: { frame: { id: "main", loaderId: "L", url: location.href, domainAndRegistry: "", securityOrigin: location.origin, mimeType: document.contentType, adFrameStatus: { adFrameType: "none" }, secureContextType: isSecureContext ? "Secure" : "InsecureScheme", crossOriginIsolatedContextType: "NotIsolated", gatedAPIFeatures: [] } } }),
      "Runtime.evaluate": async (p) => {
        if (!canEval()) return { result: { type: "undefined" }, exceptionDetails: { exceptionId: 1, text: "EvalError: eval is blocked by the page's Content-Security-Policy", lineNumber: 0, columnNumber: 0 } };
        try {
          let v = (0, eval)(String(p.expression));
          if (p.awaitPromise && v && typeof v.then === "function") v = await v;
          return { result: remoteObject(v, p.returnByValue) };
        } catch (e) {
          return { result: remoteObject(e, false), exceptionDetails: { exceptionId: 1, text: "Uncaught", lineNumber: 0, columnNumber: 0, exception: { type: "object", subtype: "error", className: e && e.name, description: String(e && e.stack || e) } } };
        }
      },
      "DOM.getDocument": (p) => ({ root: describe(document, p.depth == null ? 2 : p.depth) }),
      "DOM.describeNode": (p) => ({ node: describe(node(p.nodeId || p.backendNodeId), p.depth || 0) }),
      "DOM.getOuterHTML": (p) => {
        const n = node(p.nodeId || p.backendNodeId);
        return { outerHTML: n === document ? "<!DOCTYPE html>" + document.documentElement.outerHTML : n.outerHTML || n.nodeValue || "" };
      },
      "DOM.setOuterHTML": (p) => {
        node(p.nodeId).outerHTML = p.outerHTML;
        return {};
      },
      "DOM.querySelector": (p) => ({ nodeId: nodeId(node(p.nodeId).querySelector(p.selector)) }),
      "DOM.querySelectorAll": (p) => ({ nodeIds: [...node(p.nodeId).querySelectorAll(p.selector)].map(nodeId) }),
      "DOM.setAttributeValue": (p) => {
        node(p.nodeId).setAttribute(p.name, p.value);
        return {};
      },
      "DOM.removeAttribute": (p) => {
        node(p.nodeId).removeAttribute(p.name);
        return {};
      },
      "DOM.removeNode": (p) => {
        node(p.nodeId).remove();
        return {};
      },
      "DOM.focus": (p) => {
        node(p.nodeId || p.backendNodeId).focus();
        return {};
      },
      "DOM.scrollIntoViewIfNeeded": (p) => {
        node(p.nodeId || p.backendNodeId).scrollIntoView({ block: "center" });
        return {};
      },
      "DOM.getBoxModel": (p) => {
        const r = node(p.nodeId || p.backendNodeId).getBoundingClientRect();
        const q = [r.left, r.top, r.right, r.top, r.right, r.bottom, r.left, r.bottom];
        return { model: { content: q, padding: q, border: q, margin: q, width: r.width, height: r.height } };
      },
      "Input.dispatchMouseEvent": (p) => {
        mouse(p);
        return {};
      },
      "Input.dispatchKeyEvent": (p) => {
        key2(p);
        return {};
      },
      "Input.insertText": (p) => {
        document.execCommand("insertText", false, p.text);
        return {};
      },
      "Network.setExtraHTTPHeaders": (p) => {
        st.headers = Object.entries(p.headers || {}).map(([name, value]) => ({ name, value: String(value) }));
        return {};
      },
      "Network.enable": (p, source) => {
        if (!st.netOff) {
          const client = {
            ext,
            decide: (stage, d) => {
              if (stage === "beforeRequest") emit(source, "Network.requestWillBeSent", { requestId: d.requestId, loaderId: "L", documentURL: location.href, request: { url: d.url, method: d.method, headers: Object.fromEntries((d.requestHeaders || []).map((x) => [x.name, x.value])) }, timestamp: performance.now() / 1e3, wallTime: Date.now() / 1e3, initiator: { type: "script" }, type: d.type === "xmlhttprequest" ? "XHR" : "Other" });
              if (stage === "beforeSendHeaders" && st.headers) return { requestHeaders: [...(d.requestHeaders || []).filter((x) => !st.headers.some((y) => y.name.toLowerCase() === x.name.toLowerCase())), ...st.headers] };
              return null;
            },
            notify: (ev, d) => {
              if (ev === "onCompleted") {
                emit(source, "Network.responseReceived", { requestId: d.requestId, loaderId: "L", timestamp: performance.now() / 1e3, type: d.type === "xmlhttprequest" ? "XHR" : "Other", response: { url: d.url, status: d.statusCode, statusText: "", headers: Object.fromEntries((d.responseHeaders || []).map((x) => [x.name, x.value])), mimeType: "", connectionReused: false, connectionId: 0, encodedDataLength: 0, securityState: "unknown" } });
                emit(source, "Network.loadingFinished", { requestId: d.requestId, timestamp: performance.now() / 1e3, encodedDataLength: 0 });
              } else if (ev === "onErrorOccurred") emit(source, "Network.loadingFailed", { requestId: d.requestId, timestamp: performance.now() / 1e3, type: "Other", errorText: d.error, canceled: d.error === "net::ERR_ABORTED" });
            }
          };
          st.netOff = getInterceptor(ext.shim).addClient(client);
        }
        return {};
      },
      "Network.disable": () => {
        if (st.netOff) {
          st.netOff();
          st.netOff = null;
        }
        return {};
      },
      "Runtime.enable": () => ({}),
      "Page.enable": () => ({}),
      "DOM.enable": () => ({}),
      "CSS.enable": () => ({}),
      "Log.enable": () => ({}),
      "Console.enable": () => ({}),
      "Overlay.enable": () => ({}),
      "Emulation.setDeviceMetricsOverride": () => ({}),
      "Emulation.clearDeviceMetricsOverride": () => ({}),
      "Emulation.setUserAgentOverride": () => ({}),
      "Network.setUserAgentOverride": () => ({}),
      "Network.setCacheDisabled": () => ({}),
      "Runtime.disable": () => ({}),
      "Page.disable": () => ({}),
      "DOM.disable": () => ({})
    };
    return {
      attach: fn((t = {}, version) => {
        if (t.tabId != null && t.tabId !== ext.shim.tabId) throw new Error(`No tab with given id ${t.tabId}.`);
        if (version && !/^1\./.test(version)) throw new Error(`Requested protocol version is not supported: ${version}.`);
        const k = key(t);
        if (st.attached.has(k)) throw new Error("Another debugger is already attached to the tab with id: " + ext.shim.tabId + ".");
        const banner = ext.shim.ui.banner(ext, `"${ext.name}" started debugging this page`, () => {
          st.attached.delete(k);
          ext.dispatch("debugger.onDetach", () => [{ ...t }, "canceled_by_user"]);
        });
        st.attached.set(k, { target: t, banner });
      }),
      detach: fn((t = {}) => {
        const a = st.attached.get(key(t));
        if (!a) throw new Error("Debugger is not attached to the tab with id: " + ext.shim.tabId + ".");
        a.banner.remove();
        st.attached.delete(key(t));
        if (!st.attached.size && st.netOff) {
          st.netOff();
          st.netOff = null;
        }
      }),
      sendCommand: fn(async (t = {}, method, params = {}) => {
        if (!st.attached.has(key(t))) throw new Error("Debugger is not attached to the tab with id: " + ext.shim.tabId + ".");
        const c = commands[method];
        if (!c) throw new Error(JSON.stringify({ code: -32601, message: `'${method}' wasn't found` }));
        return c(params || {}, t);
      }),
      getTargets: fn(() => [target()]),
      onEvent: h.event("debugger.onEvent"),
      onDetach: h.event("debugger.onDetach")
    };
  }
  features.openDevTools = openDevTools;
  defineNamespace("devtools", devtoolsApi, { always: true, contexts: "devtools", when: (ext) => !!ext.manifest.devtools_page || ext.options.allApis });
  defineNamespace("debugger", debuggerApi, { perms: ["debugger"] });

  // src/runtime/index.js
  var index_default = core_default;
  return __toCommonJS(index_exports);
})();
ExtShim=ExtShim.default;
