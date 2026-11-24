// Platform APIs: identity, gcm, instanceID, ttsEngine, webAuthenticationProxy, mimeHandler,
// Firefox's privileged namespaces, and ChromeOS-only namespaces (audio, input.ime, enterprise.*,
// platformKeys, ...). Where the browser feature exists on the web platform it is used for real
// (audio devices, WebCrypto, WebAuthn, focus/typing in the page); otherwise the API behaves like a
// device with nothing attached.
import { defineNamespace, defineStartup } from './registry.js';

const rid = (n = 22) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[b & 63]).join('');

// ------------------------------------------------------------------ identity

export function identityApi(h) {
  const { ext, fn } = h;
  const cfg = () => ext.options.identity || {};
  const redirect = (path = '') => (cfg().redirectUrl ? cfg().redirectUrl.replace(/\/?$/, '/') : `https://${ext.id}.chromiumapp.org/`) + String(path).replace(/^\//, '');
  return {
    getRedirectURL: (path) => redirect(path),
    launchWebAuthFlow: fn((d = {}) => new Promise((resolve, reject) => {
      const base = redirect();
      const w = window.open(d.url, 'extshim-auth-' + ext.id, 'popup,width=520,height=680');
      if (!w) { reject(new Error('Authorization page could not be loaded.')); return; }
      const started = Date.now();
      const timeout = d.interactive === false && d.timeoutMsForNonInteractive ? d.timeoutMsForNonInteractive : 10 * 60 * 1000;
      const t = setInterval(() => {
        let href = null;
        try { href = w.location.href; } catch { /* cross-origin: still on the provider */ }
        if (href && href.startsWith(base)) { clearInterval(t); w.close(); resolve(href); return; }
        if (w.closed) { clearInterval(t); reject(new Error('The user did not approve access.')); return; }
        if (Date.now() - started > timeout) { clearInterval(t); w.close(); reject(new Error('Authorization page could not be loaded.')); }
      }, 250);
    })),
    getAuthToken: fn(async (d = {}) => {
      if (typeof cfg().getAuthToken === 'function') {
        const r = await cfg().getAuthToken(d);
        return typeof r === 'string' ? { token: r, grantedScopes: d.scopes || [] } : r;
      }
      throw new Error('OAuth2 not granted or revoked.');
    }),
    removeCachedAuthToken: fn(() => {}),
    clearAllCachedAuthTokens: fn(() => {}),
    getProfileUserInfo: fn(() => ({ email: (cfg().profile && cfg().profile.email) || '', id: (cfg().profile && cfg().profile.id) || '' })),
    getAccounts: fn(() => (cfg().profile ? [{ id: cfg().profile.id || '' }] : [])),
    onSignInChanged: h.event('identity.onSignInChanged'),
  };
}

// ------------------------------------------------------------------ gcm / instanceID

function idStore(ext) {
  const internal = ext.storage.internal();
  return {
    get: (k) => internal.data['iid:' + k],
    set: (k, v) => internal.set({ ['iid:' + k]: v }),
    remove: (k) => internal.remove('iid:' + k),
  };
}

export function gcmApi(h) {
  const { ext, fn } = h;
  const s = idStore(ext);
  return {
    MAX_MESSAGE_SIZE: 4096,
    register: fn(async (senderIds = []) => {
      if (!senderIds.length) throw new Error('At least one sender ID is required.');
      let t = s.get('gcm');
      if (!t) { t = rid(11) + ':' + rid(140); await s.set('gcm', t); }
      return t;
    }),
    unregister: fn(() => s.remove('gcm')),
    send: fn((m = {}) => {
      if (JSON.stringify(m.data || {}).length > 4096) throw new Error('Message is too large.');
      return m.messageId;
    }),
    onMessage: h.event('gcm.onMessage'), onMessagesDeleted: h.event('gcm.onMessagesDeleted'), onSendError: h.event('gcm.onSendError'),
  };
}

export function instanceIDApi(h) {
  const { ext, fn } = h;
  const s = idStore(ext);
  const ensure = async () => {
    let id = s.get('id');
    if (!id) { id = rid(11); await s.set('id', id); await s.set('created', Date.now()); }
    return id;
  };
  return {
    getID: fn(ensure),
    getCreationTime: fn(async () => { await ensure(); return s.get('created'); }),
    getToken: fn(async (o = {}) => {
      await ensure();
      const key = `token:${o.authorizedEntity}:${o.scope}`;
      let t = s.get(key);
      if (!t) { t = (await ensure()) + ':' + rid(140); await s.set(key, t); }
      return t;
    }),
    deleteToken: fn((o = {}) => s.remove(`token:${o.authorizedEntity}:${o.scope}`)),
    deleteID: fn(async () => { for (const k of Object.keys(ext.storage.internal().data)) if (k.startsWith('iid:')) await ext.storage.internal().remove(k); }),
    onTokenRefresh: h.event('instanceID.onTokenRefresh'),
  };
}

// ------------------------------------------------------------------ ttsEngine

/** Voices this extension provides; tts.speak() routes matching utterances to ttsEngine.onSpeak. */
export function engineVoices(ext) {
  return ext.shared('ttsEngineVoices', () => ((ext.manifest.tts_engine && ext.manifest.tts_engine.voices) || []).map((v) => ({
    voiceName: v.voice_name, lang: v.lang, eventTypes: v.event_types || [], remote: !!v.remote, extensionId: ext.id,
  })));
}

export function ttsEngineApi(h) {
  const { ext } = h;
  const evs = {};
  for (const e of ['onSpeak', 'onSpeakWithAudioStream', 'onStop', 'onPause', 'onResume', 'onInstallLanguageRequest', 'onLanguageStatusRequest', 'onUninstallLanguageRequest']) evs[e] = h.event('ttsEngine.' + e);
  return {
    updateVoices: (voices = []) => { const list = engineVoices(ext); list.splice(0, list.length, ...voices.map((v) => ({ ...v, extensionId: ext.id }))); ext.dispatch('tts.onVoicesChanged', []); },
    updateLanguage: (status) => ext.dispatch('ttsEngine.onLanguageStatusUpdate', [status]),
    sendTtsEvent: (requestId, event) => { const r = ext.state.ttsRequests && ext.state.ttsRequests.get(requestId); if (r) r(event); },
    sendTtsAudio: () => {},
    ...evs,
  };
}

// ------------------------------------------------------------------ webAuthenticationProxy

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)).buffer;
function toJSONish(v) {
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return b64u(v);
  if (Array.isArray(v)) return v.map(toJSONish);
  if (v && typeof v === 'object') { const o = {}; for (const k in v) if (v[k] !== undefined && typeof v[k] !== 'function' && !(v[k] instanceof AbortSignal)) o[k] = toJSONish(v[k]); return o; }
  return v;
}
function credentialFromJSON(j) {
  const r = j.response || {};
  const response = {};
  for (const k of ['clientDataJSON', 'attestationObject', 'authenticatorData', 'signature', 'userHandle', 'publicKey']) if (r[k]) response[k] = unb64u(r[k]);
  response.getTransports = () => r.transports || [];
  response.getPublicKeyAlgorithm = () => r.publicKeyAlgorithm;
  response.getPublicKey = () => (r.publicKey ? unb64u(r.publicKey) : null);
  response.getAuthenticatorData = () => (r.authenticatorData ? unb64u(r.authenticatorData) : null);
  return { id: j.id, rawId: unb64u(j.rawId || j.id), type: 'public-key', authenticatorAttachment: j.authenticatorAttachment || null, response, getClientExtensionResults: () => j.clientExtensionResults || {}, toJSON: () => j };
}

