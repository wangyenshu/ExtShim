// Settings APIs (types.ChromeSetting / ContentSetting): privacy, proxy, browserSettings,
// accessibilityFeatures, contentSettings, fontSettings. Values are kept per extension and
// returned with the right levelOfControl; they do not change the real browser.
import { defineNamespace } from './registry.js';

/** A types.ChromeSetting object persisted under `key`. */
export function chromeSetting(h, key, def) {
  const { ext, fn } = h;
  const internal = ext.storage.internal();
  const sk = 'setting:' + key;
  const evKey = 'setting.' + key + '.onChange';
  const current = () => (sk in internal.data ? internal.data[sk] : undefined);
  const details = () => {
    const v = current();
    return { value: v === undefined ? JSON.parse(JSON.stringify(def)) : v, levelOfControl: v === undefined ? 'controllable_by_this_extension' : 'controlled_by_this_extension', incognitoSpecific: false };
  };
  return {
    get: fn(() => details()),
    set: fn(async (d = {}) => {
      if (!('value' in d)) throw new TypeError("Error in invocation of types.ChromeSetting.set: missing 'value'.");
      if (def !== null && typeof def !== 'object' && typeof d.value !== typeof def) throw new Error(`Invalid value for setting: expected ${typeof def}.`);
      await internal.set({ [sk]: d.value });
      ext.dispatch(evKey, () => [details()]);
    }),
    clear: fn(async () => {
      await internal.remove(sk);
      ext.dispatch(evKey, () => [details()]);
    }),
    onChange: h.event(evKey),
  };
}

function group(h, prefix, defaults) {
  const o = {};
  for (const [k, v] of Object.entries(defaults)) o[k] = chromeSetting(h, `${prefix}.${k}`, v);
  return o;
}

export const PRIVACY = {
  network: { networkPredictionEnabled: true, webRTCIPHandlingPolicy: 'default', peerConnectionEnabled: true, tlsVersionRestriction: { minimum: 'TLSv1.2', maximum: 'TLSv1.3' }, httpsOnlyMode: 'never', globalPrivacyControl: false },
  services: {
    alternateErrorPagesEnabled: true, autofillAddressEnabled: true, autofillCreditCardEnabled: true, autofillEnabled: true, passwordSavingEnabled: true,
    safeBrowsingEnabled: true, safeBrowsingExtendedReportingEnabled: false, searchSuggestEnabled: true, spellingServiceEnabled: false, translationServiceEnabled: true,
  },
  websites: {
    adMeasurementEnabled: true, doNotTrackEnabled: false, fledgeEnabled: true, hyperlinkAuditingEnabled: true, protectedContentEnabled: true, referrersEnabled: true,
    thirdPartyCookiesAllowed: true, topicsEnabled: true, relatedWebsiteSetsEnabled: true, resistFingerprinting: false, firstPartyIsolate: false,
    trackingProtectionMode: 'private_browsing', cookieConfig: { behavior: 'reject_trackers', nonPersistentCookies: false },
  },
};

export const BROWSER_SETTINGS = {
  allowPopupsForUserEvents: true, cacheEnabled: true, closeTabsByDoubleClick: false, contextMenuShowEvent: 'mouseup', ftpProtocolEnabled: false,
  homepageOverride: 'about:home', imageAnimationBehavior: 'normal', newTabPageOverride: 'about:newtab', newTabPosition: 'afterCurrent',
  openBookmarksInNewTabs: false, openSearchResultsInNewTabs: false, openUrlbarResultsInNewTabs: false, webNotificationsDisabled: false,
  overrideDocumentColors: 'high-contrast-only', overrideContentColorScheme: 'auto', useDocumentFonts: true, zoomFullPage: true, zoomSiteSpecific: true, verticalTabs: false,
};

export const ACCESSIBILITY = {
  animationPolicy: 'allowed', autoclick: false, caretHighlight: false, cursorColor: false, cursorHighlight: false, dictation: false, dockedMagnifier: false,
  focusHighlight: false, highContrast: false, largeCursor: false, screenMagnifier: false, selectToSpeak: false, spokenFeedback: false, stickyKeys: false,
  switchAccess: false, virtualKeyboard: false,
};

export function privacyApi(h) {
  const out = {};
  for (const [g, defs] of Object.entries(PRIVACY)) out[g] = group(h, 'privacy.' + g, defs);
  return out;
}

