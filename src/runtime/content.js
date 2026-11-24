// Content scripts: matching, injection timing, isolated worlds, executeScript/insertCSS,
// and rewriting of extension URLs that content scripts put into the page DOM.
import { contentScriptMatches } from '../core/match.js';
import { getContentScripts } from '../core/manifest.js';
import { normalizePath } from '../core/util.js';
import { World, canEval } from './scope.js';
import { Context } from './context.js';
import { createFetch, createXHR } from './net.js';
import { adoptCss } from './dom.js';
import { renderPage } from './pages.js';

const RUN_ORDER = ['document_start', 'document_end', 'document_idle'];

function whenState(doc, state) {
  return new Promise((resolve) => {
    const ok = () => (state === 'document_start') || (state === 'document_end' ? doc.readyState !== 'loading' : doc.readyState === 'complete');
    if (ok()) return resolve();
    if (state === 'document_end') { doc.addEventListener('DOMContentLoaded', () => resolve(), { once: true }); return; }
    // document_idle: after DOMContentLoaded, at the latest shortly after it, or on load.
    const go = () => setTimeout(resolve, 0);
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', () => setTimeout(resolve, 200), { once: true });
      (doc.defaultView || window).addEventListener('load', go, { once: true });
    } else go();
  });
}

export class ContentManager {
  constructor(ext) {
    this.ext = ext;
    this.frames = new Map(); // Window -> {frameId, isolated, main, ctx}
    this.nextFrameId = 1;
    this.css = new Map(); // key -> remover
    this.observer = null;
    this.stopped = false;
  }