export function webAuthenticationProxyApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('webauthnProxy', () => ({ attached: false, pending: new Map(), orig: null, n: 1, dispose() { this.restore && this.restore(); } }));
  const request = (event, details) => new Promise((resolve, reject) => {
    const requestId = st.n++;
    st.pending.set(requestId, { resolve, reject });
    ext.dispatch('webAuthenticationProxy.' + event, () => [{ requestId, ...details }]);
  });
  return {
    attach: fn(() => {
      if (st.attached) throw new Error('Another extension is already attached.');
      if (!navigator.credentials) throw new Error('WebAuthn is not available on this page.');
      st.attached = true;
      const c = navigator.credentials;
      const orig = { create: c.create.bind(c), get: c.get.bind(c), uvpaa: window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable };
      c.create = (opts = {}) => (opts.publicKey ? request('onCreateRequest', { requestDetailsJson: JSON.stringify(toJSONish(opts.publicKey)) }) : orig.create(opts));
      c.get = (opts = {}) => (opts.publicKey ? request('onGetRequest', { requestDetailsJson: JSON.stringify(toJSONish(opts.publicKey)) }) : orig.get(opts));
      if (orig.uvpaa) PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = () => request('onIsUvpaaRequest', {});
      st.restore = () => { c.create = orig.create; c.get = orig.get; if (orig.uvpaa) PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable = orig.uvpaa; st.attached = false; };
    }),
    detach: fn(() => { if (st.restore) st.restore(); for (const [id, p] of st.pending) { p.reject(new DOMException('The operation either timed out or was not allowed.', 'NotAllowedError')); ext.dispatch('webAuthenticationProxy.onRequestCanceled', [id]); } st.pending.clear(); }),
    completeCreateRequest: fn((d = {}) => {
      const p = st.pending.get(d.requestId);
      if (!p) throw new Error('Invalid requestId.');
      st.pending.delete(d.requestId);
      if (d.error) p.reject(new DOMException(d.error.message || 'error', d.error.name || 'NotAllowedError'));
      else p.resolve(credentialFromJSON(JSON.parse(d.responseJson)));
    }),
    completeGetRequest: fn((d = {}) => {
      const p = st.pending.get(d.requestId);
      if (!p) throw new Error('Invalid requestId.');
      st.pending.delete(d.requestId);
      if (d.error) p.reject(new DOMException(d.error.message || 'error', d.error.name || 'NotAllowedError'));
      else p.resolve(credentialFromJSON(JSON.parse(d.responseJson)));
    }),
    completeIsUvpaaRequest: fn((d = {}) => {
      const p = st.pending.get(d.requestId);
      if (!p) throw new Error('Invalid requestId.');
      st.pending.delete(d.requestId);
      p.resolve(!!d.isUvpaa);
    }),
    onCreateRequest: h.event('webAuthenticationProxy.onCreateRequest'), onGetRequest: h.event('webAuthenticationProxy.onGetRequest'),
    onIsUvpaaRequest: h.event('webAuthenticationProxy.onIsUvpaaRequest'), onRemoteSessionStateChange: h.event('webAuthenticationProxy.onRemoteSessionStateChange'),
    onRequestCanceled: h.event('webAuthenticationProxy.onRequestCanceled'),
  };
}

