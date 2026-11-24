// Assemble the chrome.* / browser.* object for one context.
import { makeHelpers, stubNamespace } from './helpers.js';
import { extensionApi, i18nApi, managementApi, permissionsApi, runtimeApi, storageApi } from './core-apis.js';
import { scriptingApi, tabsApi, windowsApi } from './tabs-apis.js';
import { actionApi, commandsApi, menusApi, notificationsApi, omniboxApi, sidebarActionApi, sidePanelApi } from './ui-apis.js';
import { alarmsApi, downloadsApi, idleApi, offscreenApi, ttsApi, webNavigationApi } from './misc-apis.js';
import { namespaceDefs } from './registry.js';
import { ENUMS } from './enums.js';

// Permissions -> namespace, for permissions whose module is not part of this build.
const PERMISSION_NAMESPACES = {
  webRequest: 'webRequest', webRequestBlocking: 'webRequest', webRequestAuthProvider: 'webRequest', webRequestFilterResponse: 'webRequest',
  declarativeNetRequest: 'declarativeNetRequest', declarativeNetRequestWithHostAccess: 'declarativeNetRequest', declarativeNetRequestFeedback: 'declarativeNetRequest',
  declarativeContent: 'declarativeContent', cookies: 'cookies', history: 'history', bookmarks: 'bookmarks', topSites: 'topSites',
  sessions: 'sessions', browsingData: 'browsingData', proxy: 'proxy', privacy: 'privacy', contentSettings: 'contentSettings',
  debugger: 'debugger', identity: 'identity', gcm: 'gcm', tabGroups: 'tabGroups', readingList: 'readingList', search: 'search',
  fontSettings: 'fontSettings', ttsEngine: 'ttsEngine', pageCapture: 'pageCapture', desktopCapture: 'desktopCapture', tabCapture: 'tabCapture',
  power: 'power', printing: 'printing', printerProvider: 'printerProvider', printingMetrics: 'printingMetrics', userScripts: 'userScripts', dns: 'dns',
  contextualIdentities: 'contextualIdentities', find: 'find', theme: 'theme', captivePortal: 'captivePortal', documentScan: 'documentScan',
  wallpaper: 'wallpaper', audio: 'audio', certificateProvider: 'certificateProvider', fileSystemProvider: 'fileSystemProvider',
  fileBrowserHandler: 'fileBrowserHandler', loginState: 'loginState', platformKeys: 'platformKeys', vpnProvider: 'vpnProvider',
  webAuthenticationProxy: 'webAuthenticationProxy', browserSettings: 'browserSettings', pkcs11: 'pkcs11', telemetry: 'telemetry',
  geckoProfiler: 'geckoProfiler', normandyAddonStudy: 'normandyAddonStudy', urlbar: 'urlbar', networkStatus: 'networkStatus',
  activityLog: 'activityLog', gcm2: 'instanceID', publicSuffix: 'publicSuffix', systemLog: 'systemLog', mimeHandler: 'mimeHandler',
  'system.cpu': 'system', 'system.memory': 'system', 'system.storage': 'system', 'system.display': 'system',
  'enterprise.deviceAttributes': 'enterprise', 'enterprise.hardwarePlatform': 'enterprise', 'enterprise.networkingAttributes': 'enterprise',
  'enterprise.platformKeys': 'enterprise', 'enterprise.login': 'enterprise', input: 'input', clipboardWrite: null,
  'accessibilityFeatures.read': 'accessibilityFeatures', 'accessibilityFeatures.modify': 'accessibilityFeatures',
};

