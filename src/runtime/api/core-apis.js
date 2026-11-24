// runtime, extension, i18n, storage, permissions, management.
import { NO_RESPONSE } from '../messaging.js';
import { QUOTAS } from '../storage.js';
import { getBackground, getOptionsPage, getPermissions, pickIcon } from '../../core/manifest.js';
import { matchesAny } from '../../core/match.js';

const NO_RECEIVER = 'Could not establish connection. Receiving end does not exist.';
const PORT_CLOSED = 'The message port closed before a response was received.';

export function platformInfo() {
  const ua = navigator.userAgent;
  const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const os = /mac/i.test(p) ? 'mac' : /win/i.test(p) ? 'win' : /android/i.test(ua) ? 'android' : /CrOS/.test(ua) ? 'cros' : /openbsd/i.test(ua) ? 'openbsd' : /fuchsia/i.test(ua) ? 'fuchsia' : 'linux';
  const arch = /arm|aarch/i.test(ua + p) ? 'arm64' : 'x86-64';
  return { os, arch, nacl_arch: arch === 'arm64' ? 'arm' : arch };
}

function looksLikeExtensionId(ext, s) {
  return typeof s === 'string' && (s === ext.id || /^[a-p]{32}$/.test(s) || /^[\w.+-]*@[\w.-]+$/.test(s) || /^\{[0-9a-f-]{36}\}$/i.test(s));
}

/** Shared by runtime.sendMessage and tabs.sendMessage. */
export function messageSender(ctx, send) {
  return function (...args) {
    const cb = args.length && typeof args[args.length - 1] === 'function' ? args.pop() : null;
    ctx.assertAlive();
    let p;
    try { p = send(args); } catch (e) { p = Promise.reject(e); }
    if (!cb) return p.then((r) => (r === NO_RESPONSE ? undefined : r));
    p.then(
      (r) => (r === NO_RESPONSE ? ctx.withLastError(PORT_CLOSED, () => cb()) : ctx.callback(cb, null, r)),
      (e) => ctx.callback(cb, e),
    );
    return undefined;
  };
}

const CONTEXT_TYPES = { background: 'BACKGROUND', popup: 'POPUP', tab: 'TAB', options: 'TAB', sidepanel: 'SIDE_PANEL', offscreen: 'OFFSCREEN_DOCUMENT', frame: 'TAB', devtools: 'DEVELOPER_TOOLS' };