export function mimeHandlerApi(h) {
  const { fn } = h;
  return {
    getStreamInfo: fn(() => { throw new Error('This page is not a MIME handler view.'); }),
    abortAndFallbackToNativeHandler: fn(() => {}),
    getMimeHandlerOptions: fn(() => ({})),
    setMimeHandlerOptions: fn(() => {}),
  };
}

// ------------------------------------------------------------------ Firefox privileged namespaces

export function telemetryApi(h) {
  const noop = h.fn(() => {});
  return {
    submitPing: noop, submitEncryptedPing: noop, canUpload: h.fn(() => false), scalarAdd: noop, scalarSet: noop, scalarSetMaximum: noop,
    keyedScalarAdd: noop, keyedScalarSet: noop, keyedScalarSetMaximum: noop, recordEvent: noop, registerScalars: noop, registerEvents: noop, setEventRecordingEnabled: noop,
  };
}

export function geckoProfilerApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('profiler', () => ({ running: false, start: 0 }));
  const profile = () => ({ meta: { version: 27, startTime: st.start, interval: 1, product: 'ExtShim', platform: navigator.platform }, threads: [], libs: [], processes: [], pausedRanges: [] });
  return {
    start: fn(() => { st.running = true; st.start = Date.now(); ext.dispatch('geckoProfiler.onRunning', [true]); }),
    stop: fn(() => { st.running = false; ext.dispatch('geckoProfiler.onRunning', [false]); }),
    pause: fn(() => {}), resume: fn(() => {}),
    getProfile: fn(() => profile()),
    getProfileAsArrayBuffer: fn(() => new TextEncoder().encode(JSON.stringify(profile())).buffer),
    getProfileAsGzippedArrayBuffer: fn(async () => new Response(new Blob([JSON.stringify(profile())]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()),
    dumpProfileToFile: fn((name) => { const a = document.createElement('a'); a.download = name || 'profile.json'; a.href = URL.createObjectURL(new Blob([JSON.stringify(profile())])); a.click(); }),
    getSymbols: fn(() => [new Uint32Array(0), new Uint32Array(0), new Uint8Array(0)]),
    onRunning: h.event('geckoProfiler.onRunning'),
  };
}

export function normandyAddonStudyApi(h) {
  const { fn } = h;
  return {
    getStudy: fn(() => undefined), endStudy: fn(() => {}),
    getClientMetadata: fn(() => ({ updateChannel: 'release', fxVersion: '', clientID: '' })),
    onUnenroll: h.event('normandyAddonStudy.onUnenroll'),
  };
}

export function pkcs11Api(h) {
  const { fn } = h;
  return {
    isModuleInstalled: fn(() => false),
    installModule: fn((name) => { throw new Error(`No such PKCS#11 module ${name}`); }),
    uninstallModule: fn((name) => { throw new Error(`No such PKCS#11 module ${name}`); }),
    getModuleSlots: fn((name) => { throw new Error(`No such PKCS#11 module ${name}`); }),
  };
}

export function urlbarApi(h) {
  const { ext, fn } = h;
  return {
    closeView: fn(() => {}), focus: fn(() => {}),
    search: fn((s) => { if (ext.state.omnibox) ext.state.omnibox.open(); void s; }),
    engagementTelemetry: { get: fn(() => ({ value: false, levelOfControl: 'not_controllable' })), set: fn(() => {}), clear: fn(() => {}), onChange: h.event('urlbar.engagementTelemetry.onChange') },
    onBehaviorRequested: h.event('urlbar.onBehaviorRequested'), onEngagement: h.event('urlbar.onEngagement'), onQueryCanceled: h.event('urlbar.onQueryCanceled'),
    onResultsRequested: h.event('urlbar.onResultsRequested'), onResultPicked: h.event('urlbar.onResultPicked'),
  };
}

export function activityLogApi(h) { return { onExtensionActivity: h.event('activityLog.onExtensionActivity') }; }

// ------------------------------------------------------------------ ChromeOS-only namespaces

export function audioApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('audio', () => {
    const s = { mute: { INPUT: false, OUTPUT: false }, levels: {}, active: new Set() };
    const changed = async () => ext.dispatch('audio.onDeviceListChanged', [await devices()]);
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', changed);
    s.dispose = () => navigator.mediaDevices && navigator.mediaDevices.removeEventListener && navigator.mediaDevices.removeEventListener('devicechange', changed);
    return s;
  });
  const devices = async () => {
    let list = [];
    try { list = await navigator.mediaDevices.enumerateDevices(); } catch { /* ignore */ }
    return list.filter((d) => d.kind === 'audioinput' || d.kind === 'audiooutput').map((d, i) => ({
      id: d.deviceId || String(i), stableDeviceId: d.groupId || d.deviceId, streamType: d.kind === 'audioinput' ? 'INPUT' : 'OUTPUT',
      deviceType: d.kind === 'audioinput' ? 'MIC' : 'HEADPHONE', displayName: d.label || (d.kind === 'audioinput' ? 'Microphone' : 'Speaker'),
      deviceName: d.label || d.kind, isActive: d.deviceId === 'default' || st.active.has(d.deviceId), level: st.levels[d.deviceId] ?? 50,
    }));
  };
  return {
    getDevices: fn(async (f = {}) => (await devices()).filter((d) => (!f.streamTypes || f.streamTypes.includes(d.streamType)) && (f.isActive == null || d.isActive === f.isActive))),
    getMute: fn((t) => !!st.mute[t]),
    setMute: fn((t, m) => { st.mute[t] = !!m; ext.dispatch('audio.onMuteChanged', [{ streamType: t, isMuted: !!m }]); }),
    setActiveDevices: fn((ids = {}) => { st.active = new Set([...(ids.input || []), ...(ids.output || [])]); }),
    setProperties: fn((id, p = {}) => { if (p.level != null) { st.levels[id] = p.level; ext.dispatch('audio.onLevelChanged', [{ deviceId: id, level: p.level }]); } }),
    onDeviceListChanged: h.event('audio.onDeviceListChanged'), onLevelChanged: h.event('audio.onLevelChanged'), onMuteChanged: h.event('audio.onMuteChanged'),
  };
}

