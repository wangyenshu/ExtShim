// "Worlds": emulated JavaScript global environments for extension code.
//
// A World owns a `locals` store (per-world globals such as chrome, browser, window...)
// layered over a real global object (`target`): the page window for content scripts,
// or a hidden iframe's window for background/extension pages.
//
//  - isolated worlds (content scripts) cannot see globals the page defined and their
//    writes never leak into the page, much like Chrome's isolated worlds;
//  - frame worlds (extension pages) write through to their iframe window, so
//    chrome.extension.getBackgroundPage().someFunction() works as in MV2.
//
// Units (see core/bundle.js) run inside `with (world.scope)`, which routes every free
// identifier through these traps.

import { UNIT_PARAM, unitFunctionBody, wrapClassicScript } from '../core/bundle.js';
import { scanTopLevelDeclarations } from '../core/scan.js';

const INTRINSICS = new Set(('Object Function Array Number parseFloat parseInt Infinity NaN undefined Boolean String Symbol Date Promise ' +
  'RegExp Error AggregateError EvalError RangeError ReferenceError SyntaxError TypeError URIError JSON Math Intl ArrayBuffer ' +
  'SharedArrayBuffer Atomics Uint8Array Int8Array Uint16Array Int16Array Uint32Array Int32Array Float32Array Float64Array ' +
  'Float16Array Uint8ClampedArray BigUint64Array BigInt64Array DataView Map BigInt Set WeakMap WeakSet WeakRef FinalizationRegistry ' +
  'Proxy Reflect decodeURI decodeURIComponent encodeURI encodeURIComponent escape unescape eval isFinite isNaN Iterator ' +
  'SuppressedError DisposableStack AsyncDisposableStack').split(' '));

const fnToString = Function.prototype.toString;
const hasOwn = Object.prototype.hasOwnProperty;

let pristineCache = null;
/** Names present on a fresh window (platform globals). Anything else on the page window was added by page scripts. */
export function pristineGlobals(doc = document) {
  if (pristineCache) return pristineCache;
  const names = new Set();
  try {
    const f = doc.createElement('iframe');
    f.style.cssText = 'display:none!important';
    (doc.documentElement || doc).appendChild(f);
    let o = f.contentWindow;
    while (o) { for (const k of Object.getOwnPropertyNames(o)) names.add(k); o = Object.getPrototypeOf(o); }
    f.remove();
  } catch { /* fall back to "everything visible" */ }
  pristineCache = names.size ? names : null;
  return pristineCache;
}

export class World {
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
    this.isolated = kind === 'content';
    this.locals = Object.create(null);
    this.redirect = null;
    this._bound = new WeakMap();
    this._accessorCache = new Map();
    this._msgWrappers = new WeakMap();
    this.pristine = this.isolated ? pristineGlobals(target.document) : null;
    const world = this;

    this.proxy = new Proxy(Object.create(null), {
      get: (_, k) => world.get(k),
      set: (_, k, v) => { world.set(k, v); return true; },
      has: (_, k) => world.hasName(k),
      deleteProperty: (_, k) => {
        if (k in world.locals) return delete world.locals[k];
        if (!world.isolated) return Reflect.deleteProperty(world.target, k);
        return true;
      },
      defineProperty: (_, k, desc) => {
        const into = world.isolated || k in world.locals ? world.locals : world.target;
        try { Object.defineProperty(into, k, desc); } catch { Object.defineProperty(world.locals, k, { ...desc, configurable: true }); }
        return true;
      },
      getOwnPropertyDescriptor: (_, k) => {
        let d = Object.getOwnPropertyDescriptor(world.locals, k);
        if (!d && world.visible(k)) d = Object.getOwnPropertyDescriptor(world.target, k);
        return d ? { ...d, configurable: true } : undefined;
      },
      ownKeys: () => {
        const keys = new Set(Reflect.ownKeys(world.locals));
        for (const k of Reflect.ownKeys(world.target)) if (world.visible(k)) keys.add(k);
        return [...keys];
      },
      getPrototypeOf: () => Object.getPrototypeOf(world.target),
      setPrototypeOf: () => false,
    });

    this.scope = new Proxy(Object.create(null), {
      has: (_, k) => {
        if (typeof k === 'symbol' || k === UNIT_PARAM) return false;
        if (INTRINSICS.has(k) && !(k in world.locals)) return false;
        return true;
      },
      get: (_, k) => (k === Symbol.unscopables ? undefined : world.get(k)),
      set: (_, k, v) => { world.set(k, v); return true; },
    });