function getPath(obj, parts) {
  let v = obj;
  for (const p of parts) { if (v == null) return undefined; v = v[p]; }
  return v;
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
    o = o[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (o[last] && typeof o[last] === 'object' && value && typeof value === 'object') Object.assign(o[last], value);
  else o[last] = value;
}

export function manifestPermissions(m) {
  return new Set([...(m.permissions || []), ...(m.optional_permissions || [])].filter((p) => typeof p === 'string'));
}

/** Is a registry definition available to this context? */
export function available(def, ext, ctx, perms) {
  const t = ctx.type;
  if (def.contexts === 'content' && t !== 'content') return false;
  if (def.contexts === 'extension' && t === 'content') return false;
  if (def.contexts === 'devtools' && t !== 'devtools') return false;
  if (def.when && !def.when(ext, ctx)) return false;
  if (def.always) return true;
  if (ext.options.allApis) return true;
  if (def.perms.some((p) => perms.has(p))) return true;
  if (def.keys.some((k) => ext.manifest[k] != null)) return true;
  return !def.perms.length && !def.keys.length;
}

export function buildApi(ctx) {
  const h = makeHelpers(ctx);
  const ext = ctx.ext;
  const m = ext.manifest;
  const perms = manifestPermissions(m);
  const want = (p) => ext.options.allApis || perms.has(p);
  const api = {};
  api.runtime = runtimeApi(h);
  api.extension = extensionApi(h, api.runtime);
  api.i18n = i18nApi(h);
  api.storage = storageApi(h);

  if (ctx.type !== 'content') {
    api.tabs = tabsApi(h);
    api.windows = windowsApi(h);
    api.permissions = permissionsApi(h);
    api.management = managementApi(h);
    api.commands = commandsApi(h);
    if ((ext.mv === 3 && m.action) || (ext.options.allApis && ext.mv === 3)) api.action = actionApi(h, 'action');
    if (m.browser_action || (ext.options.allApis && ext.mv === 2)) api.browserAction = actionApi(h, 'browserAction');
    if (m.page_action) api.pageAction = actionApi(h, 'pageAction');
    if (want('contextMenus') || want('menus')) { api.contextMenus = menusApi(h, 'contextMenus'); api.menus = api.contextMenus; }
    if (want('alarms')) api.alarms = alarmsApi(h);
    if (want('notifications')) api.notifications = notificationsApi(h);
    if (want('scripting')) api.scripting = scriptingApi(h);
    if (want('offscreen')) api.offscreen = offscreenApi(h);
    if (want('sidePanel') || m.side_panel) api.sidePanel = sidePanelApi(h);
    if (m.sidebar_action) api.sidebarAction = sidebarActionApi(h);
    if (want('downloads')) api.downloads = downloadsApi(h);
    if (want('idle')) api.idle = idleApi(h);
    if (want('tts') || want('ttsEngine')) api.tts = ttsApi(h);
    if (want('webNavigation')) api.webNavigation = webNavigationApi(h);
    if (m.omnibox) api.omnibox = omniboxApi(h);
  } else if (want('menus') || want('contextMenus')) {
    api.menus = { getTargetElement: () => ext.shim.ui.lastContextTarget || null };
  }

  for (const def of namespaceDefs()) {
    if (!available(def, ext, ctx, perms)) continue;
    try { setPath(api, def.name, def.build(h)); } catch (e) { ext.log.error(`Could not build chrome.${def.name}:`, e); }
  }

  // Declared permissions whose namespace is not in this build get inert stubs.
  if (ctx.type !== 'content') {
    for (const p of perms) {
      const ns = PERMISSION_NAMESPACES[p];
      if (ns && !api[ns]) api[ns] = stubNamespace(h, ns, enumsFor(ns));
    }
  }
  mergeEnums(api);
  return api;
}

function enumsFor(ns) {
  const out = {};
  for (const [path, values] of Object.entries(ENUMS)) {
    if (path.startsWith(ns + '.') && path.split('.').length === ns.split('.').length + 1) out[path.split('.').pop()] = values;
  }
  return out;
}

/** Add generated enum objects (chrome.runtime.OnInstalledReason, ...) to every namespace present. */
function mergeEnums(api) {
  for (const [path, values] of Object.entries(ENUMS)) {
    const parts = path.split('.');
    const name = parts.pop();
    const ns = getPath(api, parts);
    if (!ns || (typeof ns !== 'object' && typeof ns !== 'function')) continue;
    try {
      const cur = ns[name];
      if (cur && typeof cur === 'object') { for (const k of Object.keys(values)) if (!(k in cur)) cur[k] = values[k]; }
      else if (cur === undefined || typeof cur === 'function') {
        if (Object.isExtensible(ns) && !Object.prototype.hasOwnProperty.call(ns, name)) ns[name] = { ...values };
      }
    } catch { /* stub proxies etc. */ }
  }
}