export function proxyApi(h) {
  return {
    settings: chromeSetting(h, 'proxy.settings', { mode: 'system' }),
    onProxyError: h.event('proxy.onProxyError'),
    onError: h.event('proxy.onError'),
    onRequest: h.event('proxy.onRequest'),
  };
}

export function browserSettingsApi(h) {
  const out = group(h, 'browserSettings', BROWSER_SETTINGS);
  out.colorManagement = group(h, 'browserSettings.colorManagement', { mode: 'full', useNativeSRGB: false, useWebRenderCompositor: true });
  return out;
}

export function accessibilityFeaturesApi(h) {
  const out = group(h, 'accessibilityFeatures', ACCESSIBILITY);
  // Mirror the user's real "reduce motion" preference in animationPolicy's default.
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) out.animationPolicy = chromeSetting(h, 'accessibilityFeatures.animationPolicy', 'none'); } catch { /* ignore */ }
  return out;
}

// ------------------------------------------------------------------ contentSettings

const CONTENT_DEFAULTS = {
  automaticDownloads: 'ask', autoVerify: 'allow', camera: 'ask', clipboard: 'ask', cookies: 'allow', fullscreen: 'allow', images: 'allow',
  javascript: 'allow', location: 'ask', microphone: 'ask', mouselock: 'allow', notifications: 'ask', plugins: 'block', popups: 'block',
  sound: 'allow', unsandboxedPlugins: 'ask',
};

/** Content setting patterns: "<all_urls>", "[*.]example.com", "https://*:443/*", "*://example.com/*". */
export function contentPatternToRegExp(p) {
  if (p === '<all_urls>') return /^/;
  const m = /^(?:(\*|[a-z][a-z0-9+.-]*):\/\/)?(\[\*\.\])?([^/:]*)(?::(\*|\d+))?(\/.*)?$/i.exec(p);
  if (!m) throw new Error(`The pattern "${p}" is invalid.`);
  const [, scheme, sub, host, port, path] = m;
  const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const sch = !scheme || scheme === '*' ? '(?:https?|wss?)' : esc(scheme);
  const hst = host === '*' ? '[^/:]*' : (sub ? '(?:[^/:]*\\.)?' : '') + esc(host);
  const prt = port && port !== '*' ? ':' + port : '(?::\\d+)?';
  return new RegExp(`^${sch}:\\/\\/${hst}${prt}${path ? esc(path) : '(?:\\/.*)?'}$`, 'i');
}

function contentSetting(h, type) {
  const { ext, fn } = h;
  const internal = ext.storage.internal();
  const sk = 'contentSetting:' + type;
  const rules = () => internal.data[sk] || [];
  return {
    get: fn((d = {}) => {
      if (!d.primaryUrl) throw new TypeError('Error in invocation of contentSettings.ContentSetting.get: primaryUrl is required.');
      for (const r of [...rules()].reverse()) {
        if (r.incognito && !d.incognito) continue;
        if ((r.resourceIdentifier || null) !== ((d.resourceIdentifier && d.resourceIdentifier.id) || null)) continue;
        if (contentPatternToRegExp(r.primaryPattern).test(d.primaryUrl) && (!r.secondaryPattern || !d.secondaryUrl || contentPatternToRegExp(r.secondaryPattern).test(d.secondaryUrl))) return { setting: r.setting };
      }
      return { setting: CONTENT_DEFAULTS[type] };
    }),
    set: fn(async (d = {}) => {
      contentPatternToRegExp(d.primaryPattern);
      if (d.secondaryPattern) contentPatternToRegExp(d.secondaryPattern);
      const list = rules().filter((r) => !(r.primaryPattern === d.primaryPattern && (r.secondaryPattern || '') === (d.secondaryPattern || '')));
      list.push({ primaryPattern: d.primaryPattern, secondaryPattern: d.secondaryPattern || '', setting: d.setting, resourceIdentifier: (d.resourceIdentifier && d.resourceIdentifier.id) || null, incognito: d.scope === 'incognito_session_only' });
      await internal.set({ [sk]: list });
      ext.dispatch(`contentSetting.${type}.onChange`, [{}]);
    }),
    clear: fn(async (d = {}) => {
      await internal.set({ [sk]: d.scope === 'incognito_session_only' ? rules().filter((r) => !r.incognito) : [] });
      ext.dispatch(`contentSetting.${type}.onChange`, [{}]);
    }),
    getResourceIdentifiers: fn(() => []),
    onChange: h.event(`contentSetting.${type}.onChange`),
  };
}

