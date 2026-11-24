// In-page browser chrome for extensions: launcher dock (toolbar buttons + badges),
// popup / tab / side-panel / window panels, extension context menus, notifications.
// Lives in a closed shadow root; styled with constructable stylesheets (CSP-safe).
import { adoptCss } from './dom.js';
import { rgbaToCss } from './api/helpers.js';
import { pickIcon } from '../core/manifest.js';

const CSS = `
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

const COLORS = ['#1a73e8', '#d93025', '#188038', '#e37400', '#9334e6', '#007b83', '#c5221f', '#3c4043'];

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids) if (k != null) e.append(k);
  return e;
}

/** Draw an extension icon into `holder` without needing img-src CSP (canvas + ImageBitmap). */
async function renderIcon(ext, holder, icon, size = 24) {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const px = Math.round(size * dpr);
  const put = (node) => { holder.textContent = ''; holder.append(node); };
  const letter = () => {
    const n = (ext.name || '?').trim();
    let hsh = 0;
    for (const c of ext.id) hsh = (hsh * 31 + c.charCodeAt(0)) | 0;
    const d = el('div', { class: 'letter', text: (n[0] || '?').toUpperCase() });
    d.style.background = COLORS[Math.abs(hsh) % COLORS.length];
    put(d);
  };
  try {
    if (icon && icon.imageData) {
      const id = icon.imageData;
      const src = document.createElement('canvas');
      src.width = id.width; src.height = id.height;
      src.getContext('2d').putImageData(id, 0, 0);
      const c = document.createElement('canvas');
      c.width = c.height = px;
      c.getContext('2d').drawImage(src, 0, 0, px, px);
      put(c);
      return;
    }
    const path = icon && icon.path ? pickIcon(icon.path, px) : ext.iconPath(px);
    if (!path) return letter();
    const blob = await ext.vfs.blob(path);
    if (!blob) return letter();
    if (/svg/.test(blob.type) || typeof createImageBitmap !== 'function') {
      const img = el('img', { alt: '' });
      img.onerror = letter;
      img.src = ext.resourceUrl(path);
      put(img);
      return;
    }
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d');
    const s = Math.min(px / bmp.width, px / bmp.height);
    g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, (px - bmp.width * s) / 2, (px - bmp.height * s) / 2, bmp.width * s, bmp.height * s);
    put(c);
  } catch {
    letter();
  }
}

function readableOn(rgba) {
  const [r, g, b] = rgba || [0, 0, 0];
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000' : '#fff';
}

export class UI {
  constructor(shim) {
    this.shim = shim;
    this.providers = new Map();
    this.panels = new Set();
    this.lastContextTarget = null;
    this.host = null;
  }

  ensure() {
    if (this.host && this.host.isConnected) return;
    if (!this.host) {
      this.host = document.createElement('extshim-root');
      this.host.setAttribute('data-extshim', '');
      this.shadow = this.host.attachShadow({ mode: 'closed' });
      adoptCss(this.shadow, window, [{ css: CSS }]);
      this.root = el('div', { class: 'root' });
      this.dock = el('div', { class: 'dock', role: 'toolbar', 'aria-label': 'Extensions' });
      this.layer = el('div');
      this.toastBox = el('div', { class: 'toasts', 'aria-live': 'polite' });
      this.hiddenBox = el('div', { class: 'hidden', 'aria-hidden': 'true' });
      this.root.append(this.hiddenBox, this.layer, this.dock, this.toastBox);
      this.shadow.append(this.root);
      this._placeDock();
      this._wire();
    }
    (document.documentElement || document).appendChild(this.host);
    // Keep the UI attached if the page replaces the DOM wholesale.
    if (!this._keeper && document.documentElement) {
      this._keeper = new MutationObserver(() => {
        if (!this.host.isConnected && document.documentElement) document.documentElement.appendChild(this.host);
      });
      this._keeper.observe(document.documentElement, { childList: true });
    }
  }

  _placeDock() {
    let pos = null;
    try { pos = JSON.parse(localStorage.getItem('extshim:dock') || 'null'); } catch { /* ignore */ }
    const s = this.dock.style;
    s.right = ''; s.left = ''; s.top = ''; s.bottom = '';
    if (pos && typeof pos.x === 'number') {
      s.left = Math.max(4, Math.min(innerWidth - 50, pos.x)) + 'px';
      s.top = Math.max(4, Math.min(innerHeight - 50, pos.y)) + 'px';
    } else {
      const p = this.shim.defaultPosition || 'bottom-right';
      if (p.includes('top')) s.top = '16px'; else s.bottom = '16px';
      if (p.includes('left')) s.left = '16px'; else s.right = '16px';
    }
  }

  _wire() {
    // Dragging the dock.
    let drag = null;
    this.dock.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const r = this.dock.getBoundingClientRect();
      drag = { x: e.clientX, y: e.clientY, ox: r.left, oy: r.top, moved: false, id: e.pointerId };
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      if (!drag.moved) { drag.moved = true; try { this.dock.setPointerCapture(drag.id); } catch { /* ignore */ } }
      const s = this.dock.style;
      s.right = ''; s.bottom = '';
      s.left = Math.max(0, Math.min(innerWidth - 44, drag.ox + dx)) + 'px';
      s.top = Math.max(0, Math.min(innerHeight - 44, drag.oy + dy)) + 'px';
    }, true);
    window.addEventListener('pointerup', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (drag.moved) {
        this._suppressClick = true;
        setTimeout(() => { this._suppressClick = false; }, 0);
        const r = this.dock.getBoundingClientRect();
        try { localStorage.setItem('extshim:dock', JSON.stringify({ x: r.left, y: r.top })); } catch { /* ignore */ }
      }
      drag = null;
    }, true);
    // Close transient UI on outside clicks / Escape.
    document.addEventListener('pointerdown', (e) => {
      if (e.composedPath().includes(this.host)) return;
      this.closeMenu();
      for (const p of [...this.panels]) if (p.kind === 'popup') p.close();
    }, true);
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.menu) { this.closeMenu(); return; }
      for (const p of [...this.panels]) if (p.kind === 'popup') p.close();
    }, true);
    window.addEventListener('blur', () => this.closeMenu());
    // Extension context menus: Alt + right click (configurable).
    window.addEventListener('contextmenu', (e) => {
      if (e.composedPath().includes(this.host)) { e.preventDefault(); return; }
      const mod = this.shim.contextMenuModifier || 'altKey';
      if (mod === 'none' || !this.providers.size) return;
      if (mod !== 'always' && !e[mod]) return;
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
    const sel = String(window.getSelection ? window.getSelection() : '').trim();
    const contexts = [];
    const info = { pageUrl: location.href, frameUrl: location.href, contexts, editable: false };
    if (sel) { contexts.push('selection'); info.selectionText = sel; }
    const a = t && t.closest('a[href]');
    if (a) { contexts.push('link'); info.linkUrl = a.href; info.linkText = a.textContent.trim(); }
    const media = t && t.closest('img,video,audio');
    if (media) {
      const type = media.localName === 'img' ? 'image' : media.localName;
      contexts.push(type);
      info.mediaType = type;
      info.srcUrl = media.currentSrc || media.src;
    }
    if (t && (t.isContentEditable || /^(input|textarea)$/i.test(t.localName))) { contexts.push('editable'); info.editable = true; }
    if (window !== window.top) contexts.push('frame');
    if (!contexts.length || (contexts.length === 1 && contexts[0] === 'frame')) contexts.push('page');
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
    const iconBox = el('span');
    const badge = el('span', { class: 'badge' });
    const btn = el('button', { class: 'btn', type: 'button', title: ext.name, 'aria-label': ext.name }, iconBox, badge);
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
        btn.setAttribute('aria-label', btn.title);
        badge.textContent = (s.badgeText || '').slice(0, 4);
        badge.style.background = rgbaToCss(s.badgeBg || [217, 48, 37, 255]);
        badge.style.color = s.badgeFg ? rgbaToCss(s.badgeFg) : readableOn(s.badgeBg);
        btn.classList.toggle('disabled', s.enabled === false);
        const key = s.icon && s.icon.imageData ? s.icon.imageData : JSON.stringify(s.icon || null);
        if (key !== lastIcon) { lastIcon = key; renderIcon(ext, iconBox, s.icon); }
      },
      setActive: (on) => btn.classList.toggle('active', !!on),
      setVisible: (on) => { btn.hidden = !on; this.dock.hidden = ![...this.dock.children].some((b) => !b.hidden); },
      remove: () => { btn.remove(); this.dock.hidden = ![...this.dock.children].some((b) => !b.hidden); this.providers.delete(ext); },
    };
    renderIcon(ext, iconBox, null);
    btn.addEventListener('click', () => { if (!this._suppressClick) ext.clickAction(); });
    btn.addEventListener('contextmenu', (e) => {
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
      const g = p({ pageUrl: location.href, contexts: ext.mv === 3 ? ['action'] : ['browser_action', 'page_action'], editable: false });
      if (g.items.length) items.push(...g.items, { type: 'separator' });
    }
    const opt = ext.localized.options_ui || ext.localized.options_page;
    if (opt) items.push({ label: 'Options', onClick: () => ext.openOptions().catch((e) => ext.log.error(e)) });
    if (ext.manifest.devtools_page) items.push({ label: 'DevTools panels', onClick: () => ext.openDevTools() });
    if (ext.state.commands && ext.state.commands.list.some((c) => c.sc)) items.push({ label: 'Keyboard shortcuts', onClick: () => this.shortcuts(ext) });
    if ((ext.manifest.permissions || []).includes('bookmarks') && ext.features && ext.features.importBookmarks) items.push({ label: 'Import bookmarks…', onClick: () => this._importBookmarks(ext) });
    if (ext.manifest.omnibox) items.push({ label: `Omnibox: ${ext.manifest.omnibox.keyword}`, onClick: () => ext.openOmnibox() });
    if (ext.localized.side_panel || ext.localized.sidebar_action) items.push({ label: 'Open side panel', onClick: () => ext.openSidePanel().catch((e) => ext.log.error(e)) });
    items.push(
      { label: 'Reload extension', onClick: () => ext.reload() },
      { label: 'Export storage…', onClick: () => this._export(ext) },
      { label: 'Import storage…', onClick: () => this._import(ext) },
      { type: 'separator' },
      { label: 'Hide launcher', sub: 'run again to show', onClick: () => ext.launcher.setVisible(false) },
      { label: 'Remove from this page', onClick: () => ext.stop() },
    );
    return { title: `${ext.name}${ext.manifest.version ? ' ' + ext.manifest.version : ''}`, icon: ext.iconPath(16), ext, items };
  }

  /** Read-only list of the extension's keyboard shortcuts (also commands.openShortcutSettings). */
  shortcuts(ext) {
    const list = (ext.state.commands && ext.state.commands.list) || [];
    const items = list.map((c) => ({ label: `${c.description || c.name.replace(/^_execute_\w+$/, 'Activate the extension')}`, sub: c.text || 'not set', onClick: () => ext.state.commands.trigger(c.name) }));
    const r = ext.launcher ? ext.launcher.rect() : { left: innerWidth / 2, top: innerHeight / 3 };
    this.showMenu([{ title: `${ext.name} — keyboard shortcuts`, ext, items: items.length ? items : [{ label: 'No shortcuts', enabled: false }] }], r.left, r.top, { anchor: r });
  }

  _importBookmarks(ext) {
    const input = el('input', { type: 'file', accept: '.html,.htm,text/html' });
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      input.remove();
      if (f) { try { ext.features.importBookmarks(ext, await f.text()); ext.log.info('Bookmarks imported.'); } catch (e) { ext.log.error('Bookmark import failed:', e); } }
    });
    this.root.append(input);
    input.click();
  }

  async _export(ext) {
    const data = await ext.storage.exportAll();
    const a = el('a', { download: `${(ext.name || 'extension').replace(/[^\w.-]+/g, '_')}-storage.json` });
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    this.root.append(a);
    a.click();
    a.remove();
  }

  _import(ext) {
    const input = el('input', { type: 'file', accept: 'application/json,.json' });
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      input.remove();
      if (!f) return;
      try { await ext.storage.importAll(JSON.parse(await f.text())); ext.log.info('Storage imported.'); } catch (e) { ext.log.error('Import failed:', e); }
    });
    this.root.append(input);
    input.click();
  }

  hiddenFrame(ext, kind) {
    this.ensure();
    const f = el('iframe', { 'data-extshim': kind, title: `${ext.name} (${kind})`, tabindex: '-1' });
    this.hiddenBox.append(f);
    return f;
  }

  // ---------------------------------------------------------------- panels

  openPanel(ext, kind, { title = '', anchor = null, width, height, onClose } = {}) {
    this.ensure();
    const iframe = el('iframe', { 'data-extshim': kind, title: title || ext.name, allow: 'clipboard-read; clipboard-write; microphone; camera; geolocation; fullscreen' });
    const box = el('div', { class: `panel ${kind === 'popup' ? 'popup' : kind}`, role: kind === 'popup' ? 'dialog' : 'region', 'aria-label': title || ext.name });
    let backdrop = null;
    let closed = false;
    const titleEl = el('span', { class: 't', text: title || ext.name });
    const panel = {
      kind, iframe, el: box,
      close: () => {
        if (closed) return;
        closed = true;
        box.remove();
        if (backdrop) backdrop.remove();
        this.panels.delete(panel);
        if (kind === 'popup' && ext.launcher) ext.launcher.setActive(false);
        if (kind === 'side') this._sideInset(0);
        if (onClose) { try { onClose(); } catch (e) { ext.log.error(e); } }
      },
      setTitle: (t) => { titleEl.textContent = t || ext.name; iframe.title = t || ext.name; },
      resize: (w, h) => {
        if (kind !== 'popup') return;
        box.style.width = w + 2 + 'px';
        box.style.height = h + 2 + 'px';
        box.classList.add('ready');
        this._anchorPopup(box, anchor, w + 2, h + 2);
      },
      focus: () => { this.layer.append(box); try { iframe.contentWindow.focus(); } catch { /* ignore */ } },
    };
    if (kind === 'popup') {
      for (const p of [...this.panels]) if (p.kind === 'popup') p.close();
      box.style.width = '802px';
      box.style.height = '27px';
      box.append(iframe);
      this._anchorPopup(box, anchor, 802, 27);
      if (ext.launcher) ext.launcher.setActive(true);
    } else {
      const icon = el('span');
      renderIcon(ext, icon, null, 16);
      const bar = el('div', { class: 'bar' }, icon, titleEl, el('button', { class: 'x', type: 'button', title: 'Close', 'aria-label': 'Close', text: '×', onclick: () => panel.close() }));
      box.append(bar, iframe);
      if (kind === 'tab' || kind === 'dialog') {
        backdrop = el('div', { class: 'backdrop' });
        backdrop.addEventListener('click', () => panel.close());
        this.layer.append(backdrop);
      }
      if (kind === 'side') {
        for (const p of [...this.panels]) if (p.kind === 'side') p.close();
        const grip = el('div', { class: 'grip' });
        this._sideInset(380);
        grip.addEventListener('pointerdown', (e) => {
          grip.setPointerCapture(e.pointerId);
          const move = (ev) => { const w = Math.max(240, Math.min(innerWidth - 40, innerWidth - ev.clientX)); box.style.width = w + 'px'; this._sideInset(w); };
          const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); };
          grip.addEventListener('pointermove', move);
          grip.addEventListener('pointerup', up);
        });
        box.append(grip);
      }
      if (kind === 'window') {
        box.style.width = (width || 600) + 'px';
        box.style.height = (height || 480) + 38 + 'px';
        box.style.left = Math.max(10, (innerWidth - (width || 600)) / 2) + 'px';
        box.style.top = Math.max(10, (innerHeight - (height || 480)) / 3) + 'px';
        let d = null;
        bar.addEventListener('pointerdown', (e) => { if (e.target.closest('.x')) return; bar.setPointerCapture(e.pointerId); const r = box.getBoundingClientRect(); d = { x: e.clientX - r.left, y: e.clientY - r.top }; iframe.style.pointerEvents = 'none'; });
        bar.addEventListener('pointermove', (e) => { if (!d) return; box.style.left = e.clientX - d.x + 'px'; box.style.top = Math.max(0, e.clientY - d.y) + 'px'; });
        bar.addEventListener('pointerup', () => { d = null; iframe.style.pointerEvents = ''; });
      }
    }
    this.layer.append(box);
    this.panels.add(panel);
    return panel;
  }

  /** Keep toasts and a right-docked launcher clear of an open side panel. */
  _sideInset(px) {
    this.toastBox.style.right = 12 + px + 'px';
    const d = this.dock.style;
    if (px && d.left === '') { this._dockShift = true; d.right = 16 + px + 'px'; }
    else if (!px && this._dockShift) { this._dockShift = false; d.right = '16px'; }
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
    box.style.left = Math.max(8, Math.min(innerWidth - w - 8, left)) + 'px';
    box.style.top = Math.max(8, Math.min(innerHeight - h - 8, top)) + 'px';
  }

  // ---------------------------------------------------------------- menus

  closeMenu() {
    if (this.menu) { this.menu.forEach((m) => m.remove()); this.menu = null; }
  }

  showMenu(groups, x, y, { anchor = null } = {}) {
    this.closeMenu();
    this.menu = [];
    const build = (items, level) => {
      const m = el('div', { class: 'menu', role: 'menu' });
      for (const it of items) {
        if (it.type === 'separator') { m.append(el('div', { class: 'sep' })); continue; }
        if (it.header) {
          const ic = el('span');
          if (it.ext) renderIcon(it.ext, ic, null, 14);
          m.append(el('div', { class: 'mi head' }, ic, el('span', { class: 'l', text: it.label })));
          continue;
        }
        const check = it.type === 'checkbox' || it.type === 'radio' ? (it.checked ? (it.type === 'radio' ? '●' : '✓') : '') : '';
        const row = el('div', { class: 'mi' + (it.enabled === false ? ' dis' : ''), role: 'menuitem', tabindex: '-1' },
          el('span', { class: 'c', text: check }), el('span', { class: 'l', text: it.label }),
          it.children && it.children.length ? el('span', { class: 's', text: '›' }) : it.sub ? el('span', { class: 's', text: it.sub }) : null);
        if (it.enabled !== false) {
          if (it.children && it.children.length) {
            row.addEventListener('mouseenter', () => {
              this.menu.slice(level + 1).forEach((n) => n.remove());
              this.menu.length = level + 1;
              const r = row.getBoundingClientRect();
              const sub = build(it.children, level + 1);
              this._placeMenu(sub, r.right - 4, r.top - 5, r);
            });
          } else {
            row.addEventListener('mouseenter', () => { this.menu.slice(level + 1).forEach((n) => n.remove()); this.menu.length = level + 1; });
            row.addEventListener('click', () => { this.closeMenu(); try { it.onClick(); } catch (e) { console.error(e); } });
          }
        }
        m.append(row);
      }
      this.root.append(m);
      this.menu.push(m);
      return m;
    };
    const flat = [];
    groups.forEach((g, i) => {
      if (i) flat.push({ type: 'separator' });
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
    m.style.left = Math.max(4, left) + 'px';
    m.style.top = Math.max(4, top) + 'px';
  }

  // ---------------------------------------------------------------- theme (Firefox theme API)

  setTheme(colors) {
    this.ensure();
    const c = (v) => (Array.isArray(v) ? `rgb(${v.slice(0, 3).join(',')}${v.length > 3 ? ',' + v[3] : ''})` : v);
    const s = this.root.style;
    const pick = (...keys) => { for (const k of keys) if (colors && colors[k] != null) return c(colors[k]); return ''; };
    s.setProperty('--bg', pick('popup', 'toolbar', 'frame', 'accentcolor'));
    s.setProperty('--fg', pick('popup_text', 'toolbar_text', 'tab_background_text', 'textcolor', 'bookmark_text'));
    s.setProperty('--acc', pick('icons_attention', 'tab_line', 'popup_highlight', 'toolbar_field_highlight'));
    s.setProperty('--bd', pick('popup_border', 'toolbar_bottom_separator', 'toolbar_top_separator'));
    s.setProperty('--hl', pick('toolbar_field_focus', 'button_background_hover', 'popup_highlight'));
    for (const k of ['--bg', '--fg', '--acc', '--bd', '--hl']) if (!s.getPropertyValue(k)) s.removeProperty(k);
  }

  // ---------------------------------------------------------------- banner (debugger attached)

  banner(ext, text, onCancel) {
    this.ensure();
    const b = el('div', { class: 'banner', role: 'status' }, el('span', { text }), el('button', { type: 'button', text: 'Cancel', onclick: () => { b.remove(); onCancel && onCancel(); } }));
    this.root.append(b);
    return { remove: () => b.remove() };
  }

  // ---------------------------------------------------------------- DevTools drawer

  drawer(ext, { title, onPick, onClose }) {
    this.ensure();
    const tabsEl = el('div', { class: 'tabs', role: 'tablist' });
    const body = el('div', { class: 'body' });
    const empty = el('div', { class: 'empty', text: 'This extension has not created any DevTools panels yet.' });
    body.append(empty);
    const tabs = [];
    let current = null;
    let picking = false;
    let hl = null;
    const stopPick = () => {
      picking = false;
      pickBtn.classList.remove('on');
      if (hl) { hl.remove(); hl = null; }
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
    };
    const onMove = (e) => {
      if (e.composedPath().includes(this.host)) return;
      const r = e.target.getBoundingClientRect();
      Object.assign(hl.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    };
    const onClick = (e) => {
      if (e.composedPath().includes(this.host)) return;
      e.preventDefault();
      e.stopPropagation();
      stopPick();
      onPick && onPick(e.target);
    };
    const pickBtn = el('button', { class: 'tool', type: 'button', text: 'Select element', title: 'Pick an element on the page ($0)', onclick: () => {
      if (picking) return stopPick();
      picking = true;
      pickBtn.classList.add('on');
      hl = el('div', { class: 'pick' });
      this.root.append(hl);
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('click', onClick, true);
    } });
    const icon = el('span');
    renderIcon(ext, icon, null, 16);
    const box = el('div', { class: 'panel drawer', role: 'region', 'aria-label': title },
      el('div', { class: 'vgrip' }), el('div', { class: 'bar' }, icon, tabsEl, pickBtn, el('button', { class: 'x', type: 'button', title: 'Close', 'aria-label': 'Close', text: '\u00d7', onclick: () => api.close() })), body);
    const grip = box.firstChild;
    grip.addEventListener('pointerdown', (e) => {
      grip.setPointerCapture(e.pointerId);
      const move = (ev) => { box.style.height = Math.max(120, Math.min(innerHeight - 40, innerHeight - ev.clientY)) + 'px'; };
      const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
    const api = {
      addTab: (label, hooks) => {
        const t = { label, hooks, btn: null, view: null };
        t.btn = el('button', { type: 'button', role: 'tab', text: label, onclick: () => api.select(t) });
        tabsEl.append(t.btn);
        tabs.push(t);
        empty.remove();
        if (!current) api.select(t);
        return t;
      },
      select: (t) => {
        if (current === t) return;
        if (current) { current.btn.classList.remove('on'); if (current.view) current.view.style.display = 'none'; current.hooks.hide && current.hooks.hide(); }
        current = t;
        t.btn.classList.add('on');
        if (!t.view) {
          t.view = el('iframe', { 'data-extshim': 'devtools-panel', title: t.label });
          body.append(t.view);
        }
        t.view.style.display = '';
        t.hooks.show && t.hooks.show(t.view);
      },
      showJson: (t, text, select) => {
        if (!t.pre) { t.pre = el('pre'); }
        t.pre.textContent = text;
        if (t.view && t.view.localName === 'iframe' && !t.view.contentDocument.body.childNodes.length) { t.view.replaceWith(t.pre); t.view = t.pre; }
        if (select) api.select(t);
      },
      close: () => {
        stopPick();
        box.remove();
        this.panels.delete(api);
        if (onClose) onClose();
      },
      kind: 'drawer',
    };
    this.layer.append(box);
    this.panels.add(api);
    return api;
  }

  // ---------------------------------------------------------------- omnibox palette

  palette(ext, { keyword, defaultSuggestion, onInput, onEnter, onCancel }) {
    this.ensure();
    const input = el('input', { type: 'text', 'aria-label': 'Omnibox', autocomplete: 'off', spellcheck: 'false' });
    const list = el('div', { class: 'sg', role: 'listbox' });
    const box = el('div', { class: 'pal', role: 'dialog', 'aria-label': ext.name }, el('div', { class: 'in' }, el('span', { class: 'kw', text: keyword || ext.name }), input), list);
    let items = [];
    let sel = -1;
    let done = false;
    const styled = (desc) => {
      // Omnibox descriptions use a tiny XML dialect: <match>, <dim>, <url>.
      const out = el('span');
      const re = /<(match|dim|url)>([\s\S]*?)<\/\1>|([^<]+)|<[^>]*>/g;
      let m;
      const unesc = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
      while ((m = re.exec(String(desc || '')))) {
        if (m[1]) out.append(el('span', { class: m[1][0], text: unesc(m[2].replace(/<[^>]*>/g, '')) }));
        else if (m[3]) out.append(unesc(m[3]));
      }
      return out;
    };
    const render = () => {
      list.textContent = '';
      const def = defaultSuggestion();
      const rows = [...(def ? [{ content: null, description: def.replace(/%s/g, input.value) }] : []), ...items];
      rows.forEach((r, i) => {
        const row = el('div', { class: 'it' + (i === sel ? ' on' : ''), role: 'option' }, styled(r.description || r.content));
        row.addEventListener('pointerdown', (e) => { e.preventDefault(); finish(r.content ?? input.value, 'currentTab'); });
        list.append(row);
      });
      return rows;
    };
    const close = () => { done = true; box.remove(); };
    const finish = (text, disposition) => { if (done) return; close(); onEnter(text, disposition); };
    input.addEventListener('input', () => { sel = -1; items = []; render(); onInput(input.value, (r) => { items = r; render(); }); });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const rows = render();
      if (e.key === 'ArrowDown') { sel = Math.min(rows.length - 1, sel + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(-1, sel - 1); render(); e.preventDefault(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const r = rows[sel];
        finish(r && r.content != null ? r.content : input.value, e.altKey || e.metaKey ? 'newForegroundTab' : 'currentTab');
      } else if (e.key === 'Escape') { e.preventDefault(); close(); onCancel(); }
    });
    input.addEventListener('blur', () => setTimeout(() => { if (!done && !box.matches(':focus-within')) { close(); onCancel(); } }, 150));
    this.root.append(box);
    render();
    setTimeout(() => input.focus(), 0);
    return { focus: () => input.focus(), close, input };
  }

  // ---------------------------------------------------------------- notifications

  toast(ext, view, { onClick, onButton, onClose }) {
    this.ensure();
    const t = el('div', { class: 'toast', role: 'status' });
    let timer = null;
    let closed = false;
    const close = (byUser, silent) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      t.remove();
      onClose(byUser, silent);
    };
    const arm = (v) => { clearTimeout(timer); if (!v.requireInteraction) timer = setTimeout(() => close(false), 7000); };
    const render = (v) => {
      t.textContent = '';
      const icon = el('img', { class: 'ic', alt: '' });
      if (v.icon) { icon.src = v.icon; icon.onerror = () => icon.remove(); } else icon.hidden = true;
      const body = el('div', { class: 'bd' },
        el('div', { class: 'app' }, el('span', { text: v.appName }), el('button', { class: 'x', type: 'button', title: 'Close', 'aria-label': 'Close', text: '×', onclick: (e) => { e.stopPropagation(); close(true); } })),
        el('div', { class: 'ti', text: v.title }),
        v.message ? el('div', { class: 'ms', text: v.message }) : null,
        ...v.items.map((i) => el('div', { class: 'ms' }, el('b', { text: (i.title || '') + ' ' }), i.message || '')),
        v.contextMessage ? el('div', { class: 'cm', text: v.contextMessage }) : null,
        v.image ? el('img', { class: 'im', src: v.image, alt: '' }) : null,
        v.progress != null ? (() => { const bar = el('div', { class: 'pg' }, el('i')); bar.firstChild.style.width = Math.max(0, Math.min(100, v.progress)) + '%'; return bar; })() : null,
        v.buttons.length ? el('div', { class: 'bt' }, ...v.buttons.map((label, i) => el('button', { type: 'button', text: label, onclick: (e) => { e.stopPropagation(); onButton(i); close(true); } }))) : null,
      );
      t.append(icon, body);
      arm(v);
    };
    t.addEventListener('click', () => { onClick(); });
    t.addEventListener('mouseenter', () => clearTimeout(timer));
    t.addEventListener('mouseleave', () => arm(cur));
    let cur = view;
    render(view);
    this.toastBox.prepend(t);
    return { update: (v) => { cur = v; render(v); }, close };
  }

  destroyIfEmpty() {
    if (!this.dock.children.length && !this.panels.size && this.host) {
      if (this._keeper) { this._keeper.disconnect(); this._keeper = null; }
      this.host.remove();
    }
  }
}