    this.unitArg = Object.freeze({ scope: this.scope, expose: (defs) => this.expose(defs) });
    const p = this.proxy;
    Object.assign(this.locals, { window: p, self: p, globalThis: p, frames: p });
    if (this.kind !== 'main') {
      this.locals.addEventListener = (type, listener, opts) => target.addEventListener(type, this._wrapListener(type, listener), opts);
      this.locals.removeEventListener = (type, listener, opts) => target.removeEventListener(type, this._msgWrappers.get(listener) || listener, opts);
    } else {
      delete this.locals.window; delete this.locals.self; delete this.locals.globalThis; delete this.locals.frames;
    }
  }

  /** Is a target property visible from this world? (isolated worlds hide page-defined globals) */
  visible(k) {
    const t = this.target;
    if (!(k in t)) return false;
    if (!this.isolated || typeof k === 'symbol' || !this.pristine) return true;
    return !hasOwn.call(t, k) || this.pristine.has(k);
  }

  hasName(k) {
    return k in this.locals || this.visible(k);
  }

  get(k) {
    const w = this.redirect || this;
    if (k in w.locals) return w.locals[k];
    if (!w.visible(k)) return undefined;
    const v = Reflect.get(w.target, k);
    return typeof v === 'function' ? w._bind(v) : v;
  }

  set(k, v) {
    const w = this.redirect || this;
    if (k in w.locals) { w.locals[k] = v; return; }
    if (!w.isolated || w._isTargetAccessor(k)) {
      if (k === 'onmessage' && typeof v === 'function') v = w._wrapListener('message', v);
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
      // Bind plain native methods (setTimeout, addEventListener...), but not interface objects
      // such as NodeFilter that carry static constants.
      native = !hasOwn.call(fn, 'prototype') && Object.getOwnPropertyNames(fn).length <= 2 && /\[native code\]\s*\}\s*$/.test(fnToString.call(fn));
    } catch { /* proxies etc. */ }
    b = native ? fn.bind(this.target) : fn;
    if (native) { try { Object.defineProperty(b, 'name', { value: fn.name }); } catch { /* ignore */ } }
    this._bound.set(fn, b);
    return b;
  }

  _isTargetAccessor(k) {
    if (this._accessorCache.has(k)) return this._accessorCache.get(k);
    let o = this.target;
    let result = false;
    while (o) {
      const d = Object.getOwnPropertyDescriptor(o, k);
      if (d) { result = !!d.set; break; }
      o = Object.getPrototypeOf(o);
    }
    this._accessorCache.set(k, result);
    return result;
  }

  /** Make `event.source === window` hold for message events seen from this world. */
  _wrapListener(type, listener) {
    if (type !== 'message' || !listener || this.kind === 'main') return listener;
    let w = this._msgWrappers.get(listener);
    if (w) return w;
    const world = this;
    w = function (e) {
      const ev = new Proxy(e, {
        get(t, k) {
          if (k === 'source' && t.source === world.target) return world.proxy;
          if (k === 'currentTarget' && t.currentTarget === world.target) return world.proxy;
          const v = Reflect.get(t, k, t);
          return typeof v === 'function' ? v.bind(t) : v;
        },
      });
      const self = this === world.target ? world.proxy : this;
      return typeof listener === 'function' ? listener.call(self, ev) : listener.handleEvent(ev);
    };
    this._msgWrappers.set(listener, w);
    return w;
  }

  /** Publish a unit's top-level declarations as globals of this world. */
  expose(defs) {
    for (const name of Object.keys(defs)) {
      const [get, set] = defs[name];
      const desc = { get, set, configurable: true, enumerable: true };
      if (!this.isolated && !(name in this.locals)) {
        try { Object.defineProperty(this.target, name, desc); continue; } catch { /* non-configurable on target */ }
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
      this.log.error(`Uncaught error in ${label || 'script'}:`, e);
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
}

let evalAllowed = null;
/** Is eval/new Function allowed on this page? Tested lazily, at most once. */
export function canEval() {
  if (evalAllowed === null) {
    try { evalAllowed = new Function('return 1')() === 1; } catch { evalAllowed = false; }
  }
  return evalAllowed;
}

/** Compile a classic script at runtime (dynamic loading mode). Requires eval. */
export function compileUnit(code, url) {
  const { names } = scanTopLevelDeclarations(code);
  const body = unitFunctionBody(wrapClassicScript(code, names));
  // eslint-disable-next-line no-new-func
  return new Function(UNIT_PARAM, body + (url ? `\n//# sourceURL=${url}` : ''));
}
