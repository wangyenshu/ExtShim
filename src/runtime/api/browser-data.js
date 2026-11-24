// "Browser profile" APIs backed by a virtual profile that ExtShim keeps for each extension
// (persisted with the extension's storage): bookmarks, history (recorded from the pages the
// extension runs on), topSites, sessions, readingList, tabGroups, contextualIdentities, search.
import { defineNamespace, defineStartup, features } from './registry.js';
import { tabGroupState } from '../tabgroups.js';

function profile(ext, key, init) {
  return ext.shared('profile:' + key, () => {
    const internal = ext.storage.internal();
    const saved = internal.data['profile:' + key];
    const p = { data: saved ? JSON.parse(JSON.stringify(saved)) : init(), timer: null };
    p.save = () => {
      clearTimeout(p.timer);
      p.timer = setTimeout(() => internal.set({ ['profile:' + key]: p.data }), 30);
    };
    return p;
  });
}
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const now = () => Date.now();

// ------------------------------------------------------------------ bookmarks

const ROOTS = { 0: '', 1: 'Bookmarks bar', 2: 'Other bookmarks', 3: 'Mobile bookmarks' };
const FOLDER_TYPE = { 1: 'bookmarks-bar', 2: 'other', 3: 'mobile' };

function bookmarkStore(ext) {
  return profile(ext, 'bookmarks', () => {
    const t = now();
    const nodes = { 0: { id: '0', title: '', children: ['1', '2', '3'], dateAdded: t } };
    for (const id of ['1', '2', '3']) nodes[id] = { id, parentId: '0', title: ROOTS[id], children: [], dateAdded: t, dateGroupModified: t, folderType: FOLDER_TYPE[id] };
    return { nextId: 100, nodes };
  });
}

export function bookmarksImport(ext, html) {
  const st = bookmarkStore(ext);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const add = (dl, parentId) => {
    for (const dt of dl.children) {
      if (dt.localName !== 'dt') continue;
      const a = dt.querySelector(':scope > a');
      const h = dt.querySelector(':scope > h3');
      if (a) createNode(ext, st, { parentId, title: a.textContent, url: a.getAttribute('href'), dateAdded: (+a.getAttribute('add_date') || 0) * 1000 || undefined });
      else if (h) {
        const f = createNode(ext, st, { parentId, title: h.textContent });
        const sub = dt.querySelector(':scope > dl');
        if (sub) add(sub, f.id);
      }
    }
  };
  const root = doc.querySelector('dl');
  if (root) add(root, '1');
  st.save();
}

function createNode(ext, st, o) {
  const n = st.data.nodes;
  const parentId = String(o.parentId ?? '2');
  const parent = n[parentId];
  if (!parent || !parent.children) throw new Error("Can't find parent bookmark for id.");
  if (parentId === '0') throw new Error("Can't modify the root bookmark folders.");
  const id = String(st.data.nextId++);
  const node = { id, parentId, title: o.title || '', dateAdded: o.dateAdded || now() };
  if (o.type === 'separator') node.type = 'separator';
  else if (o.url) node.url = String(o.url);
  else { node.children = []; node.dateGroupModified = node.dateAdded; }
  n[id] = node;
  const idx = o.index == null ? parent.children.length : Math.max(0, Math.min(parent.children.length, o.index));
  parent.children.splice(idx, 0, id);
  parent.dateGroupModified = now();
  return node;
}

