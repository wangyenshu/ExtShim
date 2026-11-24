// action / browserAction / pageAction, contextMenus / menus, commands, notifications,
// sidePanel / sidebarAction.
import { toRGBA } from './helpers.js';
import { getSidePanel, parseShortcut, pickIcon, shortcutMatches } from '../../core/manifest.js';
import { matchesAny } from '../../core/match.js';
import { getBackground } from '../../core/manifest.js';

// ------------------------------------------------------------------ action state

export class ActionState {
  constructor(ext) {
    this.ext = ext;
    const a = ext.action;
    this.global = {
      title: a.title, popup: a.popup, badgeText: '', badgeBg: [217, 48, 37, 255], badgeFg: null,
      icon: a.icon ? { path: a.icon } : null, enabled: a.kind !== 'page_action',
    };
    this.tabs = new Map();
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
      if (value === null || value === undefined) delete this.tabs.get(tabId)[prop];
      else this.tabs.get(tabId)[prop] = value;
    } else this.global[prop] = value;
    this.refresh();
  }
  refresh() {
    const L = this.ext.launcher;
    if (!L) return;
    const icon = this.get('icon');
    L.update({
      title: this.get('title') || this.ext.name,
      badgeText: this.get('badgeText') || '',
      badgeBg: this.get('badgeBg'),
      badgeFg: this.get('badgeFg'),
      icon,
      enabled: this.get('enabled'),
      hasPopup: !!this.get('popup'),
    });
  }
}

function resolveIconPath(ext, ctx, path) {
  if (!path) return null;
  if (typeof path === 'string') return ext.resolvePath(path, ctx.isExtensionPage ? ctx.path : '') ?? path;
  const out = {};
  for (const k of Object.keys(path)) out[k] = ext.resolvePath(path[k], ctx.isExtensionPage ? ctx.path : '') ?? path[k];
  return out;
}

export function actionApi(h, kind) {
  const { ctx, ext, fn } = h;
  const st = ext.state.action;
  const tabOf = (d) => (d && typeof d.tabId === 'number' ? d.tabId : null);
  const api = {
    setTitle: fn((d = {}) => st.set('title', d.title, tabOf(d))),
    getTitle: fn((d = {}) => st.get('title', tabOf(d)) || ''),
    setIcon: fn((d = {}) => {
      let icon = null;
      if (d.imageData) {
        let data = d.imageData;
        if (!(data instanceof ImageData) && typeof data === 'object') { const sizes = Object.keys(data).map(Number).sort((a, b) => a - b); data = data[sizes.find((s) => s >= 32) || sizes[sizes.length - 1]]; }
        icon = { imageData: data };
      } else if (d.path) icon = { path: resolveIconPath(ext, ctx, d.path) };
      st.set('icon', icon, tabOf(d));
    }),
    setPopup: fn((d = {}) => st.set('popup', d.popup ? (ext.resolvePath(d.popup, ctx.isExtensionPage ? ctx.path : '') ?? d.popup) : '', tabOf(d))),
    getPopup: fn((d = {}) => { const p = st.get('popup', tabOf(d)); return p ? ext.virtualUrl(p) : ''; }),
    setBadgeText: fn((d = {}) => st.set('badgeText', d.text == null ? (tabOf(d) != null ? null : '') : String(d.text), tabOf(d))),
    getBadgeText: fn((d = {}) => st.get('badgeText', tabOf(d)) || ''),
    setBadgeBackgroundColor: fn((d = {}) => st.set('badgeBg', toRGBA(d.color), tabOf(d))),
    getBadgeBackgroundColor: fn((d = {}) => st.get('badgeBg', tabOf(d))),
    setBadgeTextColor: fn((d = {}) => st.set('badgeFg', d.color == null ? null : toRGBA(d.color), tabOf(d))),
    getBadgeTextColor: fn((d = {}) => st.get('badgeFg', tabOf(d)) || [255, 255, 255, 255]),
    enable: fn((tabId) => st.set('enabled', true, typeof tabId === 'number' ? tabId : null)),
    disable: fn((tabId) => st.set('enabled', false, typeof tabId === 'number' ? tabId : null)),
    isEnabled: fn((tabId) => !!st.get('enabled', typeof tabId === 'number' ? tabId : null)),
    openPopup: fn(async () => {
      const popup = st.get('popup');
      if (!popup) throw new Error('Extension does not have a popup on the active tab.');
      await ext.togglePopup(popup, { forceOpen: true });
    }),
    getUserSettings: fn(() => ({ isOnToolbar: true })),
    onClicked: h.event(`${kind}.onClicked`),
    onUserSettingsChanged: h.event(`${kind}.onUserSettingsChanged`),
  };
  if (kind === 'pageAction') {
    api.show = fn((tabId) => st.set('enabled', true, typeof tabId === 'number' ? tabId : null));
    api.hide = fn((tabId) => st.set('enabled', false, typeof tabId === 'number' ? tabId : null));
    api.isShown = fn((d = {}) => !!st.get('enabled', typeof d.tabId === 'number' ? d.tabId : null));
  }
  return api;
}

