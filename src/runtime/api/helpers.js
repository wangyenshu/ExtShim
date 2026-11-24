// Helpers to build chrome.* functions that accept callbacks AND return promises.
import { nextTask } from '../events.js';

export function makeHelpers(ctx) {
  /** Wrap an async implementation as a chrome API function (callback or promise). */
  const fn = (impl) => function (...args) {
    let cb = null;
    if (args.length && typeof args[args.length - 1] === 'function') cb = args.pop();
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
    return undefined;
  };
  const event = (key) => ctx.event(key);
  const unsupported = (name) => fn(() => { throw new Error(`${name} is not supported by ExtShim (extensions running in a web page).`); });
  return { fn, event, unsupported, ctx, ext: ctx.ext };
}

const LIST_READS = /^(getAll|search|query|getTree|getRecent|getVisits|getDevices|getSubTree|getChildren|getDynamicRules|getSessionRules|getEnabledRulesets|getMatchedRules|getDisabledRuleIds|getRules|getAllInWindow|list)/;

/**
 * A namespace whose members are all unsupported. Members are callable *and* indexable, so
 * chrome.privacy.services.foo.set(...) or chrome.contentSettings.cookies.get(...) fail softly
 * instead of throwing TypeErrors at load time. List-style reads resolve with [].
 * `enums` ({ Name: { KEY: value } }) are returned as plain objects, so chrome.<ns>.<Enum>.<KEY> works.
 */
export function stubNamespace(h, ns, enums = {}) {
  let warned = false;
  const warn = () => { if (!warned) { warned = true; h.ext.log.warn(`chrome.${ns} is not supported by ExtShim; calls will fail and events will not fire.`); } };
  const make = (path) => {
    const cache = Object.create(null);
    const leaf = path.split('.').pop();
    const call = LIST_READS.test(leaf) ? h.fn(() => { warn(); return []; }) : h.unsupported(`chrome.${path}`);
    return new Proxy(function () {}, {
      apply: (_, __, args) => { warn(); return call(...args); },
      get(_, k) {
        if (typeof k !== 'string' || k === 'then' || k === 'toJSON') return undefined;
        if (k in cache) return cache[k];
        if (/^on[A-Z]/.test(k)) return (cache[k] = h.event(`${path}.${k}`));
        if (/^[A-Z_0-9]+$/.test(k)) return undefined;
        return (cache[k] = make(`${path}.${k}`));
      },
    });
  };
  const root = make(ns);
  return new Proxy({}, { get: (_, k) => (typeof k === 'string' && Object.hasOwn(enums, k) ? enums[k] : root[k]) });
}

/** Normalise color arguments to [r,g,b,a]. */
export function toRGBA(color) {
  if (Array.isArray(color)) return color.slice(0, 4).concat([255, 255, 255, 255].slice(color.length)).map((n) => n | 0);
  if (typeof color !== 'string') return [0, 0, 0, 255];
  const c = document.createElement('canvas').getContext('2d');
  c.fillStyle = '#000';
  c.fillStyle = color;
  const v = c.fillStyle;
  if (v.startsWith('#')) {
    const n = parseInt(v.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  const m = /rgba?\(([^)]+)\)/.exec(v);
  if (m) {
    const p = m[1].split(',').map((s) => parseFloat(s));
    return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? Math.round(p[3] * 255) : 255];
  }
  return [0, 0, 0, 255];
}

export function rgbaToCss(c) {
  return `rgba(${c[0]},${c[1]},${c[2]},${(c[3] ?? 255) / 255})`;
}