export function bookmarksApi(h) {
  const { ext, fn } = h;
  const st = bookmarkStore(ext);
  const N = () => st.data.nodes;
  const view = (id, deep = false) => {
    const x = N()[id];
    if (!x) return null;
    const out = { id: x.id, title: x.title, dateAdded: x.dateAdded, syncing: false };
    if (x.parentId != null) { out.parentId = x.parentId; out.index = N()[x.parentId].children.indexOf(x.id); }
    if (x.url) { out.url = x.url; if (x.dateLastUsed) out.dateLastUsed = x.dateLastUsed; out.type = 'bookmark'; }
    else if (x.type === 'separator') out.type = 'separator';
    else { out.dateGroupModified = x.dateGroupModified; out.type = 'folder'; if (x.folderType) out.folderType = x.folderType; }
    if (deep && x.children) out.children = x.children.map((c) => view(c, true));
    return out;
  };
  const must = (id) => { if (!N()[String(id)]) throw new Error("Can't find bookmark for id."); return String(id); };
  const root = (id) => { if (['0', '1', '2', '3'].includes(String(id))) throw new Error("Can't modify the root bookmark folders."); };
  const all = () => Object.values(N()).filter((x) => x.url);
  const emit = (ev, args) => ext.dispatch('bookmarks.' + ev, () => clone(args));
  const api = {
    get: fn((ids) => (Array.isArray(ids) ? ids : [ids]).map((i) => view(must(i)))),
    getChildren: fn((id) => (N()[must(id)].children || []).map((c) => view(c))),
    getRecent: fn((n) => all().sort((a, b) => b.dateAdded - a.dateAdded).slice(0, Math.max(1, n | 0)).map((x) => view(x.id))),
    getTree: fn(() => [view('0', true)]),
    getSubTree: fn((id) => [view(must(id), true)]),
    search: fn((q) => {
      if (typeof q === 'string') {
        const words = q.toLowerCase().split(/\s+/).filter(Boolean);
        return Object.values(N()).filter((x) => x.id !== '0' && words.length && words.every((w) => (x.title || '').toLowerCase().includes(w) || (x.url || '').toLowerCase().includes(w))).map((x) => view(x.id));
      }
      q = q || {};
      return Object.values(N()).filter((x) => x.id !== '0' &&
        (!q.url || x.url === q.url) && (!q.title || x.title === q.title) &&
        (!q.query || q.query.toLowerCase().split(/\s+/).every((w) => (x.title || '').toLowerCase().includes(w) || (x.url || '').toLowerCase().includes(w)))).map((x) => view(x.id));
    }),
    create: fn((o = {}) => {
      const node = createNode(ext, st, o);
      st.save();
      const v = view(node.id);
      emit('onCreated', [node.id, v]);
      return v;
    }),
    move: fn((id, d = {}) => {
      id = must(id); root(id);
      const x = N()[id];
      const oldParentId = x.parentId;
      const oldIndex = N()[oldParentId].children.indexOf(id);
      const parentId = String(d.parentId ?? oldParentId);
      const parent = N()[parentId];
      if (!parent || !parent.children || parentId === '0') throw new Error("Can't find parent bookmark for id.");
      for (let p = parentId; p; p = N()[p] && N()[p].parentId) if (p === id) throw new Error("Can't move a folder into itself.");
      N()[oldParentId].children.splice(oldIndex, 1);
      const idx = d.index == null ? parent.children.length : Math.max(0, Math.min(parent.children.length, d.index));
      parent.children.splice(idx, 0, id);
      x.parentId = parentId;
      st.save();
      emit('onMoved', [id, { parentId, index: idx, oldParentId, oldIndex }]);
      return view(id);
    }),
    update: fn((id, c = {}) => {
      id = must(id); root(id);
      const x = N()[id];
      if (c.title !== undefined) x.title = String(c.title);
      if (c.url !== undefined) { if (!x.url) throw new Error("Can't set URL of a bookmark folder."); x.url = String(c.url); }
      st.save();
      emit('onChanged', [id, { title: x.title, ...(x.url ? { url: x.url } : {}) }]);
      return view(id);
    }),
    remove: fn((id) => {
      id = must(id); root(id);
      if (N()[id].children && N()[id].children.length) throw new Error("Can't remove non-empty folder (use recursive to force).");
      return removeTree(id);
    }),
    removeTree: fn((id) => { id = must(id); root(id); return removeTree(id); }),
    onCreated: h.event('bookmarks.onCreated'), onRemoved: h.event('bookmarks.onRemoved'), onChanged: h.event('bookmarks.onChanged'),
    onMoved: h.event('bookmarks.onMoved'), onChildrenReordered: h.event('bookmarks.onChildrenReordered'),
    onImportBegan: h.event('bookmarks.onImportBegan'), onImportEnded: h.event('bookmarks.onImportEnded'),
    MAX_WRITE_OPERATIONS_PER_HOUR: 1000000, MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE: 1000000, ROOT_NODE_ID: '0',
  };
  function removeTree(id) {
    const x = N()[id];
    const node = view(id, true);
    const parent = N()[x.parentId];
    const index = parent.children.indexOf(id);
    parent.children.splice(index, 1);
    const kill = (i) => { const n = N()[i]; if (n.children) n.children.forEach(kill); delete N()[i]; };
    kill(id);
    st.save();
    emit('onRemoved', [id, { parentId: x.parentId, index, node }]);
  }
  return api;
}

