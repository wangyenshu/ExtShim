// Tab groups and split views over ExtShim's virtual tabs (shared by tabs.* and tabGroups.*).
const COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

export function tabGroupState(shim) {
  if (!shim.tabGroups) shim.tabGroups = { groups: new Map(), of: new Map(), next: 1 + Math.floor(Math.random() * 1e5), splits: new Map(), nextSplit: 1 };
  return shim.tabGroups;
}

function tabOf(ext, id) { return id === ext.shim.tabId ? ext.pageTab() : ext.overlayTab(id); }

export function groupTabs(ext, o = {}) {
  const gs = tabGroupState(ext.shim);
  const ids = Array.isArray(o.tabIds) ? o.tabIds : [o.tabIds];
  for (const t of ids) if (!tabOf(ext, t)) throw new Error(`No tab with id: ${t}.`);
  let gid = o.groupId;
  if (gid == null) {
    gid = gs.next++;
    gs.groups.set(gid, { id: gid, collapsed: false, color: COLORS[gs.groups.size % COLORS.length], title: '', windowId: ext.shim.windowId, shared: false });
    ext.dispatch('tabGroups.onCreated', () => [{ ...gs.groups.get(gid) }]);
  } else if (!gs.groups.has(gid)) throw new Error(`No group with id: ${gid}.`);
  for (const t of ids) gs.of.set(t, gid);
  for (const t of ids) ext.dispatch('tabs.onUpdated', () => [t, { groupId: gid }, tabOf(ext, t)]);
  return gid;
}

export function ungroupTabs(ext, tabIds) {
  const gs = tabGroupState(ext.shim);
  for (const t of Array.isArray(tabIds) ? tabIds : [tabIds]) {
    const g = gs.of.get(t);
    gs.of.delete(t);
    ext.dispatch('tabs.onUpdated', () => [t, { groupId: -1 }, tabOf(ext, t)]);
    if (g != null && ![...gs.of.values()].includes(g)) {
      const grp = gs.groups.get(g);
      gs.groups.delete(g);
      ext.dispatch('tabGroups.onRemoved', () => [{ ...grp }]);
    }
  }
}

export function groupIdOf(shim, tabId) {
  const gs = shim.tabGroups;
  return gs && gs.of.has(tabId) ? gs.of.get(tabId) : -1;
}

export function splitIdOf(shim, tabId) {
  const gs = shim.tabGroups;
  if (gs) for (const [id, tabs] of gs.splits) if (tabs.includes(tabId)) return id;
  return -1;
}
