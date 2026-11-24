// Manifest helpers shared by the runtime and the CLI.
import { isHostPattern } from './match.js';
import { normalizePath } from './util.js';

export function manifestVersion(m) {
  return m.manifest_version === 3 ? 3 : 2;
}

/** Background description: {kind:'worker'|'scripts'|'page', files?, page?, module} or null. */
export function getBackground(m) {
  const bg = m.background;
  if (!bg) return null;
  const module = bg.type === 'module';
  if (bg.service_worker) return { kind: 'worker', files: [normalizePath(bg.service_worker)], module };
  if (Array.isArray(bg.scripts) && bg.scripts.length) return { kind: 'scripts', files: bg.scripts.map((s) => normalizePath(s)), module };
  if (bg.page) return { kind: 'page', page: normalizePath(bg.page), module: false };
  return null;
}

export function getContentScripts(m) {
  return (m.content_scripts || []).map((cs, index) => ({
    index,
    matches: cs.matches || [],
    exclude_matches: cs.exclude_matches || [],
    include_globs: cs.include_globs || [],
    exclude_globs: cs.exclude_globs || [],
    js: (cs.js || []).map((p) => normalizePath(p)),
    css: (cs.css || []).map((p) => normalizePath(p)),
    run_at: cs.run_at || 'document_idle',
    all_frames: !!cs.all_frames,
    world: (cs.world || 'ISOLATED').toUpperCase(),
  }));
}

/** The toolbar action ("action" in MV3, "browser_action"/"page_action" in MV2). */
export function getAction(m) {
  const kind = m.action ? 'action' : m.browser_action ? 'browser_action' : m.page_action ? 'page_action' : null;
  const a = (kind && m[kind]) || {};
  return {
    kind,
    popup: a.default_popup ? normalizePath(a.default_popup) : '',
    title: a.default_title || m.name || '',
    icon: a.default_icon || m.icons || null,
  };
}

export function getOptionsPage(m) {
  const p = (m.options_ui && m.options_ui.page) || m.options_page;
  return p ? { path: normalizePath(p), openInTab: m.options_page ? true : !!(m.options_ui && m.options_ui.open_in_tab) } : null;
}

export function getSidePanel(m) {
  if (m.side_panel && m.side_panel.default_path) return normalizePath(m.side_panel.default_path);
  if (m.sidebar_action && m.sidebar_action.default_panel) return normalizePath(m.sidebar_action.default_panel);
  return '';
}

/** Pick the best icon path for a target pixel size from an icon dictionary or string. */
export function pickIcon(icons, size = 32) {
  if (!icons) return '';
  if (typeof icons === 'string') return normalizePath(icons);
  const sizes = Object.keys(icons).map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);
  if (!sizes.length) return '';
  const best = sizes.find((s) => s >= size) || sizes[sizes.length - 1];
  return normalizePath(icons[best]);
}

export function getPermissions(m) {
  const perms = new Set();
  const origins = new Set();
  const add = (list) => (list || []).forEach((p) => (typeof p === 'string' ? (isHostPattern(p) ? origins.add(p) : perms.add(p)) : null));
  add(m.permissions);
  add(m.host_permissions);
  (m.content_scripts || []).forEach((cs) => (cs.matches || []).forEach((o) => origins.add(o)));
  const optional = new Set();
  const optionalOrigins = new Set();
  (m.optional_permissions || []).concat(m.optional_host_permissions || []).forEach((p) => (isHostPattern(p) ? optionalOrigins.add(p) : optional.add(p)));
  return { permissions: [...perms], origins: [...origins], optional: [...optional], optionalOrigins: [...optionalOrigins] };
}

/** All extension HTML pages that may be rendered (popup, options, side panel, background page, ...). */
export function getPages(m) {
  const pages = new Set();
  const a = getAction(m);
  if (a.popup) pages.add(a.popup);
  const o = getOptionsPage(m);
  if (o) pages.add(o.path);
  const sp = getSidePanel(m);
  if (sp) pages.add(sp);
  const bg = getBackground(m);
  if (bg && bg.page) pages.add(bg.page);
  if (m.devtools_page) pages.add(normalizePath(m.devtools_page));
  for (const k of ['newtab', 'history', 'bookmarks']) {
    if (m.chrome_url_overrides && m.chrome_url_overrides[k]) pages.add(normalizePath(m.chrome_url_overrides[k]));
  }
  return [...pages];
}

// ---------------------------------------------------------------- i18n

export function localeCandidates(preferred, defaultLocale) {
  const out = [];
  const add = (l) => { if (l && !out.includes(l)) out.push(l); };
  for (const p of preferred) {
    const l = String(p).replace('-', '_');
    add(l);
    add(l.split('_')[0]);
  }
  add(defaultLocale);
  return out;
}