// ------------------------------------------------------------------ history

function historyStore(ext) {
  return profile(ext, 'history', () => ({ items: {}, visits: [], nextId: 1, nextVisit: 1 }));
}

export function recordVisit(ext, url, title, transition = 'link') {
  if (!/^(https?|file):/.test(url)) return;
  const st = historyStore(ext);
  const d = st.data;
  let it = d.items[url];
  if (!it) it = d.items[url] = { id: String(d.nextId++), url, title: title || '', lastVisitTime: 0, visitCount: 0, typedCount: 0 };
  it.lastVisitTime = now();
  it.visitCount++;
  if (transition === 'typed') it.typedCount++;
  if (title) it.title = title;
  d.visits.push({ id: it.id, url, visitId: String(d.nextVisit++), visitTime: it.lastVisitTime, referringVisitId: '0', transition, isLocal: true });
  if (d.visits.length > 10000) d.visits.splice(0, d.visits.length - 10000);
  st.save();
  ext.dispatch('history.onVisited', () => [clone(it)]);
}

defineStartup((ext) => {
  recordVisit(ext, location.href, document.title, 'link');
  let lastTitle = document.title;
  ext.navHooks.add((url) => recordVisit(ext, url, document.title, 'link'));
  const t = setInterval(() => {
    if (document.title !== lastTitle) {
      lastTitle = document.title;
      const it = historyStore(ext).data.items[location.href];
      if (it) { it.title = lastTitle; historyStore(ext).save(); ext.dispatch('history.onTitleChanged', [{ id: it.id, url: it.url, title: lastTitle }]); }
    }
  }, 1500);
  ext.cleanups.push(() => clearInterval(t));
}, ['history', 'topSites']);

export function historyApi(h) {
  const { ext, fn } = h;
  const st = historyStore(ext);
  const d = () => st.data;
  const removed = (urls, all = false) => ext.dispatch('history.onVisitRemoved', [{ allHistory: all, urls }]);
  const prune = () => {
    const live = new Set(d().visits.map((v) => v.url));
    const gone = Object.keys(d().items).filter((u) => !live.has(u));
    gone.forEach((u) => delete d().items[u]);
    return gone;
  };
  return {
    search: fn((q = {}) => {
      const text = String(q.text || '').toLowerCase();
      const start = q.startTime == null ? now() - 864e5 : +q.startTime;
      const end = q.endTime == null ? Infinity : +q.endTime;
      return Object.values(d().items)
        .filter((i) => i.lastVisitTime >= start && i.lastVisitTime <= end && (!text || text.split(/\s+/).every((w) => i.url.toLowerCase().includes(w) || (i.title || '').toLowerCase().includes(w))))
        .sort((a, b) => b.lastVisitTime - a.lastVisitTime).slice(0, q.maxResults == null ? 100 : q.maxResults || Infinity).map(clone);
    }),
    getVisits: fn((o = {}) => d().visits.filter((v) => v.url === o.url).map(({ url, ...v }) => clone(v))),
    addUrl: fn((o = {}) => {
      if (!o.url) throw new Error('Invalid URL.');
      recordVisit(ext, o.url, o.title, o.transition || 'link');
      if (o.visitTime) { const it = d().items[o.url]; if (it) { it.lastVisitTime = +o.visitTime; d().visits[d().visits.length - 1].visitTime = +o.visitTime; st.save(); } }
    }),
    deleteUrl: fn((o = {}) => {
      d().visits = d().visits.filter((v) => v.url !== o.url);
      delete d().items[o.url];
      st.save();
      removed([o.url]);
    }),
    deleteRange: fn((o = {}) => {
      d().visits = d().visits.filter((v) => v.visitTime < o.startTime || v.visitTime > o.endTime);
      const gone = prune();
      st.save();
      removed(gone);
    }),
    deleteAll: fn(() => { d().visits = []; d().items = {}; st.save(); removed([], true); }),
    onVisited: h.event('history.onVisited'),
    onVisitRemoved: h.event('history.onVisitRemoved'),
    onTitleChanged: h.event('history.onTitleChanged'),
  };
}