// ------------------------------------------------------------------ context menus

class MenusState {
  constructor(ext) {
    this.ext = ext;
    this.items = new Map();
    this.handlers = new Map();
    this.nextId = 1;
    const bg = getBackground(ext.manifest);
    this.persist = !!bg && (bg.kind === 'worker' || ext.manifest.background.persistent === false);
    // The internal storage area is loaded before any extension code runs, so read it synchronously.
    if (this.persist) for (const it of ext.storage.internal().data.menus || []) this.items.set(it.id, it);
    for (const id of this.items.keys()) if (typeof id === 'number' && id >= this.nextId) this.nextId = id + 1;
    this.loaded = Promise.resolve();
    this.unregister = ext.shim.ui.registerMenuProvider(ext, (info) => this.tree(info));
  }
  dispose() { this.unregister(); }
  save() {
    if (this.persist) this.ext.storage.internal().set({ menus: [...this.items.values()] });
  }
  create(props, ctx) {
    const id = props.id != null ? props.id : this.nextId++;
    if (this.items.has(id)) throw new Error(`Cannot create item with duplicate id ${id}`);
    if (props.parentId != null && !this.items.has(props.parentId)) throw new Error(`Cannot find menu item with id ${props.parentId}`);
    const item = { type: 'normal', contexts: ['page'], enabled: true, visible: true, checked: false, ...props, id };
    delete item.onclick;
    this.items.set(id, item);
    if (typeof props.onclick === 'function') this.handlers.set(id, { fn: props.onclick, ctx });
    this.save();
    return id;
  }
  update(id, props, ctx) {
    const it = this.items.get(id);
    if (!it) throw new Error(`Cannot find menu item with id ${id}`);
    const { onclick, ...rest } = props;
    Object.assign(it, rest);
    if (typeof onclick === 'function') this.handlers.set(id, { fn: onclick, ctx });
    this.save();
  }
  remove(id) {
    if (!this.items.has(id)) throw new Error(`Cannot find menu item with id ${id}`);
    const kill = (x) => { this.items.delete(x); this.handlers.delete(x); for (const it of [...this.items.values()]) if (it.parentId === x) kill(it.id); };
    kill(id);
    this.save();
  }
  removeAll() { this.items.clear(); this.handlers.clear(); this.save(); }

  applies(it, info) {
    if (!it.visible) return false;
    const c = it.contexts || ['page'];
    if (it.documentUrlPatterns && !matchesAny(it.documentUrlPatterns, info.pageUrl)) return false;
    if (it.targetUrlPatterns && (info.linkUrl || info.srcUrl) && !matchesAny(it.targetUrlPatterns, info.linkUrl || info.srcUrl)) return false;
    if (c.includes('all')) return !info.launcher;
    return info.contexts.some((x) => c.includes(x));
  }

  /** Build the menu tree for a click; consumed by ui.js. */
  tree(info) {
    const ext = this.ext;
    const build = (parentId) => {
      const list = [...this.items.values()].filter((it) => (it.parentId ?? null) === parentId && (it.type === 'separator' || this.applies(it, info)));
      return list.map((it) => ({
        id: it.id, type: it.type, label: String(it.title || '').replace(/%s/g, (info.selectionText || '').slice(0, 64)), enabled: it.enabled !== false,
        checked: !!it.checked, children: build(it.id), onClick: () => this.click(it, info),
      })).filter((x) => x.type === 'separator' || x.type !== 'normal' || x.children.length || !this.hasChildren(x.id));
    };
    return { title: ext.name, ext, items: build(null) };
  }
  hasChildren(id) { for (const it of this.items.values()) if (it.parentId === id) return true; return false; }

