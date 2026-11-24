// Registry of optional API namespaces. Modules call defineNamespace() when imported; the
// full runtime imports every module, CLI bundles import only what an extension declares.

const defs = [];
/** Optional features provided by API modules (e.g. openDevTools), looked up by the core. */
export const features = {};
const startups = [];

/**
 * @param {string} name dotted namespace path, e.g. 'bookmarks' or 'system.cpu'
 * @param {(h: object) => object} build
 * @param {object} [o]
 * @param {string[]} [o.perms]    any of these permissions enables it
 * @param {string[]} [o.keys]     any of these manifest keys enables it
 * @param {'extension'|'content'|'all'|'devtools'} [o.contexts]
 * @param {(ext: any) => boolean} [o.when] extra condition
 * @param {boolean} [o.always] enable regardless of permissions and manifest keys
 */
export function defineNamespace(name, build, o = {}) {
  defs.push({ name, build, perms: o.perms || [], keys: o.keys || [], contexts: o.contexts || 'extension', when: o.when || null, always: !!o.always });
}

/**
 * Run fn(ext) when an extension starts: always when `cond` is empty, when it declares one of the
 * permissions in `cond` (array), or when `cond(ext)` returns true.
 * @param {(ext: any) => any} fn
 * @param {string[] | ((ext: any) => boolean)} [cond]
 */
export function defineStartup(fn, cond = []) {
  startups.push({ fn, cond });
}

export function namespaceDefs() { return defs; }
export function startupHooks() { return startups; }