export function topSitesApi(h) {
  const { ext, fn } = h;
  return {
    get: fn((o = {}) => {
      const items = Object.values(historyStore(ext).data.items).sort((a, b) => b.visitCount - a.visitCount || b.lastVisitTime - a.lastVisitTime);
      const out = [];
      const seen = new Set();
      for (const i of items) {
        let host = '';
        try { host = new URL(i.url).hostname; } catch { /* ignore */ }
        if (o.onePerDomain && seen.has(host)) continue;
        seen.add(host);
        out.push({ url: i.url, title: i.title, type: 'url', ...(o.includeFavicon ? { favicon: new URL('/favicon.ico', i.url).href } : {}) });
        if (out.length >= (o.limit || 12)) break;
      }
      return out;
    }),
  };
}

// ------------------------------------------------------------------ sessions

function sessionStore(ext) {
  return profile(ext, 'sessions', () => ({ closed: [], current: null, tabValues: {}, windowValues: {} }));
}

export function noteClosedTab(ext, tab) {
  if (!ext.state['profile:sessions'] && !(ext.manifest.permissions || []).includes('sessions')) return;
  const st = sessionStore(ext);
  st.data.closed.unshift({ lastModified: Math.floor(now() / 1000), tab: { ...tab, sessionId: 's' + now().toString(36) } });
  st.data.closed = st.data.closed.slice(0, 25);
  st.save();
  ext.dispatch('sessions.onChanged', []);
}

defineStartup((ext) => {
  const st = sessionStore(ext);
  // The page the extension ran on last time is the most recently "closed tab".
  if (st.data.current && st.data.current.url !== location.href) {
    st.data.closed.unshift({ lastModified: Math.floor(st.data.current.time / 1000), tab: { ...st.data.current.tab, sessionId: 's' + st.data.current.time.toString(36) } });
    st.data.closed = st.data.closed.slice(0, 25);
  }
  const update = () => { st.data.current = { url: location.href, time: now(), tab: { ...ext.pageTab(), active: false } }; st.save(); };
  update();
  ext.navHooks.add(update);
}, ['sessions']);

export function sessionsApi(h) {
  const { ext, fn } = h;
  const st = sessionStore(ext);
  const find = (id) => st.data.closed.findIndex((s) => (s.tab && s.tab.sessionId === id) || (s.window && s.window.sessionId === id));
  return {
    MAX_SESSION_RESULTS: 25,
    getRecentlyClosed: fn((f = {}) => clone(st.data.closed.slice(0, f.maxResults == null ? 25 : f.maxResults))),
    getDevices: fn(() => []),
    restore: fn((id) => {
      const i = id == null ? 0 : find(id);
      if (i < 0 || !st.data.closed[i]) throw new Error('There are no sessions to restore.');
      const [s] = st.data.closed.splice(i, 1);
      st.save();
      const url = s.tab && s.tab.url;
      if (url && ext.resolvePath(url) != null) ext.openTab(url);
      else if (url) window.open(url, '_blank');
      ext.dispatch('sessions.onChanged', []);
      return clone(s);
    }),
    forgetClosedTab: fn((windowId, id) => { const i = find(id); if (i < 0) throw new Error('Invalid session id.'); st.data.closed.splice(i, 1); st.save(); }),
    forgetClosedWindow: fn((id) => { const i = find(id); if (i >= 0) { st.data.closed.splice(i, 1); st.save(); } }),
    setTabValue: fn((tabId, key, value) => { (st.data.tabValues[tabId] = st.data.tabValues[tabId] || {})[key] = clone(value); st.save(); }),
    getTabValue: fn((tabId, key) => clone((st.data.tabValues[tabId] || {})[key])),
    removeTabValue: fn((tabId, key) => { if (st.data.tabValues[tabId]) { delete st.data.tabValues[tabId][key]; st.save(); } }),
    setWindowValue: fn((windowId, key, value) => { (st.data.windowValues[windowId] = st.data.windowValues[windowId] || {})[key] = clone(value); st.save(); }),
    getWindowValue: fn((windowId, key) => clone((st.data.windowValues[windowId] || {})[key])),
    removeWindowValue: fn((windowId, key) => { if (st.data.windowValues[windowId]) { delete st.data.windowValues[windowId][key]; st.save(); } }),
    onChanged: h.event('sessions.onChanged'),
  };
}

// ------------------------------------------------------------------ reading list

