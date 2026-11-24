// Code generation shared by the Node CLI and the in-browser builder.
//
// Every classic script of the extension becomes a "unit": a real function whose body is
// the original file, wrapped so that free identifiers resolve through an ExtShim scope
// object (giving each extension its own `chrome`, `window`, `location`, isolated globals...).
// Because units are real code (not strings), bundles run on pages whose CSP forbids eval.
//
//   function(__extshim$){with(__extshim$.scope)return function(){"use strict";
//   ;__extshim$.expose({"foo":[function(){return foo},function(v){foo=v}]});
//   ...original file...
//   }.call(this)}
//
// The inner function keeps the file's own declarations lexical (and strict if the file asks
// for it); expose() publishes top-level declarations so other files of the same world can
// see them, like real global scripts do.

import { bytesToBase64, isTextPath, utf8 } from './util.js';

export const UNIT_PARAM = '__extshim$';
const PREFIX = `function(${UNIT_PARAM}){with(${UNIT_PARAM}.scope)return function(){`;
const SUFFIX = '\n}.call(this)}';
const EXPOSE_MARK = `;${UNIT_PARAM}.expose(`;
const NO_EXPOSE = new Set(['chrome', 'browser', 'window', 'self', 'globalThis', 'document', 'location', 'top', 'parent', 'frames', 'arguments', 'eval', UNIT_PARAM]);
const DIRECTIVE_RE = /^((?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*(['"])use strict\2;?)/;

export function cleanSource(code) {
  code = String(code);
  if (code.charCodeAt(0) === 0xfeff) code = code.slice(1);
  if (code.startsWith('#!')) code = '//' + code.slice(2);
  // Source maps point at files that do not exist next to the bundle; drop them to avoid 404 noise.
  return code.replace(/\n\/\/# sourceMappingURL=[^\n]*\s*$/, '\n');
}

export function wrapClassicScript(code, names = []) {
  code = cleanSource(code);
  const exp = names.filter((n) => !NO_EXPOSE.has(n) && /^[A-Za-z_$][\w$]*$/.test(n));
  const defs = exp.map((n) => `${JSON.stringify(n)}:[function(){return ${n}},function(v){${n}=v}]`).join(',');
  const dm = DIRECTIVE_RE.exec(code);
  const directive = dm ? dm[1] : '';
  const rest = dm ? code.slice(directive.length) : code;
  return PREFIX + directive + EXPOSE_MARK + '{' + defs + '});\n' + rest + SUFFIX;
}

/** Recover the original file text from a unit's source (Function.prototype.toString). */
export function unwrapClassicScript(src) {
  if (!src.startsWith(PREFIX) || !src.endsWith(SUFFIX)) return null;
  const body = src.slice(PREFIX.length, -SUFFIX.length);
  const at = body.indexOf(EXPOSE_MARK);
  if (at < 0) return null;
  const nl = body.indexOf('\n', at);
  return body.slice(0, at) + body.slice(nl + 1);
}

/** Body text for `new Function(UNIT_PARAM, body)` (runtime compilation). */
export function unitFunctionBody(wrapped) {
  return wrapped.slice(`function(${UNIT_PARAM}){`.length, -1);
}

function encodeFile(path, data) {
  if (typeof data === 'string') return JSON.stringify(data);
  if (isTextPath(path)) {
    try {
      return JSON.stringify(new TextDecoder('utf-8', { fatal: true }).decode(data));
    } catch { /* binary after all */ }
  }
  return `{"b64":${JSON.stringify(bytesToBase64(data))}}`;
}

/**
 * Generate the `ExtShim.boot({...})` call that carries an extension.
 * @param {object} p
 * @param {string} p.id
 * @param {object} p.manifest parsed manifest (unlocalized)
 * @param {Map<string, Uint8Array|string>} p.files every extension file
 * @param {Map<string, string>} p.units unit key ("path.js" or "module:path.js") -> wrapped function source
 * @param {object} [p.options] default runtime options baked into the bundle
 * @param {string} [p.host] JS expression for host adapters (userscript)
 */
export function bundleBootSource({ id, manifest, files, units, options = {}, host = null }) {
  const fileParts = [];
  for (const [path, data] of files) {
    // Classic scripts are recovered from their unit at runtime (no duplication).
    if (units.has(path)) fileParts.push(`${JSON.stringify(path)}:0`);
    else fileParts.push(`${JSON.stringify(path)}:${encodeFile(path, data)}`);
  }
  const unitParts = [];
  for (const [key, src] of units) unitParts.push(`${JSON.stringify(key)}:${src}`);
  const opts = host ? `Object.assign(${JSON.stringify(options)},{host:${host}})` : JSON.stringify(options);
  return `ExtShim.boot({"format":1,"id":${JSON.stringify(id)},"manifest":${JSON.stringify(manifest)},\n"files":{${fileParts.join(',\n')}},\n"units":{${unitParts.join(',\n')}}},${opts});\n`;
}

/** Wrap a full bundle into a bookmarklet URL. */
export function toBookmarklet(code) {
  const body = `(function(){${code}\n})();void 0`;
  let out = '';
  for (const ch of body) {
    const c = ch.codePointAt(0);
    if (ch === '%') out += '%25';
    else if (c < 0x20 || c === 0x7f) out += '%' + c.toString(16).toUpperCase().padStart(2, '0');
    else if (c > 0x7e) out += encodeURIComponent(ch);
    else out += ch;
  }
  return 'javascript:' + out;
}

/** A tiny bookmarklet that loads a hosted bundle via <script src> (needs the page CSP to allow it). */
export function loaderBookmarklet(url) {
  const js = `(function(){var s=document.createElement('script');s.src=${JSON.stringify(url)}+'?t='+Date.now();(document.head||document.documentElement).appendChild(s);})();void 0`;
  return 'javascript:' + js.replace(/%/g, '%25');
}

/** Bookmarklet holding a deflate-compressed bundle; smaller but needs eval to be allowed. */
export function compressedBookmarklet(deflatedBytes) {
  const b64 = bytesToBase64(deflatedBytes);
  const js = `(async function(){try{var b=Uint8Array.from(atob('${b64}'),function(c){return c.charCodeAt(0)});var s=new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'));var t=await new Response(s).text();(0,eval)(t)}catch(e){alert('ExtShim: this page blocks eval (CSP). Use the full bookmarklet instead.\\n'+e)}})();void 0`;
  return 'javascript:' + js.replace(/%/g, '%25');
}

export function userscriptHeader(manifest, { grants = true, version } = {}) {
  const lines = ['// ==UserScript=='];
  const push = (k, v) => lines.push(`// @${k.padEnd(13)}${v}`);
  push('name', manifest.name || 'Extension');
  push('namespace', 'extshim');
  push('version', version || manifest.version || '1.0');
  if (manifest.description) push('description', String(manifest.description).replace(/\s+/g, ' '));
  const matches = new Set();
  const excludes = new Set();
  let allFrames = false;
  for (const cs of manifest.content_scripts || []) {
    for (const m of cs.matches || []) {
      if (m === '<all_urls>') { matches.add('*://*/*'); matches.add('file:///*'); } else matches.add(m);
    }
    for (const m of cs.exclude_matches || []) excludes.add(m);
    if (cs.all_frames) allFrames = true;
  }
  if (!matches.size) matches.add('*://*/*');
  for (const m of matches) push('match', m);
  for (const m of excludes) push('exclude-match', m);
  push('run-at', 'document-start');
  if (!allFrames) push('noframes', '');
  if (grants) {
    for (const g of ['GM_getValue', 'GM_setValue', 'GM_deleteValue', 'GM_listValues', 'GM_addValueChangeListener', 'GM_xmlhttpRequest', 'GM.xmlHttpRequest']) push('grant', g);
    push('connect', '*');
  } else push('grant', 'none');
  lines.push('// ==/UserScript==');
  return lines.map((l) => l.trimEnd()).join('\n') + '\n';
}

/** Host adapters for userscript managers: GM storage (shared across sites) and GM_xmlhttpRequest (cross-origin). */
export const USERSCRIPT_HOST = `(function(){
var G=typeof GM_getValue==='function';
var X=typeof GM_xmlhttpRequest==='function'?GM_xmlhttpRequest:(typeof GM!=='undefined'&&GM.xmlHttpRequest)||null;
return {
 storage:G?{
  name:'userscript',
  load:function(area){var v=GM_getValue('extshim:'+area,'{}');try{return Promise.resolve(typeof v==='string'?JSON.parse(v):v||{})}catch(e){return Promise.resolve({})}},
  save:function(area,all){GM_setValue('extshim:'+area,JSON.stringify(all));return Promise.resolve()},
  subscribe:typeof GM_addValueChangeListener==='function'?function(area,cb){GM_addValueChangeListener('extshim:'+area,function(k,o,n,remote){if(remote){try{cb(JSON.parse(n||'{}'))}catch(e){}}})}:null
 }:null,
 fetch:X?function(url,init){init=init||{};return new Promise(function(res,rej){X({url:url,method:init.method||'GET',headers:init.headers||{},data:init.body,responseType:'arraybuffer',
  onload:function(r){var h=new Headers();String(r.responseHeaders||'').trim().split(/\\r?\\n/).forEach(function(l){var i=l.indexOf(':');if(i>0)try{h.append(l.slice(0,i).trim(),l.slice(i+1).trim())}catch(e){}});
   res(new Response(r.status===204||r.status===304?null:r.response,{status:r.status||200,statusText:r.statusText||'',headers:h}))},
  onerror:function(){rej(new TypeError('Failed to fetch'))},ontimeout:function(){rej(new TypeError('Failed to fetch'))}})})}:null
};})()`;

export { utf8 };