  click(it, info) {
    const ext = this.ext;
    const wasChecked = !!it.checked;
    if (it.type === 'checkbox') it.checked = !it.checked;
    if (it.type === 'radio') {
      const siblings = [...this.items.values()].filter((x) => (x.parentId ?? null) === (it.parentId ?? null));
      const i = siblings.indexOf(it);
      let a = i, b = i;
      while (a > 0 && siblings[a - 1].type === 'radio') a--;
      while (b < siblings.length - 1 && siblings[b + 1].type === 'radio') b++;
      for (let k = a; k <= b; k++) siblings[k].checked = siblings[k] === it;
    }
    this.save();
    const data = {
      menuItemId: it.id, parentMenuItemId: it.parentId, editable: !!info.editable, pageUrl: info.pageUrl, frameId: 0, frameUrl: info.frameUrl,
      linkUrl: info.linkUrl, linkText: info.linkText, srcUrl: info.srcUrl, mediaType: info.mediaType, selectionText: info.selectionText || undefined,
      ...(it.type === 'checkbox' || it.type === 'radio' ? { wasChecked, checked: !!it.checked } : {}),
      button: 0, modifiers: [],
    };
    for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];
    const tab = ext.pageTab();
    ext.dispatch('contextMenus.onClicked', () => [JSON.parse(JSON.stringify(data)), tab]);
    ext.dispatch('menus.onClicked', () => [JSON.parse(JSON.stringify(data)), tab]);
    const hnd = this.handlers.get(it.id);
    if (hnd && hnd.ctx.alive) { try { hnd.fn(data, tab); } catch (e) { ext.log.error('Error in contextMenus onclick handler:', e); } }
  }
}

export function menusApi(h, ns) {
  const { ctx, ext, fn } = h;
  const st = ext.shared('menus', () => new MenusState(ext));
  return {
    create(props = {}, cb) {
      ctx.assertAlive();
      let id;
      let err = null;
      try { id = st.create(props, ctx); } catch (e) { err = e; id = props.id; }
      if (typeof cb === 'function') setTimeout(() => ctx.callback(cb, err), 0);
      else if (err) ext.log.warn('Unchecked runtime.lastError:', err.message);
      return id;
    },
    update: fn(async (id, props = {}) => { await st.loaded; st.update(id, props, ctx); }),
    remove: fn(async (id) => { await st.loaded; st.remove(id); }),
    removeAll: fn(async () => { await st.loaded; st.removeAll(); }),
    refresh: fn(() => {}),
    getTargetElement: () => ext.shim.ui.lastContextTarget || null,
    overrideContext: () => {},
    onClicked: h.event(`${ns}.onClicked`),
    onShown: h.event(`${ns}.onShown`),
    onHidden: h.event(`${ns}.onHidden`),
    ACTION_MENU_TOP_LEVEL_LIMIT: 6,
    ContextType: { ALL: 'all', PAGE: 'page', FRAME: 'frame', SELECTION: 'selection', LINK: 'link', EDITABLE: 'editable', IMAGE: 'image', VIDEO: 'video', AUDIO: 'audio', LAUNCHER: 'launcher', BROWSER_ACTION: 'browser_action', PAGE_ACTION: 'page_action', ACTION: 'action' },
    ItemType: { NORMAL: 'normal', CHECKBOX: 'checkbox', RADIO: 'radio', SEPARATOR: 'separator' },
  };
}

// ------------------------------------------------------------------ commands