/** Merge messages.json objects: earlier entries win. Keys are lowercased (Chrome is case-insensitive). */
export function mergeMessages(list) {
  const out = Object.create(null);
  for (const msgs of list) {
    if (!msgs) continue;
    for (const k of Object.keys(msgs)) {
      const lk = k.toLowerCase();
      if (!(lk in out)) out[lk] = msgs[k];
    }
  }
  return out;
}

export function formatMessage(messages, name, substitutions, predefined = {}) {
  if (name == null) return '';
  name = String(name);
  if (name.startsWith('@@')) return predefined[name] != null ? String(predefined[name]) : '';
  const entry = messages[name.toLowerCase()];
  if (!entry || typeof entry.message !== 'string') return '';
  let subs = substitutions == null ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
  subs = subs.slice(0, 9).map((s) => (s == null ? '' : String(s)));
  const placeholders = Object.create(null);
  for (const [k, v] of Object.entries(entry.placeholders || {})) placeholders[k.toLowerCase()] = v && v.content != null ? String(v.content) : '';
  const fill = (text) => text.replace(/\$(\d)/g, (_, d) => subs[d - 1] ?? '');
  let out = entry.message.replace(/\$([a-zA-Z0-9_@]+)\$/g, (m, p) => {
    const key = p.toLowerCase();
    return key in placeholders ? fill(placeholders[key]) : m;
  });
  out = out.replace(/\$\$|\$(\d)/g, (m, d) => (m === '$$' ? '$' : subs[d - 1] ?? ''));
  return out;
}

export function bidiInfo(locale) {
  const rtl = /^(ar|he|fa|ur|yi|dv|ps|sd|ug|ckb)(_|$)/.test(locale || '');
  return {
    '@@bidi_dir': rtl ? 'rtl' : 'ltr',
    '@@bidi_reversed_dir': rtl ? 'ltr' : 'rtl',
    '@@bidi_start_edge': rtl ? 'right' : 'left',
    '@@bidi_end_edge': rtl ? 'left' : 'right',
  };
}

/** Replace __MSG_name__ tokens in a string. */
export function replaceMsgTokens(text, getMessage) {
  return String(text).replace(/__MSG_([A-Za-z0-9_@]+?)__/g, (m, name) => {
    const v = getMessage(name);
    return v === '' && !name.startsWith('@@') ? m : v;
  });
}

/** Deep-localize every string in a manifest. */
export function localizeManifest(m, getMessage) {
  const walk = (v) => {
    if (typeof v === 'string') return v.includes('__MSG_') ? replaceMsgTokens(v, getMessage) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v)) o[k] = walk(v[k]);
      return o;
    }
    return v;
  };
  return walk(m);
}

// ---------------------------------------------------------------- commands

/** Parse "Ctrl+Shift+Y" into a matcher. Returns null for invalid/empty shortcuts. */
export function parseShortcut(str, isMac) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.split('+').map((s) => s.trim());
  const key = parts.pop();
  const mods = { ctrl: false, alt: false, shift: false, meta: false };
  for (const p of parts) {
    const l = p.toLowerCase();
    if (l === 'ctrl' || l === 'command') { if (isMac) mods.meta = true; else mods.ctrl = true; }
    else if (l === 'macctrl') mods.ctrl = true;
    else if (l === 'alt' || l === 'option') mods.alt = true;
    else if (l === 'shift') mods.shift = true;
    else if (l === 'search') mods.meta = true;
    else return null;
  }
  const named = {
    comma: 'Comma', period: 'Period', home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown', space: 'Space',
    insert: 'Insert', delete: 'Delete', up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
    mediaplaypause: 'MediaPlayPause', medianexttrack: 'MediaTrackNext', mediaprevtrack: 'MediaTrackPrevious', mediastop: 'MediaStop',
  };
  let code;
  const lk = key.toLowerCase();
  if (/^[a-z]$/.test(lk)) code = 'Key' + lk.toUpperCase();
  else if (/^[0-9]$/.test(lk)) code = 'Digit' + lk;
  else if (/^f([1-9]|1[0-2])$/.test(lk)) code = lk.toUpperCase();
  else if (named[lk]) code = named[lk];
  else return null;
  return { ...mods, code, text: str };
}

export function shortcutMatches(sc, e) {
  if (!sc) return false;
  if (!!e.ctrlKey !== sc.ctrl || !!e.altKey !== sc.alt || !!e.shiftKey !== sc.shift || !!e.metaKey !== sc.meta) return false;
  if (e.code === sc.code) return true;
  if (sc.code.startsWith('Digit') && e.code === 'Numpad' + sc.code.slice(5)) return true;
  return false;
}

/** Scan HTML text for <script src> references (used by the CLI to find module entries). */
export function htmlScriptRefs(html, pagePath) {
  const refs = [];
  const re = /<script\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    if (!src) continue;
    const url = src[1] ?? src[2] ?? src[3];
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')) continue;
    const type = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    refs.push({ path: normalizePath(url, pagePath), module: !!type && /module/i.test(type[1] ?? type[2] ?? type[3]) });
  }
  return refs;
}