export function certificateProviderApi(h) {
  const { fn } = h;
  return {
    setCertificates: fn(() => {}), reportSignature: fn(() => {}), stopPinRequest: fn(() => {}),
    requestPin: fn(() => ({ userInput: '' })),
    onCertificatesUpdateRequested: h.event('certificateProvider.onCertificatesUpdateRequested'), onSignatureRequested: h.event('certificateProvider.onSignatureRequested'),
    onCertificatesRequested: h.event('certificateProvider.onCertificatesRequested'), onSignDigestRequested: h.event('certificateProvider.onSignDigestRequested'),
  };
}

export function documentScanApi(h) {
  const { fn } = h;
  const none = { result: 'NO_SUCH_SCANNER' };
  return {
    getScannerList: fn(() => ({ result: 'SUCCESS', scanners: [] })),
    scan: fn(() => { throw new Error('No scanners are available.'); }),
    openScanner: fn((id) => ({ ...none, scannerId: id })), closeScanner: fn((h2) => ({ ...none, scannerHandle: h2 })),
    getOptionGroups: fn((h2) => ({ ...none, scannerHandle: h2 })), setOptions: fn((h2) => ({ scannerHandle: h2, results: [] })),
    startScan: fn((h2) => ({ ...none, scannerHandle: h2 })), readScanData: fn((j) => ({ ...none, job: j })), cancelScan: fn((j) => ({ ...none, job: j })),
  };
}