export function readingListApi(h) {
  const { ext, fn } = h;
  const st = profile(ext, 'readingList', () => ({ entries: {} }));
  const E = () => st.data.entries;
  const norm = (u) => { try { return new URL(u).href; } catch { throw new Error('URL is not valid.'); } };
  return {
    addEntry: fn((e = {}) => {
      const url = norm(e.url);
      if (E()[url]) throw new Error('Duplicate URL.');
      const t = now();
      E()[url] = { url, title: e.title || '', hasBeenRead: !!e.hasBeenRead, creationTime: t, lastUpdateTime: t };
      st.save();
      ext.dispatch('readingList.onEntryAdded', () => [clone(E()[url])]);
    }),
    query: fn((q = {}) => Object.values(E()).filter((e) => (q.url == null || e.url === norm(q.url)) && (q.title == null || e.title === q.title) && (q.hasBeenRead == null || e.hasBeenRead === q.hasBeenRead)).map(clone)),
    removeEntry: fn((q = {}) => {
      const url = norm(q.url);
      const e = E()[url];
      if (!e) throw new Error('URL not found.');
      delete E()[url];
      st.save();
      ext.dispatch('readingList.onEntryRemoved', () => [clone(e)]);
    }),
    updateEntry: fn((q = {}) => {
      const url = norm(q.url);
      const e = E()[url];
      if (!e) throw new Error('URL not found.');
      if (q.title != null) e.title = q.title;
      if (q.hasBeenRead != null) e.hasBeenRead = !!q.hasBeenRead;
      e.lastUpdateTime = now();
      st.save();
      ext.dispatch('readingList.onEntryUpdated', () => [clone(e)]);
    }),
    onEntryAdded: h.event('readingList.onEntryAdded'),
    onEntryRemoved: h.event('readingList.onEntryRemoved'),
    onEntryUpdated: h.event('readingList.onEntryUpdated'),
  };
}

// ------------------------------------------------------------------ tab groups

export function tabGroupsApi(h) {
  const { ext, fn } = h;
  const gs = tabGroupState(ext.shim);
  const get = (id) => { const g = gs.groups.get(id); if (!g) throw new Error(`No group with id: ${id}.`); return g; };
  return {
    TAB_GROUP_ID_NONE: -1,
    get: fn((id) => ({ ...get(id) })),
    query: fn((q = {}) => [...gs.groups.values()].filter((g) => Object.keys(q).every((k) => k === 'windowId' ? q[k] === -2 || q[k] === g.windowId : g[k] === q[k])).map((g) => ({ ...g }))),
    update: fn((id, p = {}) => {
      const g = get(id);
      for (const k of ['collapsed', 'color', 'title']) if (p[k] !== undefined) g[k] = p[k];
      ext.dispatch('tabGroups.onUpdated', () => [{ ...g }]);
      return { ...g };
    }),
    move: fn((id) => { const g = get(id); ext.dispatch('tabGroups.onMoved', () => [{ ...g }]); return { ...g }; }),
    onCreated: h.event('tabGroups.onCreated'), onUpdated: h.event('tabGroups.onUpdated'),
    onMoved: h.event('tabGroups.onMoved'), onRemoved: h.event('tabGroups.onRemoved'),
  };
}

// ------------------------------------------------------------------ contextual identities (Firefox containers)

const CI_COLORS = { blue: '#37adff', turquoise: '#00c79a', green: '#51cd00', yellow: '#ffcb00', orange: '#ff9f00', red: '#ff613d', pink: '#ff4bda', purple: '#af51f5', toolbar: '#7c7c7d' };