  async start() {
    const ext = this.ext;
    this.watchDom(document);
    const reg = (await ext.storage.internal().get('registeredScripts')).registeredScripts || [];
    const all = getContentScripts(ext.manifest).concat(reg.map(toEntry));
    const url = location.href;
    const matched = ext.options.contentScripts === 'all' ? all : all.filter((e) => contentScriptMatches(e, url));
    if (!matched.length) {
      if (all.length) ext.log.info(`No content script matches ${url}. (Use the contentScripts:"all" option to inject anyway.)`);
      return;
    }
    const top = this.frame(window);
    for (const e of matched) if (e.css.length) this.insertCss(top, { files: e.css, key: 'cs:' + e.index });
    for (const when of RUN_ORDER) {
      const group = matched.filter((e) => e.run_at === when);
      if (!group.length) continue;
      await whenState(document, when);
      if (this.stopped) return;
      for (const e of group) await this.injectEntry(top, e);
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
    const world = new World({ kind: 'content', target: win, log: ext.log, label: 'content script' });
    const ctx = new Context(ext, { type: 'content', url: win.location.href, tabId: ext.shim.tabId, frameId: f.frameId, win, world });
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
      exportFunction: (fn, target, o) => { if (o && o.defineAs && target) target[o.defineAs] = fn; return fn; },
    });
    if (ext.options.exposeBrowser) world.define({ browser: api });
    ctx.markReady();
    f.isolated = world;
    f.ctx = ctx;
    return world;
  }

  main(f) {
    if (!f.main) f.main = new World({ kind: 'main', target: f.win, log: this.ext.log, label: 'main world' });
    return f.main;
  }

  async injectEntry(f, e) {
    const world = e.world === 'MAIN' ? this.main(f) : this.isolated(f);
    for (const p of e.js) {
      if (this.stopped) return;
      try {
        world.run(await this.ext.unit(p), this.ext.virtualUrl(p));
      } catch (err) {
        this.ext.log.error(`Could not run content script ${p}:`, err);
      }
    }
  }

  insertCss(f, { files = [], css = '', key, origin } = {}) {
    const ext = this.ext;
    const doc = f.win.document;
    const run = async () => {
      const list = [];
      for (const p of files) list.push({ css: await ext.cssText(normalizePath(p)) });
      if (css) list.push({ css: ext.transformCss('', css) });
      const target = origin === 'USER' ? doc : doc;
      const rm = adoptCss(target, f.win, list);
      const k = key || JSON.stringify([f.frameId, files, css]);
      const prev = this.css.get(k);
      this.css.set(k, prev ? () => { prev(); rm(); } : rm);
    };
    return run();
  }

  removeCss(f, { files = [], css = '' } = {}) {
    const k = JSON.stringify([f.frameId, files, css]);
    const rm = this.css.get(k);
    if (rm) { rm(); this.css.delete(k); }
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
  async execute(callerCtx, { target, files, func, args = [], code, world: worldName = 'ISOLATED' }) {
    const out = [];
    for (const f of this.targetFrames(target)) {
      const w = worldName === 'MAIN' ? this.main(f) : this.isolated(f);
      let result;
      if (func) {
        // Re-evaluating the function source (like Chrome does) needs eval. Precompiled bundles
        // avoid even probing for it (a probe shows up in the page's CSP reports) unless asked to.
        const useEval = (this.ext.options.dynamic || this.ext.options.evalFunctions) && canEval();
        if (useEval) result = w.callSerialized(Function.prototype.toString.call(func), JSON.parse(JSON.stringify(args)));
        else {
          // Call it directly, resolving its free variables in the target world while it runs.
          const caller = callerCtx.world;
          if (caller) caller.redirect = w;
          try { result = func(...args); } finally { if (caller) caller.redirect = null; }
        }
      } else if (code != null) {
        if (!canEval()) throw new Error('executeScript({code}) needs eval, which this page\'s CSP blocks. Use files or func.');
        result = w.evaluate(String(code));
      } else if (files) {
        for (const p of files) {
          const path = normalizePath(p);
          w.run(await this.ext.unit(path), this.ext.virtualUrl(path));
        }
      }
      if (result && typeof result.then === 'function') result = await result;
      let clean;
      try { clean = result === undefined ? null : JSON.parse(JSON.stringify(result)); } catch { clean = null; }
      out.push({ frameId: f.frameId, result: clean, documentId: f.ctx ? f.ctx.documentId : undefined });
    }
    return out;
  }

  /** Inject all_frames scripts into same-origin child frames. */
  watchFrames(entries) {
    const inject = (iframe) => {
      const tryIt = () => {
        let win;
        try { win = iframe.contentWindow; if (!win || !win.document) return; void win.location.href; } catch { return; }
        if (this.frames.has(win)) return;
        const f = this.frame(win);
        const url = win.location.href;
        for (const e of entries) {
          if (this.ext.options.contentScripts !== 'all' && url !== 'about:blank' && !contentScriptMatches(e, url)) continue;
          if (e.css.length) this.insertCss(f, { files: e.css });
          this.injectEntry(f, e);
        }
      };
      iframe.addEventListener('load', () => { const w = iframe.contentWindow; if (w) this.frames.delete(w); tryIt(); });
      if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') tryIt();
    };
    document.querySelectorAll('iframe, frame').forEach((f) => { if (!f.hasAttribute('data-extshim')) inject(f); });
    this.frameObserver = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if ((n.localName === 'iframe' || n.localName === 'frame') && !n.hasAttribute('data-extshim')) inject(n);
        else if (n.querySelectorAll) n.querySelectorAll('iframe, frame').forEach(inject);
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
    const fix = (el) => {
      if (el.nodeType !== 1 || el.hasAttribute('data-extshim')) return;
      const tag = el.localName;
      if (tag === 'iframe' || tag === 'frame') {
        const src = el.getAttribute('src');
        const p = src ? ext.resolvePath(src) : null;
        if (p != null && /\.html?$/i.test(p) && el.getAttribute('data-extshim-page') !== src) {
          el.setAttribute('data-extshim-page', src);
          el.removeAttribute('src');
          const q = /\?[^#]*/.exec(src);
          const h = /#.*/.exec(src);
          renderPage(ext, { type: 'frame', iframe: el, path: p, search: q ? q[0] : '', hash: h ? h[0] : '', tabId: ext.shim.tabId })
            .catch((e) => ext.log.error(e));
        }
        return;
      }
      for (const attr of ['src', 'href', 'poster', 'data']) {
        const v = el.getAttribute(attr);
        if (v && v.startsWith(base)) {
          const p = ext.resolvePath(v);
          if (p != null && ext.vfs.has(p)) el.setAttribute(attr, ext.resourceUrl(p) + ((/#.*/.exec(v) || [''])[0]));
        }
      }
      const st = el.getAttribute('style');
      if (st && st.includes(base)) el.style.cssText = ext.transformCss('', st.split(base).join(''));
    };
    const scan = (root) => {
      if (root.nodeType !== 1) return;
      fix(root);
      if (root.querySelectorAll) for (const el of root.querySelectorAll('iframe,frame,img,source,video,audio,link,image,use,embed,object,[style]')) fix(el);
    };
    this.observer = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'attributes') fix(m.target);
        else for (const n of m.addedNodes) scan(n);
      }
    });
    const start = () => this.observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'href', 'style', 'poster', 'data'] });
    if (doc.documentElement) start();
  }
}

function toEntry(s) {
  return {
    index: 'reg:' + s.id,
    matches: s.matches || [], exclude_matches: s.excludeMatches || [], include_globs: [], exclude_globs: [],
    js: (s.js || []).map((p) => normalizePath(p)), css: (s.css || []).map((p) => normalizePath(p)),
    run_at: s.runAt || 'document_idle', all_frames: !!s.allFrames, world: (s.world || 'ISOLATED').toUpperCase(),
  };
}