export function enterpriseApis(h) {
  const { ext, fn } = h;
  const certs = ext.shared('enterpriseCerts', () => ({ user: [], system: [] }));
  const tokens = () => [{ id: 'user', subtleCrypto: crypto.subtle, softwareBackedSubtleCrypto: crypto.subtle }];
  return {
    deviceAttributes: {
      getDirectoryDeviceId: fn(() => ''), getDeviceSerialNumber: fn(() => ''), getDeviceAssetId: fn(() => ''),
      getDeviceAnnotatedLocation: fn(() => ''), getDeviceHostname: fn(() => location.hostname),
    },
    hardwarePlatform: {
      getHardwarePlatformInfo: fn(async () => {
        try {
          const hi = navigator.userAgentData ? await navigator.userAgentData.getHighEntropyValues(['model', 'platform']) : {};
          return { manufacturer: hi.platform || '', model: hi.model || '' };
        } catch { return { manufacturer: '', model: '' }; }
      }),
    },
    login: { exitCurrentManagedGuestSession: fn(() => { throw new Error('Not a managed guest session.'); }) },
    networkingAttributes: { getNetworkDetails: fn(() => { throw new Error('Network details are only available on managed devices.'); }) },
    platformKeys: {
      getTokens: fn(() => tokens()),
      getCertificates: fn((tokenId) => (certs[tokenId] || []).slice()),
      importCertificate: fn((tokenId, cert) => { (certs[tokenId] = certs[tokenId] || []).push(cert); }),
      removeCertificate: fn((tokenId, cert) => { certs[tokenId] = (certs[tokenId] || []).filter((c) => c !== cert); }),
      challengeKey: fn(() => { throw new Error('Key attestation is only available on managed ChromeOS devices.'); }),
      challengeMachineKey: fn(() => { throw new Error('Key attestation is only available on managed ChromeOS devices.'); }),
      challengeUserKey: fn(() => { throw new Error('Key attestation is only available on managed ChromeOS devices.'); }),
    },
  };
}

export function fileBrowserHandlerApi(h) { return { onExecute: h.event('fileBrowserHandler.onExecute') }; }

export function fileSystemProviderApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('fsp', () => ({ mounts: new Map() }));
  const out = {
    mount: fn((o = {}) => { if (st.mounts.has(o.fileSystemId)) throw new Error('EXISTS'); st.mounts.set(o.fileSystemId, { fileSystemId: o.fileSystemId, displayName: o.displayName, writable: !!o.writable, openedFilesLimit: o.openedFilesLimit || 0, openedFiles: [], supportsNotifyTag: !!o.supportsNotifyTag, watchers: [] }); }),
    unmount: fn((o = {}) => { if (!st.mounts.delete(o.fileSystemId)) throw new Error('NOT_FOUND'); }),
    get: fn((id) => { const m = st.mounts.get(id); if (!m) throw new Error('NOT_FOUND'); return { ...m }; }),
    getAll: fn(() => [...st.mounts.values()].map((m) => ({ ...m }))),
    notify: fn(() => {}),
  };
  for (const e of ['onAbortRequested', 'onAddWatcherRequested', 'onCloseFileRequested', 'onConfigureRequested', 'onCopyEntryRequested', 'onCreateDirectoryRequested', 'onCreateFileRequested', 'onDeleteEntryRequested', 'onExecuteActionRequested', 'onGetActionsRequested', 'onGetMetadataRequested', 'onMountRequested', 'onMoveEntryRequested', 'onOpenFileRequested', 'onReadDirectoryRequested', 'onReadFileRequested', 'onRemoveWatcherRequested', 'onTruncateRequested', 'onUnmountRequested', 'onWriteFileRequested']) out[e] = h.event('fileSystemProvider.' + e);
  return out;
}