export function contentSettingsApi(h) {
  const out = {};
  for (const t of Object.keys(CONTENT_DEFAULTS)) out[t] = contentSetting(h, t);
  return out;
}

// ------------------------------------------------------------------ fontSettings

const FONT_DEFAULTS = { standard: 'Times New Roman', sansserif: 'Arial', serif: 'Times New Roman', fixed: 'Courier New', cursive: 'Comic Sans MS', fantasy: 'Impact', math: 'Cambria Math' };
const COMMON_FONTS = ['Arial', 'Arial Black', 'Avenir', 'Cambria', 'Cambria Math', 'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia', 'Helvetica', 'Helvetica Neue',
  'Impact', 'Inter', 'Lucida Console', 'Menlo', 'Monaco', 'Noto Sans', 'Noto Serif', 'Roboto', 'Roboto Mono', 'Segoe UI', 'SF Pro Text', 'Tahoma', 'Times New Roman',
  'Trebuchet MS', 'Ubuntu', 'Verdana', 'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono', 'Liberation Sans', 'Liberation Serif', 'Liberation Mono'];

export function fontSettingsApi(h) {
  const { ext, fn } = h;
  const internal = ext.storage.internal();
  const key = (d) => `font:${d.genericFamily}:${d.script || 'Zyyy'}`;
  const level = (k) => (k in internal.data ? 'controlled_by_this_extension' : 'controllable_by_this_extension');
  const size = (name, def) => ({
    [`get${name}`]: fn(() => ({ pixelSize: internal.data['font:' + name] ?? def, levelOfControl: level('font:' + name) })),
    [`set${name}`]: fn(async (d = {}) => { await internal.set({ ['font:' + name]: d.pixelSize }); ext.dispatch(`fontSettings.on${name}Changed`, [{ pixelSize: d.pixelSize, levelOfControl: 'controlled_by_this_extension' }]); }),
    [`clear${name}`]: fn(async () => { await internal.remove('font:' + name); ext.dispatch(`fontSettings.on${name}Changed`, [{ pixelSize: def, levelOfControl: 'controllable_by_this_extension' }]); }),
    [`on${name}Changed`]: h.event(`fontSettings.on${name}Changed`),
  });
  return {
    getFont: fn((d = {}) => ({ fontId: internal.data[key(d)] ?? FONT_DEFAULTS[d.genericFamily] ?? '', levelOfControl: level(key(d)) })),
    setFont: fn(async (d = {}) => {
      await internal.set({ [key(d)]: d.fontId });
      ext.dispatch('fontSettings.onFontChanged', [{ fontId: d.fontId, genericFamily: d.genericFamily, script: d.script, levelOfControl: 'controlled_by_this_extension' }]);
    }),
    clearFont: fn(async (d = {}) => {
      await internal.remove(key(d));
      ext.dispatch('fontSettings.onFontChanged', [{ fontId: FONT_DEFAULTS[d.genericFamily] || '', genericFamily: d.genericFamily, script: d.script, levelOfControl: 'controllable_by_this_extension' }]);
    }),
    getFontList: fn(async () => {
      let names = COMMON_FONTS;
      try { if (document.fonts && document.fonts.check) names = COMMON_FONTS.filter((f) => document.fonts.check(`12px "${f}"`)); } catch { /* ignore */ }
      return names.map((f) => ({ fontId: f, displayName: f }));
    }),
    ...size('DefaultFontSize', 16),
    ...size('DefaultFixedFontSize', 13),
    ...size('MinimumFontSize', 0),
    onFontChanged: h.event('fontSettings.onFontChanged'),
  };
}

defineNamespace('privacy', privacyApi, { perms: ['privacy'] });
defineNamespace('proxy', proxyApi, { perms: ['proxy'] });
defineNamespace('browserSettings', browserSettingsApi, { perms: ['browserSettings'] });
defineNamespace('accessibilityFeatures', accessibilityFeaturesApi, { perms: ['accessibilityFeatures.read', 'accessibilityFeatures.modify'] });
defineNamespace('contentSettings', contentSettingsApi, { perms: ['contentSettings'] });
defineNamespace('fontSettings', fontSettingsApi, { perms: ['fontSettings'] });