export function contextualIdentitiesApi(h) {
  const { ext, fn } = h;
  const st = profile(ext, 'containers', () => ({
    next: 5,
    list: [['Personal', 'blue', 'fingerprint'], ['Work', 'orange', 'briefcase'], ['Banking', 'green', 'dollar'], ['Shopping', 'pink', 'cart']]
      .map(([name, color, icon], i) => ({ cookieStoreId: 'firefox-container-' + (i + 1), name, color, icon })),
  }));
  const view = (c) => ({ ...c, colorCode: CI_COLORS[c.color] || '#7c7c7d', iconUrl: `resource://usercontext-content/${c.icon}.svg` });
  const find = (id) => { const c = st.data.list.find((x) => x.cookieStoreId === id); if (!c) throw new Error(`Invalid contextual identity: ${id}`); return c; };
  const emit = (ev, c) => ext.dispatch('contextualIdentities.' + ev, () => [{ contextualIdentity: view(c) }]);
  return {
    query: fn((d = {}) => st.data.list.filter((c) => d.name == null || c.name === d.name).map(view)),
    get: fn((id) => view(find(id))),
    create: fn((d = {}) => { const c = { cookieStoreId: 'firefox-container-' + st.data.next++, name: d.name || '', color: d.color || 'blue', icon: d.icon || 'circle' }; st.data.list.push(c); st.save(); emit('onCreated', c); return view(c); }),
    update: fn((id, d = {}) => { const c = find(id); for (const k of ['name', 'color', 'icon']) if (d[k] != null) c[k] = d[k]; st.save(); emit('onUpdated', c); return view(c); }),
    remove: fn((id) => { const c = find(id); st.data.list = st.data.list.filter((x) => x !== c); st.save(); emit('onRemoved', c); return view(c); }),
    move: fn((ids, position) => {
      const list = st.data.list;
      const moving = (Array.isArray(ids) ? ids : [ids]).map(find);
      const rest = list.filter((c) => !moving.includes(c));
      const at = position < 0 ? rest.length : Math.min(position, rest.length);
      st.data.list = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
      st.save();
    }),
    onCreated: h.event('contextualIdentities.onCreated'), onUpdated: h.event('contextualIdentities.onUpdated'), onRemoved: h.event('contextualIdentities.onRemoved'),
  };
}

// ------------------------------------------------------------------ search

const ENGINES = [
  { name: 'Google', url: 'https://www.google.com/search?q={searchTerms}', alias: '@google', favIconUrl: 'https://www.google.com/favicon.ico' },
  { name: 'Bing', url: 'https://www.bing.com/search?q={searchTerms}', alias: '@bing', favIconUrl: 'https://www.bing.com/favicon.ico' },
  { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={searchTerms}', alias: '@ddg', favIconUrl: 'https://duckduckgo.com/favicon.ico' },
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/w/index.php?search={searchTerms}', alias: '@wikipedia', favIconUrl: 'https://en.wikipedia.org/favicon.ico' },
];

export function searchApi(h) {
  const { ext, fn } = h;
  const engines = () => {
    const opt = ext.options.searchEngine;
    if (!opt) return ENGINES.map((e, i) => ({ ...e, isDefault: i === 0 }));
    const custom = typeof opt === 'string' ? { name: 'Default', url: opt } : opt;
    return [{ ...custom, isDefault: true }, ...ENGINES.filter((e) => e.name !== custom.name).map((e) => ({ ...e, isDefault: false }))];
  };
  const go = (text, engineName, disposition) => {
    const list = engines();
    const e = (engineName && list.find((x) => x.name === engineName)) || list.find((x) => x.isDefault);
    if (engineName && e.name !== engineName) throw new Error(`${engineName} was not found`);
    const url = e.url.replace('{searchTerms}', encodeURIComponent(String(text))).replace('%s', encodeURIComponent(String(text)));
    const d = String(disposition || 'CURRENT_TAB').toUpperCase();
    if (d === 'CURRENT_TAB') setTimeout(() => { location.href = url; }, 0);
    else window.open(url, '_blank', d === 'NEW_WINDOW' ? 'noopener,popup' : 'noopener');
  };
  return {
    query: fn((q = {}) => go(q.text, null, q.disposition)),
    search: fn((q = {}) => go(q.query, q.engine, q.disposition)),
    get: fn(() => engines().map(({ name, isDefault, alias, favIconUrl }) => ({ name, isDefault, alias, favIconUrl }))),
  };
}

features.noteClosedTab = noteClosedTab;
features.importBookmarks = bookmarksImport;
defineNamespace('bookmarks', bookmarksApi, { perms: ['bookmarks'] });
defineNamespace('history', historyApi, { perms: ['history'] });
defineNamespace('topSites', topSitesApi, { perms: ['topSites'] });
defineNamespace('sessions', sessionsApi, { perms: ['sessions'] });
defineNamespace('readingList', readingListApi, { perms: ['readingList'] });
defineNamespace('tabGroups', tabGroupsApi, { perms: ['tabGroups'] });
defineNamespace('contextualIdentities', contextualIdentitiesApi, { perms: ['contextualIdentities'] });
defineNamespace('search', searchApi, { perms: ['search'] });
