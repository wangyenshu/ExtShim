// Which optional API module an extension needs (pure data, read by the CLI to keep bundles small).
export const OPTIONAL_MODULES = {
  'dom-api.js': { always: true },
  'browser-data.js': { perms: ['bookmarks', 'history', 'topSites', 'sessions', 'readingList', 'tabGroups', 'contextualIdentities', 'search'] },
  'settings.js': { perms: ['privacy', 'proxy', 'browserSettings', 'accessibilityFeatures.read', 'accessibilityFeatures.modify', 'contentSettings', 'fontSettings'] },
  'network-apis.js': {
    perms: ['webRequest', 'webRequestBlocking', 'webRequestAuthProvider', 'webRequestFilterResponse', 'declarativeNetRequest', 'declarativeNetRequestWithHostAccess',
      'declarativeNetRequestFeedback', 'declarativeWebRequest', 'cookies', 'browsingData', 'dns', 'networkStatus'],
    keys: ['declarative_net_request'],
  },
  'page-apis.js': {
    perms: ['declarativeContent', 'userScripts', 'find', 'theme', 'pageCapture', 'tabCapture', 'desktopCapture', 'power', 'system.cpu', 'system.memory',
      'system.storage', 'system.display', 'clipboardWrite', 'captivePortal', 'printing', 'printingMetrics', 'printerProvider', 'publicSuffix', 'systemLog'],
    keys: ['browser_specific_settings', 'applications'],
  },
  'platform-apis.js': {
    perms: ['identity', 'gcm', 'ttsEngine', 'webAuthenticationProxy', 'mimeHandler', 'telemetry', 'geckoProfiler', 'normandyAddonStudy', 'pkcs11', 'urlbar',
      'activityLog', 'audio', 'certificateProvider', 'documentScan', 'enterprise.deviceAttributes', 'enterprise.hardwarePlatform', 'enterprise.networkingAttributes',
      'enterprise.platformKeys', 'enterprise.login', 'fileBrowserHandler', 'fileSystemProvider', 'input', 'loginState', 'platformKeys', 'vpnProvider', 'wallpaper'],
    keys: ['tts_engine'],
  },
  'devtools-apis.js': { perms: ['debugger'], keys: ['devtools_page'] },
};

/** File names of the optional modules a manifest needs. */
export function modulesFor(manifest) {
  const perms = new Set([...(manifest.permissions || []), ...(manifest.optional_permissions || [])].filter((p) => typeof p === 'string'));
  return Object.entries(OPTIONAL_MODULES).filter(([, m]) => m.always || (m.perms || []).some((p) => perms.has(p)) || (m.keys || []).some((k) => manifest[k] != null)).map(([f]) => f);
}