export function runtimeApi(h) {
  const { ctx, ext, fn } = h;
  const ev = (n) => h.event('runtime.' + n);
  const rt = {
    get id() { return ext.id; },
    get lastError() { ctx._leChecked = true; return ctx.lastError; },
    getURL: (p) => ext.getURL(p),
    getManifest: () => JSON.parse(JSON.stringify(ext.manifest)),
    sendMessage: messageSender(ctx, (args) => {
      let extId = null;
      let message;
      if (args.length >= 3) [extId, message] = args;
      else if (args.length === 2) { if (looksLikeExtensionId(ext, args[0])) [extId, message] = args; else [message] = args; }
      else [message] = args;
      if (args.length === 0) throw new TypeError('Error in invocation of runtime.sendMessage: No matching signature.');
      if (extId != null && extId !== ext.id) return Promise.reject(new Error(NO_RECEIVER));
      return ext.bus.send(ctx, message);
    }),
    connect(a, b) {
      ctx.assertAlive();
      const info = typeof a === 'object' && a ? a : b || {};
      if (typeof a === 'string' && a !== ext.id) {
        const port = ext.bus.connect(ctx, { name: '__external__', tabId: -999 });
        return port;
      }
      return ext.bus.connect(ctx, { name: info.name || '' });
    },
    onMessage: ev('onMessage'),
    onConnect: ev('onConnect'),
    onMessageExternal: ev('onMessageExternal'),
    onConnectExternal: ev('onConnectExternal'),
    onUserScriptMessage: ev('onUserScriptMessage'),
    onUserScriptConnect: ev('onUserScriptConnect'),
    OnInstalledReason: { INSTALL: 'install', UPDATE: 'update', CHROME_UPDATE: 'chrome_update', BROWSER_UPDATE: 'browser_update', SHARED_MODULE_UPDATE: 'shared_module_update' },
    OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
    PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd', FUCHSIA: 'fuchsia' },
    PlatformArch: { ARM: 'arm', ARM64: 'arm64', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
    ContextType: { TAB: 'TAB', POPUP: 'POPUP', BACKGROUND: 'BACKGROUND', OFFSCREEN_DOCUMENT: 'OFFSCREEN_DOCUMENT', SIDE_PANEL: 'SIDE_PANEL', DEVELOPER_TOOLS: 'DEVELOPER_TOOLS' },
  };
  if (ctx.type === 'content') return rt;
  Object.assign(rt, {
    onInstalled: ev('onInstalled'),
    onStartup: ev('onStartup'),
    onSuspend: ev('onSuspend'),
    onSuspendCanceled: ev('onSuspendCanceled'),
    onUpdateAvailable: ev('onUpdateAvailable'),
    onRestartRequired: ev('onRestartRequired'),
    onBrowserUpdateAvailable: ev('onBrowserUpdateAvailable'),
    getBackgroundPage: fn(async () => {
      await ext.whenBackgroundReady();
      const bg = getBackground(ext.manifest);
      if (!bg || bg.kind === 'worker') throw new Error('You do not have a background page.');
      return ext.background ? ext.background.win : null;
    }),
    openOptionsPage: fn(() => ext.openOptions()),
    reload: () => { setTimeout(() => ext.reload(), 0); },
    restart: () => {},
    restartAfterDelay: fn(() => {}),
    getPlatformInfo: fn(() => platformInfo()),
    getBrowserInfo: fn(() => ({ name: 'ExtShim', vendor: 'ExtShim', version: ext.shim.version, buildID: '0' })),
    setUninstallURL: fn(() => {}),
    requestUpdateCheck: fn(() => ({ status: 'no_update', version: ext.manifest.version })),
    getContexts: fn((filter = {}) => [...ext.contexts].filter((c) => c.alive && c.isExtensionPage).map((c) => ({
      contextType: CONTEXT_TYPES[c.type] || 'TAB', contextId: c.documentId, tabId: c.tabId ?? -1, windowId: ext.shim.windowId,
      documentId: c.documentId, frameId: c.frameId ?? 0, documentUrl: c.url, documentOrigin: ext.origin, incognito: false,
    })).filter((c) => (!filter.contextTypes || filter.contextTypes.includes(c.contextType)) && (!filter.documentUrls || filter.documentUrls.includes(c.documentUrl)) && (!filter.tabIds || filter.tabIds.includes(c.tabId)))),
    connectNative: (app) => {
      const host = ext.options.nativeMessaging;
      if (typeof host !== 'function') throw new Error('Native messaging needs a host adapter (ExtShim option "nativeMessaging").');
      const port = host(app);
      const onMessage = h.event('native:' + app + ':message');
      const onDisconnect = h.event('native:' + app + ':disconnect');
      if (port.onMessage) port.onMessage((m) => onMessage.dispatch(m));
      if (port.onDisconnect) port.onDisconnect(() => onDisconnect.dispatch());
      return { name: app, onMessage, onDisconnect, postMessage: (m) => port.postMessage(JSON.parse(JSON.stringify(m))), disconnect: () => port.disconnect && port.disconnect() };
    },
    sendNativeMessage: fn((app, msg) => {
      const host = ext.options.nativeMessaging;
      if (typeof host !== 'function') throw new Error('Native messaging needs a host adapter (ExtShim option "nativeMessaging").');
      return new Promise((resolve, reject) => {
        const port = host(app);
        if (port.onMessage) port.onMessage((m) => { resolve(m); port.disconnect && port.disconnect(); });
        if (port.onDisconnect) port.onDisconnect((e) => reject(new Error((e && e.message) || 'Native host has exited.')));
        port.postMessage(JSON.parse(JSON.stringify(msg)));
      });
    }),
    onPerformanceWarning: ev('onPerformanceWarning'),
    getFrameId: (target) => {
      if (target === window || (target && target.contentWindow === window)) return 0;
      const w = target && (target.contentWindow || target);
      for (const f of ext.content.frames.values()) if (f.win === w) return f.frameId;
      return -1;
    },
    getPackageDirectoryEntry: fn(() => packageDirectory(ext)),
    getVersion: () => ext.manifest.version,
    onConnectNative: ev('onConnectNative'),
    onEnabled: ev('onEnabled'),
  });
  return rt;
}

export function extensionApi(h, rt) {
  const { ctx, ext, fn } = h;
  const x = {
    get lastError() { ctx._leChecked = true; return ctx.lastError; },
    getURL: (p) => ext.getURL(p),
    inIncognitoContext: false,
    sendRequest: rt.sendMessage,
    onRequest: rt.onMessage,
  };
  if (ctx.type === 'content') return x;
  Object.assign(x, {
    getBackgroundPage: () => {
      const bg = getBackground(ext.manifest);
      return bg && bg.kind !== 'worker' && ext.background ? ext.background.win : null;
    },
    getViews: (f = {}) => ext.views(f).map((c) => c.win),
    getExtensionTabs: () => ext.views({ type: 'tab' }).map((c) => c.win),
    isAllowedIncognitoAccess: fn(() => false),
    isAllowedFileSchemeAccess: fn(() => false),
    setUpdateUrlData: () => {},
    onRequestExternal: h.event('extension.onRequestExternal'),
    ViewType: { TAB: 'tab', POPUP: 'popup' },
  });
  return x;
}

export function i18nApi(h) {
  const { ext, fn } = h;
  return {
    getMessage: (name, subs) => ext.getMessage(name, subs),
    getUILanguage: () => ext.uiLocale.replace('_', '-'),
    getAcceptLanguages: fn(() => [...(navigator.languages || [navigator.language])]),
    getPreferredSystemLanguages: fn(() => [...(navigator.languages || [navigator.language])]),
    detectLanguage: fn(async (text) => {
      // Chrome's built-in language detector (on-device), when available.
      try {
        if (self.LanguageDetector && (await self.LanguageDetector.availability()) === 'available') {
          const d = await self.LanguageDetector.create();
          const r = (await d.detect(String(text))).filter((x) => x.detectedLanguage !== 'und').slice(0, 3);
          return { isReliable: !!r[0] && r[0].confidence > 0.7, languages: r.map((x) => ({ language: x.detectedLanguage, percentage: Math.round(x.confidence * 100) })) };
        }
      } catch { /* fall through */ }
      return { isReliable: false, languages: [] };
    }),
  };
}

export function storageApi(h) {
  const { ctx, ext, fn } = h;
  const mgr = ext.storage;
  const access = ext.shared('storageAccess', () => ({ session: 'TRUSTED_CONTEXTS' }));
  const area = (name) => {
    const a = () => mgr.areas[name];
    const guard = () => {
      if (name === 'session' && ctx.type === 'content' && access.session !== 'TRUSTED_AND_UNTRUSTED_CONTEXTS') throw new Error('Access to storage is not allowed from this context.');
    };
    return {
      get: fn((keys) => { guard(); return a().get(keys); }),
      getKeys: fn(() => { guard(); return a().getKeys(); }),
      set: fn((items) => { guard(); return a().set(items); }),
      remove: fn((keys) => { guard(); return a().remove(keys); }),
      clear: fn(() => { guard(); return a().clear(); }),
      getBytesInUse: fn((keys) => { guard(); return a().getBytesInUse(keys); }),
      setAccessLevel: fn((o) => { if (ctx.type === 'content') throw new Error('Access denied.'); if (name === 'session') access.session = (o && o.accessLevel) || 'TRUSTED_CONTEXTS'; }),
      onChanged: h.event(`storage.${name}.onChanged`),
      ...QUOTAS[name],
    };
  };
  return {
    local: area('local'),
    sync: area('sync'),
    session: area('session'),
    managed: area('managed'),
    onChanged: h.event('storage.onChanged'),
    AccessLevel: { TRUSTED_CONTEXTS: 'TRUSTED_CONTEXTS', TRUSTED_AND_UNTRUSTED_CONTEXTS: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' },
  };
}

export function permissionsApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('permissions', () => {
    const p = getPermissions(ext.manifest);
    return { info: p, granted: new Set(p.permissions), origins: new Set(p.origins) };
  });
  const internal = ext.storage.internal();
  const restore = internal.get('grantedPermissions').then((r) => {
    const g = r.grantedPermissions;
    if (g) { g.permissions.forEach((x) => st.granted.add(x)); g.origins.forEach((x) => st.origins.add(x)); }
  });
  const save = () => internal.set({ grantedPermissions: { permissions: [...st.granted], origins: [...st.origins] } });
  const has = (perms = [], origins = []) => perms.every((p) => st.granted.has(p)) &&
    origins.every((o) => st.origins.has(o) || st.origins.has('<all_urls>') || matchesAny([...st.origins], o.replace(/\*/g, 'x')));
  return {
    contains: fn(async (q = {}) => { await restore; return has(q.permissions, q.origins); }),
    getAll: fn(async () => { await restore; return { permissions: [...st.granted], origins: [...st.origins] }; }),
    request: fn(async (q = {}) => {
      await restore;
      const added = { permissions: (q.permissions || []).filter((p) => !st.granted.has(p)), origins: (q.origins || []).filter((o) => !st.origins.has(o)) };
      added.permissions.forEach((p) => st.granted.add(p));
      added.origins.forEach((o) => st.origins.add(o));
      if (added.permissions.length || added.origins.length) {
        ext.log.info('Granted optional permissions:', added);
        await save();
        ext.dispatch('permissions.onAdded', () => [JSON.parse(JSON.stringify(added))]);
      }
      return true;
    }),
    remove: fn(async (q = {}) => {
      await restore;
      const removed = { permissions: (q.permissions || []).filter((p) => st.granted.has(p) && !st.info.permissions.includes(p)), origins: (q.origins || []).filter((o) => st.origins.has(o) && !st.info.origins.includes(o)) };
      removed.permissions.forEach((p) => st.granted.delete(p));
      removed.origins.forEach((o) => st.origins.delete(o));
      await save();
      if (removed.permissions.length || removed.origins.length) ext.dispatch('permissions.onRemoved', () => [JSON.parse(JSON.stringify(removed))]);
      return true;
    }),
    addHostAccessRequest: fn(() => {}),
    removeHostAccessRequest: fn(() => {}),
    onAdded: h.event('permissions.onAdded'),
    onRemoved: h.event('permissions.onRemoved'),
  };
}

/** runtime.getPackageDirectoryEntry: a read-only FileSystem DirectoryEntry over the extension files. */
function packageDirectory(ext) {
  const files = () => (ext.vfs.paths ? ext.vfs.paths() : []);
  const fileEntry = (path) => ({
    isFile: true, isDirectory: false, name: path.split('/').pop(), fullPath: '/' + path,
    file(ok, err) { ext.vfs.blob(path).then((b) => (b ? ok(new File([b], path.split('/').pop(), { type: b.type })) : err && err(new DOMException('NotFoundError', 'NotFoundError')))); },
  });
  const dirEntry = (dir) => ({
    isFile: false, isDirectory: true, name: dir.split('/').pop() || '', fullPath: '/' + dir,
    createReader() {
      let done = false;
      return {
        readEntries(ok) {
          if (done) return ok([]);
          done = true;
          const prefix = dir ? dir + '/' : '';
          const names = new Map();
          for (const f of files()) {
            if (!f.startsWith(prefix)) continue;
            const rest = f.slice(prefix.length);
            const head = rest.split('/')[0];
            names.set(head, rest.includes('/') ? dirEntry(prefix + head) : fileEntry(f));
          }
          ok([...names.values()]);
        },
      };
    },
    getFile(path, opts, ok, err) {
      const p = (dir ? dir + '/' : '') + String(path).replace(/^\//, '');
      if (files().includes(p)) ok && ok(fileEntry(p)); else err && err(new DOMException('A requested file or directory could not be found.', 'NotFoundError'));
    },
    getDirectory(path, opts, ok, err) {
      const p = (dir ? dir + '/' : '') + String(path).replace(/^\/|\/$/g, '');
      if (files().some((f) => f.startsWith(p + '/'))) ok && ok(dirEntry(p)); else err && err(new DOMException('A requested file or directory could not be found.', 'NotFoundError'));
    },
  });
  return dirEntry('');
}

export function managementApi(h) {
  const { ext, fn } = h;
  const infoOf = (x) => {
    const m = x.localized;
    const perms = getPermissions(x.manifest);
    const o = getOptionsPage(m);
    return {
      id: x.id, name: m.name, shortName: m.short_name || m.name, description: m.description || '', version: m.version || '', versionName: m.version_name,
      mayDisable: true, mayEnable: true, enabled: x.status === 'running', homepageUrl: m.homepage_url, updateUrl: m.update_url, installType: 'development',
      type: 'extension', offlineEnabled: !!m.offline_enabled, isApp: false, optionsUrl: o ? x.virtualUrl(o.path) : '', permissions: perms.permissions, hostPermissions: perms.origins,
      icons: Object.keys(m.icons || {}).map((s) => ({ size: +s, url: x.getURL(pickIcon(m.icons, +s)) })),
    };
  };
  const others = () => ext.shim.list().filter((x) => x !== ext);
  const find = (id) => { const x = ext.shim.get(id); if (!x) throw new Error('Failed to find extension with id ' + id + '.'); return x; };
  const self = () => {
    const m = ext.localized;
    const perms = getPermissions(ext.manifest);
    const o = getOptionsPage(m);
    return {
      id: ext.id, name: m.name, shortName: m.short_name || m.name, description: m.description || '', version: m.version || '',
      versionName: m.version_name, mayDisable: true, mayEnable: true, enabled: true, homepageUrl: m.homepage_url, updateUrl: m.update_url,
      installType: 'development', type: 'extension', offlineEnabled: !!m.offline_enabled, isApp: false,
      optionsUrl: o ? ext.virtualUrl(o.path) : '', permissions: perms.permissions, hostPermissions: perms.origins,
      icons: Object.keys(m.icons || {}).map((s) => ({ size: +s, url: ext.getURL(pickIcon(m.icons, +s)) })),
    };
  };
  return {
    getSelf: fn(() => self()),
    getAll: fn(() => [self(), ...others().map(infoOf)]),
    get: fn((id) => (id === ext.id ? self() : infoOf(find(id)))),
    getPermissionWarningsByManifest: fn(() => []),
    getPermissionWarningsById: fn(() => []),
    uninstallSelf: fn(() => { setTimeout(() => ext.stop(), 0); }),
    install: fn(() => { throw new Error('management.install can only install themes from addons.mozilla.org, which a web page cannot do.'); }),
    setEnabled: fn(async (id, enabled) => {
      const x = find(id);
      if (x === ext) throw new Error('Extensions cannot disable themselves.');
      if (!enabled && x.status === 'running') { await x.stop(); ext.dispatch('management.onDisabled', () => [infoOf(x)]); }
      else if (enabled && x.status === 'stopped') { const y = await x.reload(); ext.dispatch('management.onEnabled', () => [infoOf(y)]); }
    }),
    uninstall: fn(async (id) => { const x = find(id); await x.stop(); ext.dispatch('management.onUninstalled', [id]); }),
    launchApp: fn(() => { throw new Error('Chrome Apps are not supported.'); }),
    createAppShortcut: fn(() => { throw new Error('Chrome Apps are not supported.'); }),
    generateAppForLink: fn(() => { throw new Error('Chrome Apps are not supported.'); }),
    installReplacementWebApp: fn(() => { throw new Error('No replacement web app is specified in the manifest.'); }),
    setLaunchType: fn(() => {}),
    canInstallReplacementWebApp: fn(() => false),
    onInstalled: h.event('management.onInstalled'),
    onUninstalled: h.event('management.onUninstalled'),
    onEnabled: h.event('management.onEnabled'),
    onDisabled: h.event('management.onDisabled'),
  };
}