/** input.ime drives text fields of the page: focus/blur events, commitText, composition, key events. */
export function inputImeApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('ime', () => {
    const s = { ctx: new Map(), next: 1, el: null };
    const editable = (el) => el && (el.isContentEditable || /^(input|textarea)$/i.test(el.localName));
    const onFocus = (e) => {
      const el = e.target;
      if (!editable(el)) return;
      const id = s.next++;
      s.ctx.set(id, el);
      s.el = el;
      el.__imeId = id;
      ext.dispatch('input.ime.onFocus', [{ contextID: id, type: el.type === 'password' ? 'password' : el.type === 'email' ? 'email' : el.type === 'url' ? 'url' : el.type === 'number' ? 'number' : el.type === 'tel' ? 'tel' : 'text', autoCorrect: true, autoComplete: true, autoCapitalize: 'off', spellCheck: el.spellcheck, shouldDoLearning: true }]);
    };
    const onBlur = (e) => { if (e.target.__imeId) { ext.dispatch('input.ime.onBlur', [e.target.__imeId]); s.ctx.delete(e.target.__imeId); } };
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('focusout', onBlur, true);
    s.dispose = () => { document.removeEventListener('focusin', onFocus, true); document.removeEventListener('focusout', onBlur, true); };
    return s;
  });
  const target = (id) => { const el = st.ctx.get(id); if (!el) throw new Error('Invalid context ID.'); el.focus(); return el; };
  const insert = (el, text) => { if (!document.execCommand('insertText', false, text) && 'value' in el) { el.setRangeText(text, el.selectionStart, el.selectionEnd, 'end'); el.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' })); } };
  const out = {
    commitText: fn((p = {}) => { insert(target(p.contextID), p.text); return true; }),
    setComposition: fn((p = {}) => { const el = target(p.contextID); el.dataset.extshimComposition = p.text; return true; }),
    clearComposition: fn((p = {}) => { const el = target(p.contextID); delete el.dataset.extshimComposition; return true; }),
    deleteSurroundingText: fn((p = {}) => { const el = target(p.contextID); if ('value' in el) { const s = el.selectionStart + p.offset; el.setRangeText('', Math.max(0, s), Math.max(0, s) + p.length, 'end'); } }),
    sendKeyEvents: fn((p = {}) => {
      const el = target(p.contextID);
      for (const k of p.keyData || []) {
        el.dispatchEvent(new KeyboardEvent(k.type === 'keyup' ? 'keyup' : 'keydown', { key: k.key, code: k.code, altKey: !!k.altKey, ctrlKey: !!k.ctrlKey, shiftKey: !!k.shiftKey, bubbles: true }));
        if (k.type !== 'keyup' && k.key && k.key.length === 1 && !k.ctrlKey && !k.altKey) insert(el, k.key);
      }
    }),
    keyEventHandled: () => {}, hideInputView: () => {},
    setCandidateWindowProperties: fn(() => true), setCandidates: fn(() => true), setCursorPosition: fn(() => true),
    setAssistiveWindowProperties: fn(() => true), setAssistiveWindowButtonHighlighted: fn(() => {}), setMenuItems: fn(() => {}), updateMenuItems: fn(() => {}),
  };
  for (const e of ['onBlur', 'onAssistiveWindowButtonClicked', 'onCandidateClicked', 'onKeyEvent', 'onDeactivated', 'onInputContextUpdate', 'onActivate', 'onFocus', 'onMenuItemActivated', 'onSurroundingTextChanged', 'onReset']) out[e] = h.event('input.ime.' + e);
  void st;
  return { ime: out };
}

export function loginStateApi(h) {
  return { getProfileType: h.fn(() => 'USER_PROFILE'), getSessionState: h.fn(() => 'IN_SESSION'), onSessionStateChanged: h.event('loginState.onSessionStateChanged') };
}

export function platformKeysApi(h) {
  const { fn } = h;
  return {
    selectClientCertificates: fn(() => []),
    getKeyPair: fn(() => { throw new Error('No client certificates are available.'); }),
    getKeyPairBySpki: fn(() => { throw new Error('No client certificates are available.'); }),
    subtleCrypto: () => crypto.subtle,
    verifyTLSServerCertificate: fn(() => ({ trusted: false, debug_errors: ['UNKNOWN'] })),
  };
}

export function vpnProviderApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('vpn', () => ({ configs: new Map(), n: 1 }));
  return {
    createConfig: fn((name) => { const id = 'vpn-' + st.n++; st.configs.set(id, name); ext.dispatch('vpnProvider.onConfigCreated', [id, name, {}]); return id; }),
    destroyConfig: fn((id) => { if (!st.configs.delete(id)) throw new Error('Unknown configuration.'); ext.dispatch('vpnProvider.onConfigRemoved', [id]); }),
    setParameters: fn(() => {}), sendPacket: fn(() => {}), notifyConnectionStateChanged: fn(() => {}),
    onPlatformMessage: h.event('vpnProvider.onPlatformMessage'), onPacketReceived: h.event('vpnProvider.onPacketReceived'),
    onConfigRemoved: h.event('vpnProvider.onConfigRemoved'), onConfigCreated: h.event('vpnProvider.onConfigCreated'), onUIEvent: h.event('vpnProvider.onUIEvent'),
  };
}

