// DOM helpers that keep working on pages with strict CSP / Trusted Types.

let policy;
let ttBlocked = false; // set once a Trusted Types sink refused a plain string
function ttPolicy() {
  if (policy !== undefined) return policy;
  policy = null;
  try {
    const tt = window.trustedTypes;
    if (tt && tt.createPolicy) {
      policy = tt.createPolicy('extshim', { createHTML: (s) => s, createScriptURL: (s) => s });
    }
  } catch { policy = null; }
  return policy;
}

export function trustedHTML(s) {
  const p = ttPolicy();
  return p ? p.createHTML(s) : s;
}
export function trustedScriptURL(s) {
  const p = ttPolicy();
  return p ? p.createScriptURL(s) : s;
}

/** Point an iframe at an empty standards-mode document and resolve with its window. */
export function freshDocument(iframe) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      iframe.removeEventListener('load', done);
      resolve(iframe.contentWindow);
    };
    iframe.addEventListener('load', done);
    try {
      if (ttBlocked && !ttPolicy()) throw new Error('tt');
      iframe.srcdoc = trustedHTML('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>');
    } catch {
      // Trusted Types refused srcdoc: use about:blank (quirks mode, but works).
      if (window.trustedTypes) ttBlocked = true;
      iframe.removeAttribute('srcdoc');
      iframe.src = 'about:blank';
    }
  });
}

const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const RAW = new Set(['script', 'style', 'textarea', 'title', 'noscript', 'template', 'xmp']);
const AUTO_CLOSE = {
  p: /^(address|article|aside|blockquote|div|dl|fieldset|footer|form|h[1-6]|header|hr|main|nav|ol|p|pre|section|table|ul)$/,
  li: /^li$/, dt: /^(dt|dd)$/, dd: /^(dt|dd)$/, option: /^(option|optgroup)$/, tr: /^tr$/, td: /^(td|th|tr)$/, th: /^(td|th|tr)$/,
};
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', copy: '©', reg: '®', hellip: '…', mdash: '—', ndash: '–', times: '×', middot: '·', laquo: '«', raquo: '»', bull: '•', rarr: '→', larr: '←', check: '✓' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isNaN(n) ? m : String.fromCodePoint(n); }
  return ENT[e.toLowerCase()] ?? m;
});

/**
 * Parse HTML without any Trusted Types sink (fallback when DOMParser is not allowed).
 * Builds the tree with createElement/setAttribute into `doc` (a fresh HTML document).
 */
export function parseHtmlManually(html, doc) {
  const root = doc.documentElement;
  const head = doc.head || root.appendChild(doc.createElement('head'));
  const body = doc.body || root.appendChild(doc.createElement('body'));
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
    if (cur() === body && !bodyStarted) { if (!t.trim()) return; bodyStarted = true; }
    cur().appendChild(doc.createTextNode(decode(t)));
  };
  while ((m = re.exec(html))) {
    text(html.slice(last, m.index));
    last = re.lastIndex;
    if (m[0].startsWith('<!')) continue;
    if (m[1]) {
      const name = m[1].toLowerCase();
      if (name === 'html' || name === 'head' || name === 'body') { if (name === 'head') stack.splice(1); continue; }
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].localName === name) { stack.length = i; break; }
      }
      continue;
    }
    const name = m[2].toLowerCase();
    const attrs = [];
    const are = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let a;
    while ((a = are.exec(m[3] || ''))) attrs.push([a[1], decode(a[2] ?? a[3] ?? a[4] ?? '')]);
    if (name === 'html' || name === 'body') { const t = name === 'html' ? root : body; for (const [k, v] of attrs) try { t.setAttribute(k, v); } catch { /* ignore */ } if (name === 'body') stack.splice(1); continue; }
    if (name === 'head') { stack.splice(1); stack.push(head); continue; }
    const p = cur();
    const ac = AUTO_CLOSE[p.localName];
    if (ac && ac.test(name)) stack.pop();
    const inHead = !bodyStarted && stack.length === 1 && /^(meta|link|title|style|script|base)$/.test(name);
    if (!inHead && cur() === body) bodyStarted = true;
    // <script> elements are Trusted Types sinks; keep script info on an inert placeholder.
    const el = doc.createElement(name === 'script' ? 'extshim-script' : name);
    for (const [k, v] of attrs) { try { el.setAttribute(k, v); } catch { /* invalid name */ } }
    (inHead ? head : cur()).appendChild(el);
    if (RAW.has(name)) {
      const end = html.toLowerCase().indexOf('</' + name, last);
      const content = html.slice(last, end < 0 ? html.length : end);
      if (name === 'script' || name === 'style') el.textContent = content;
      else if (name !== 'template') el.textContent = decode(content);
      last = end < 0 ? html.length : html.indexOf('>', end) + 1;
      re.lastIndex = last;
      continue;
    }
    if (!VOID.has(name) && !m[4]) stack.push(el);
    cur = () => stack[stack.length - 1];
  }
  text(html.slice(last));
}

/** Parse an HTML string into a detached document (DOMParser when allowed, manual parser otherwise). */
export function parseHtml(html, win) {
  try {
    if (ttBlocked && !ttPolicy()) throw new Error('tt');
    return { doc: new win.DOMParser().parseFromString(trustedHTML(html), 'text/html'), manual: false };
  } catch {
    if (window.trustedTypes) ttBlocked = true;
    const doc = win.document.implementation.createHTMLDocument('');
    parseHtmlManually(html, doc);
    return { doc, manual: true };
  }
}

/** Apply CSS text to a document or shadow root without tripping style-src CSP. */
export function adoptCss(root, win, cssList) {
  const sheets = [];
  if ('adoptedStyleSheets' in root) {
    for (const { css, media } of cssList) {
      try {
        const s = new win.CSSStyleSheet(media ? { media } : undefined);
        s.replaceSync(css.replace(/@import[^;]+;/g, ''));
        sheets.push(s);
      } catch { /* invalid css */ }
    }
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...sheets];
    return () => { root.adoptedStyleSheets = root.adoptedStyleSheets.filter((s) => !sheets.includes(s)); };
  }
  const doc = root.ownerDocument || root;
  const els = cssList.map(({ css, media }) => {
    const st = doc.createElement('style');
    if (media) st.media = media;
    st.textContent = css;
    (root.head || root).appendChild(st);
    return st;
  });
  return () => els.forEach((e) => e.remove());
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
