// WebExtension match patterns and globs.
// https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns

const ALL_URLS_SCHEMES = ['http', 'https', 'file', 'ftp', 'ws', 'wss', 'data', 'urn'];
const cache = new Map();

function escapeRe(s) {
  return s.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/** Compile a match pattern to a predicate over URL strings. Invalid patterns never match. */
export function compileMatchPattern(pattern) {
  if (cache.has(pattern)) return cache.get(pattern);
  let fn;
  if (pattern === '<all_urls>') {
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
      const path = m[3] || '/*';
      let port = null;
      const pm = /^(.*?)(?::(\d+|\*))?$/.exec(host);
      if (pm && !host.startsWith('[')) { host = pm[1]; port = pm[2] || null; }
      const schemeOk = scheme === '*' ? (s) => s === 'http' || s === 'https' || s === 'ws' || s === 'wss' : (s) => s === scheme;
      let hostOk;
      if (host === '*' || (scheme === 'file' && host === '')) hostOk = () => true;
      else if (host.startsWith('*.')) {
        const base = host.slice(2);
        hostOk = (h) => h === base || h.endsWith('.' + base);
      } else hostOk = (h) => h === host;
      const pathRe = new RegExp('^' + path.split('*').map(escapeRe).join('.*') + '$');
      fn = (url) => {
        let u;
        try { u = new URL(url); } catch { return false; }
        const s = u.protocol.slice(0, -1);
        if (!schemeOk(s)) return false;
        if (s !== 'file' && !hostOk(u.hostname.toLowerCase().replace(/^\[|\]$/g, ''))) return false;
        if (port && port !== '*' && (u.port || defaultPort(s)) !== port) return false;
        return pathRe.test(u.pathname + u.search);
      };
    }
  }
  cache.set(pattern, fn);
  return fn;
}

function defaultPort(scheme) {
  return { http: '80', https: '443', ws: '80', wss: '443', ftp: '21' }[scheme] || '';
}

export function matchesPattern(pattern, url) {
  return compileMatchPattern(pattern)(url);
}

export function matchesAny(patterns, url) {
  return Array.isArray(patterns) && patterns.some((p) => matchesPattern(p, url));
}

/** include_globs / exclude_globs: "*" = any run of characters, "?" = one character. */
export function matchesGlob(glob, url) {
  const re = new RegExp('^' + glob.split('').map((c) => (c === '*' ? '.*' : c === '?' ? '.' : escapeRe(c))).join('') + '$');
  return re.test(url);
}

/** Does a manifest content_scripts entry apply to this URL? */
export function contentScriptMatches(entry, url) {
  if (!matchesAny(entry.matches, url)) return false;
  if (matchesAny(entry.exclude_matches || entry.excludeMatches, url)) return false;
  const inc = entry.include_globs || entry.includeGlobs;
  if (inc && inc.length && !inc.some((g) => matchesGlob(g, url))) return false;
  const exc = entry.exclude_globs || entry.excludeGlobs;
  if (exc && exc.some((g) => matchesGlob(g, url))) return false;
  return true;
}

/** Is `value` a host permission (match pattern) rather than an API permission? */
export function isHostPattern(value) {
  return value === '<all_urls>' || /^(\*|[a-z][a-z0-9+.-]*):\/\//i.test(value);
}