export function startCommands(ext) {
  const isMac = /mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
  const os = isMac ? 'mac' : /win/i.test(navigator.platform) ? 'windows' : /CrOS/.test(navigator.userAgent) ? 'chromeos' : 'linux';
  const list = [];
  for (const [name, c] of Object.entries(ext.manifest.commands || {})) {
    const sk = (c && c.suggested_key) || {};
    const text = typeof sk === 'string' ? sk : sk[os] || sk.default || '';
    list.push({ name, description: c && c.description ? ext.localized.commands?.[name]?.description || c.description : '', text, sc: parseShortcut(text, isMac) });
  }
  const trigger = (name) => {
    if (/^_execute_(action|browser_action|page_action)$/.test(name)) return ext.clickAction();
    if (name === '_execute_sidebar_action') return ext.openSidePanel().catch(() => {});
    ext.dispatch('commands.onCommand', () => [name, ext.pageTab()]);
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
  const wins = new Set();
  const attach = (win) => { if (!list.some((c) => c.sc) || wins.has(win)) return; wins.add(win); win.addEventListener('keydown', onKey, true); };
  ext.state.commands = { list, attach, trigger };
  attach(window);
  return () => { for (const w of wins) { try { w.removeEventListener('keydown', onKey, true); } catch { /* gone */ } } wins.clear(); };
}

export function commandsApi(h) {
  const { ext, fn } = h;
  const st = () => ext.state.commands || { list: [] };
  return {
    getAll: fn(() => st().list.map((c) => ({ name: c.name, description: c.description, shortcut: c.sc ? c.text : '' }))),
    update: fn((d = {}) => {
      const c = st().list.find((x) => x.name === d.name);
      if (!c) throw new Error('Unknown command: ' + d.name);
      if (d.shortcut !== undefined) { c.text = d.shortcut; c.sc = parseShortcut(d.shortcut, /mac/i.test(navigator.platform)); }
      if (d.description !== undefined) c.description = d.description;
    }),
    reset: fn((name) => { void name; }),
    openShortcutSettings: fn(() => ext.shim.ui.shortcuts(ext)),
    onCommand: h.event('commands.onCommand'),
    onChanged: h.event('commands.onChanged'),
  };
}

// ------------------------------------------------------------------ notifications

export class NotificationsState {
  constructor(ext) { this.ext = ext; this.map = new Map(); this.n = 0; }
  resolveUrl(u, ctx) {
    if (!u) return '';
    if (/^(data|blob|https?):/i.test(u)) return u;
    const p = this.ext.resolvePath(u, ctx && ctx.isExtensionPage ? ctx.path : '');
    return p != null && this.ext.vfs.has(p) ? this.ext.resourceUrl(p) : u;
  }
  view(o, ctx) {
    return {
      title: o.title || '', message: o.message || '', contextMessage: o.contextMessage || '',
      icon: this.resolveUrl(o.iconUrl, ctx) || (this.ext.iconPath(48) ? this.ext.resourceUrl(this.ext.iconPath(48)) : ''),
      image: o.type === 'image' ? this.resolveUrl(o.imageUrl, ctx) : '',
      items: o.type === 'list' ? o.items || [] : [], progress: o.type === 'progress' ? o.progress : null,
      buttons: (o.buttons || []).slice(0, 2).map((b) => b.title), requireInteraction: !!o.requireInteraction, silent: !!o.silent, appName: this.ext.name,
    };
  }
  create(id, options = {}, ctx) {
    const ext = this.ext;
    id = id || `extshim-${Date.now().toString(36)}-${++this.n}`;
    if (this.map.has(id)) this.map.get(id).toast.close(false, true);
    const entry = { options: { ...options } };
    entry.toast = ext.shim.ui.toast(ext, this.view(options, ctx), {
      onClick: () => ext.dispatch('notifications.onClicked', [id]),
      onButton: (i) => ext.dispatch('notifications.onButtonClicked', [id, i]),
      onClose: (byUser, silent) => { if (this.map.get(id) === entry) this.map.delete(id); if (!silent) ext.dispatch('notifications.onClosed', [id, !!byUser]); },
    });
    this.map.set(id, entry);
    ext.dispatch('notifications.onShown', [id]);
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
  dispose() { for (const e of this.map.values()) e.toast.close(false, true); this.map.clear(); }
}

export function notificationsApi(h) {
  const { ctx, ext, fn } = h;
  const st = ext.shared('notifications', () => new NotificationsState(ext));
  return {
    create: fn((a, b) => (typeof a === 'string' || a == null ? st.create(a, b, ctx) : st.create(null, a, ctx))),
    update: fn((id, o) => st.update(id, o || {}, ctx)),
    clear: fn((id) => st.clear(id)),
    getAll: fn(() => Object.fromEntries([...st.map.keys()].map((k) => [k, true]))),
    getPermissionLevel: fn(() => 'granted'),
    onClicked: h.event('notifications.onClicked'),
    onButtonClicked: h.event('notifications.onButtonClicked'),
    onClosed: h.event('notifications.onClosed'),
    onPermissionLevelChanged: h.event('notifications.onPermissionLevelChanged'),
    onShowSettings: h.event('notifications.onShowSettings'),
    onShown: h.event('notifications.onShown'),
    TemplateType: { BASIC: 'basic', IMAGE: 'image', LIST: 'list', PROGRESS: 'progress' },
    PermissionLevel: { GRANTED: 'granted', DENIED: 'denied' },
  };
}

// ------------------------------------------------------------------ side panel

function sidePanelState(ext) {
  return ext.shared('sidePanel', () => {
    const saved = ext.storage.internal().data.sidePanelBehavior;
    return { options: { path: getSidePanel(ext.localized), enabled: true }, tabs: new Map(), behavior: { openPanelOnActionClick: false, ...(saved || {}) } };
  });
}

export function sidePanelApi(h) {
  const { ext, fn } = h;
  const st = sidePanelState(ext);
  return {
    setOptions: fn((o = {}) => {
      const target = o.tabId != null ? (st.tabs.get(o.tabId) || st.tabs.set(o.tabId, {}).get(o.tabId)) : st.options;
      if (o.path !== undefined) target.path = ext.resolvePath(o.path, '') ?? o.path;
      if (o.enabled !== undefined) target.enabled = o.enabled;
    }),
    getOptions: fn((o = {}) => {
      const t = o.tabId != null ? { ...st.options, ...(st.tabs.get(o.tabId) || {}) } : st.options;
      return { path: t.path ? ext.virtualUrl(t.path) : undefined, enabled: t.enabled !== false, tabId: o.tabId };
    }),
    setPanelBehavior: fn(async (b = {}) => {
      Object.assign(st.behavior, b);
      await ext.storage.internal().set({ sidePanelBehavior: st.behavior });
    }),
    getPanelBehavior: fn(() => ({ ...st.behavior })),
    open: fn(async (o = {}) => {
      const t = o.tabId != null ? { ...st.options, ...(st.tabs.get(o.tabId) || {}) } : st.options;
      await ext.openSidePanel(t.path);
    }),
    close: fn(() => { for (const [id, ov] of ext.overlays) if (ov.panel.kind === 'side') ext.closeOverlay(id); }),
    getLayout: fn(() => ({ side: 'right' })),
    onOpened: h.event('sidePanel.onOpened'),
    onClosed: h.event('sidePanel.onClosed'),
  };
}

export function sidebarActionApi(h) {
  const { ext, fn } = h;
  const st = sidePanelState(ext);
  const isOpen = () => [...ext.overlays.values()].some((o) => o.panel.kind === 'side');
  const close = () => { for (const [id, ov] of ext.overlays) if (ov.panel.kind === 'side') ext.closeOverlay(id); };
  return {
    open: fn(() => ext.openSidePanel(st.options.path)),
    close: fn(close),
    toggle: fn(() => (isOpen() ? close() : ext.openSidePanel(st.options.path))),
    isOpen: fn(() => isOpen()),
    setPanel: fn((d = {}) => { st.options.path = d.panel ? ext.resolvePath(d.panel, '') ?? d.panel : getSidePanel(ext.localized); }),
    getPanel: fn(() => (st.options.path ? ext.virtualUrl(st.options.path) : '')),
    setTitle: fn((d = {}) => { st.title = d.title; }),
    getTitle: fn(() => st.title || ext.name),
    setIcon: fn(() => {}),
  };
}

export { pickIcon };

// ------------------------------------------------------------------ omnibox (as an in-page command palette)

export class OmniboxState {
  constructor(ext) {
    this.ext = ext;
    this.keyword = (ext.manifest.omnibox && ext.manifest.omnibox.keyword) || '';
    this.defaultSuggestion = null;
    this.session = null;
  }
  open() {
    const ext = this.ext;
    if (this.session) { this.session.focus(); return; }
    let started = false;
    let seq = 0;
    this.session = ext.shim.ui.palette(ext, {
      keyword: this.keyword,
      defaultSuggestion: () => this.defaultSuggestion && this.defaultSuggestion.description,
      onInput: (text, show) => {
        if (!started) { started = true; ext.dispatch('omnibox.onInputStarted', []); }
        const mine = ++seq;
        ext.dispatch('omnibox.onInputChanged', () => [text, (results) => { if (mine === seq) show(Array.isArray(results) ? results : []); }]);
      },
      onEnter: (text, disposition) => { this.session = null; ext.dispatch('omnibox.onInputEntered', [text, disposition]); },
      onCancel: () => { this.session = null; if (started) ext.dispatch('omnibox.onInputCancelled', []); },
      onDelete: (text) => ext.dispatch('omnibox.onDeleteSuggestion', [text]),
    });
  }
}

export function omniboxApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('omnibox', () => new OmniboxState(ext));
  return {
    setDefaultSuggestion: fn((s) => { st.defaultSuggestion = s || null; }),
    onInputStarted: h.event('omnibox.onInputStarted'),
    onInputChanged: h.event('omnibox.onInputChanged'),
    onInputEntered: h.event('omnibox.onInputEntered'),
    onInputCancelled: h.event('omnibox.onInputCancelled'),
    onDeleteSuggestion: h.event('omnibox.onDeleteSuggestion'),
    OnInputEnteredDisposition: { CURRENT_TAB: 'currentTab', NEW_FOREGROUND_TAB: 'newForegroundTab', NEW_BACKGROUND_TAB: 'newBackgroundTab' },
    DescriptionStyleType: { URL: 'url', MATCH: 'match', DIM: 'dim' },
  };
}