export function wallpaperApi(h) {
  return { setWallpaper: h.fn(() => { throw new Error('Wallpaper can only be changed on ChromeOS.'); }) };
}

defineStartup((ext) => { engineVoices(ext); }, (ext) => !!ext.manifest.tts_engine);
defineNamespace('identity', identityApi, { perms: ['identity'] });
defineNamespace('gcm', gcmApi, { perms: ['gcm'] });
defineNamespace('instanceID', instanceIDApi, { perms: ['gcm'] });
defineNamespace('ttsEngine', ttsEngineApi, { perms: ['ttsEngine'] });
defineNamespace('webAuthenticationProxy', webAuthenticationProxyApi, { perms: ['webAuthenticationProxy'] });
defineNamespace('mimeHandler', mimeHandlerApi, { perms: ['mimeHandler'] });
defineNamespace('telemetry', telemetryApi, { perms: ['telemetry'] });
defineNamespace('geckoProfiler', geckoProfilerApi, { perms: ['geckoProfiler'] });
defineNamespace('normandyAddonStudy', normandyAddonStudyApi, { perms: ['normandyAddonStudy'] });
defineNamespace('pkcs11', pkcs11Api, { perms: ['pkcs11'] });
defineNamespace('urlbar', urlbarApi, { perms: ['urlbar'] });
defineNamespace('activityLog', activityLogApi, { perms: ['activityLog'] });
defineNamespace('audio', audioApi, { perms: ['audio'] });
defineNamespace('certificateProvider', certificateProviderApi, { perms: ['certificateProvider'] });
defineNamespace('documentScan', documentScanApi, { perms: ['documentScan'] });
defineNamespace('enterprise', enterpriseApis, { perms: ['enterprise.deviceAttributes', 'enterprise.hardwarePlatform', 'enterprise.networkingAttributes', 'enterprise.platformKeys', 'enterprise.login'] });
defineNamespace('fileBrowserHandler', fileBrowserHandlerApi, { perms: ['fileBrowserHandler'] });
defineNamespace('fileSystemProvider', fileSystemProviderApi, { perms: ['fileSystemProvider'] });
defineNamespace('input', inputImeApi, { perms: ['input'] });
defineNamespace('loginState', loginStateApi, { perms: ['loginState'] });
defineNamespace('platformKeys', platformKeysApi, { perms: ['platformKeys'] });
defineNamespace('vpnProvider', vpnProviderApi, { perms: ['vpnProvider'] });
defineNamespace('wallpaper', wallpaperApi, { perms: ['wallpaper'] });
