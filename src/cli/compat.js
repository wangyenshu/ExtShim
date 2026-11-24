// Static compatibility report: APIs an extension uses and the page-specific limitations that apply.

export const NOTES = {
  webRequest: "applies to the page's fetch, XHR, sendBeacon, WebSocket, script-set resource URLs and links; parser-loaded resources are reported, not blocked",
  declarativeNetRequest: "applies to the page's fetch, XHR, sendBeacon, WebSocket, script-set resource URLs and links; parser-loaded resources are not blocked",
  cookies: 'current site only; HttpOnly cookies are not accessible',
  browsingData: 'current site only',
  history: "per-extension record of pages the extension ran on; not the browser's history",
  bookmarks: "per-extension bookmark tree; not the browser's bookmarks",
  topSites: 'derived from the per-extension history',
  sessions: 'per-extension record of closed pages and extension tabs',
  readingList: 'per-extension list',
  tabGroups: "groups the page and the extension's tabs",
  privacy: 'values are stored; no effect on the browser',
  proxy: 'values are stored; requests are not proxied',
  contentSettings: 'values are stored; no effect on the browser',
  fontSettings: 'values are stored; no effect on the browser',
  browserSettings: 'values are stored; no effect on the browser',
  accessibilityFeatures: 'values are stored; no effect on the system',
  tabCapture: 'uses getDisplayMedia (sharing prompt, requires a recent user gesture)',
  desktopCapture: 'uses getDisplayMedia (sharing prompt, requires a recent user gesture)',
  debugger: "supports Runtime.evaluate, DOM.*, Input.*, Page.navigate/reload/captureScreenshot, Network.*; other methods fail with \"'<method>' wasn't found\"",
  devtools: 'panels open in an in-page drawer',
  identity: "launchWebAuthFlow requires a redirect URL on the page's origin (identity.redirectUrl option); getAuthToken requires the identity.getAuthToken option",
  gcm: 'registration works; messages are not delivered',
  dns: 'resolved over DNS-over-HTTPS (dnsResolver option; default Cloudflare)',
  omnibox: 'keyword input is an in-page palette (toolbar button menu)',
  audio: 'lists real devices; level and mute are recorded only',
  webAuthenticationProxy: "proxies the page's navigator.credentials",
  input: "input.ime acts on the page's text fields",
  platformKeys: "no client certificates; subtleCrypto is the page's WebCrypto",
  enterprise: 'behaves as an unmanaged device',
  certificateProvider: 'ChromeOS only; no smart cards',
  documentScan: 'ChromeOS only; no scanners',
  fileSystemProvider: 'ChromeOS only; mounts are recorded, not shown',
  vpnProvider: 'ChromeOS only; no tunnel is created',
  wallpaper: 'ChromeOS only; setWallpaper fails',
  loginState: 'ChromeOS only; reports a user session',
  printing: "jobs go to the browser's print dialog",
  printerProvider: 'events never fire',
  telemetry: 'calls are discarded',
  geckoProfiler: 'profiles are empty',
  pkcs11: 'no modules are installed',
  mimeHandler: 'the page is never a MIME handler view',
};
const PARTIAL_MEMBERS = {
  'tabs.captureVisibleTab': 'uses getDisplayMedia (sharing prompt)',
  'runtime.connectNative': 'requires the nativeMessaging option',
  'runtime.sendNativeMessage': 'requires the nativeMessaging option',
};

export function compatReport(manifest, files) {
  const used = new Map();
  const re = /\b(?:chrome|browser)\s*\.\s*([a-zA-Z]+)(?:\s*\.\s*([a-zA-Z]+))?/g;
  for (const [p, data] of files) {
    if (!/\.(m?js|cjs|html?)$/i.test(p)) continue;
    const t = new TextDecoder().decode(data);
    let m;
    while ((m = re.exec(t))) {
      const key = m[2] ? `${m[1]}.${m[2]}` : m[1];
      if (!used.has(key)) used.set(key, new Set());
      used.get(key).add(p);
    }
  }
  const namespaces = new Set([...used.keys()].map((k) => k.split('.')[0]));
  for (const p of manifest.permissions || []) if (typeof p === 'string') namespaces.add(p.split('.')[0].replace(/^(webRequestBlocking|webRequestAuthProvider)$/, 'webRequest').replace(/^declarativeNetRequest\w+$/, 'declarativeNetRequest'));
  const warnings = [];
  const limited = [...namespaces].filter((n) => NOTES[n]).sort();
  for (const n of limited) warnings.push(`chrome.${n}: ${NOTES[n]}.`);
  for (const [k, why] of Object.entries(PARTIAL_MEMBERS)) if (used.has(k)) warnings.push(`chrome.${k}: ${why}.`);
  if (manifest.chrome_url_overrides) warnings.push('chrome_url_overrides: browser pages are not replaced.');
  if (manifest.externally_connectable) warnings.push('externally_connectable: web pages cannot message the extension.');
  const perms = (manifest.permissions || []).concat(manifest.host_permissions || []);
  if (perms.some((p) => p === '<all_urls>' || /:\/\//.test(p))) {
    warnings.push('host_permissions: cross-origin requests are subject to CORS, except in the userscript build or with the corsProxy option.');
  }
  const cs = manifest.content_scripts || [];
  if (cs.some((c) => c.all_frames)) warnings.push('all_frames: same-origin frames only.');
  return { used: [...used.keys()].sort(), namespaces: [...namespaces].sort(), limited, unsupported: [], warnings };
}
