// alarms, downloads, idle, tts, offscreen, webNavigation.
import { renderPage } from '../pages.js';

// ------------------------------------------------------------------ alarms

class AlarmsState {
  constructor(ext) {
    this.ext = ext;
    this.map = new Map();
    for (const a of ext.storage.internal().data.alarms || []) this.map.set(a.name, { alarm: a, timer: null });
    ext.whenBackgroundReady().then(() => { for (const e of this.map.values()) this.schedule(e); });
  }
  save() { this.ext.storage.internal().set({ alarms: [...this.map.values()].map((e) => e.alarm) }); }
  schedule(e) {
    clearTimeout(e.timer);
    const delay = Math.max(0, e.alarm.scheduledTime - Date.now());
    e.timer = setTimeout(() => (delay > 2 ** 31 - 2 ? this.schedule(e) : this.fire(e)), Math.min(delay, 2 ** 31 - 2));
  }
  fire(e) {
    if (this.map.get(e.alarm.name) !== e) return;
    const a = { ...e.alarm };
    this.ext.dispatch('alarms.onAlarm', () => [{ ...a }]);
    if (e.alarm.periodInMinutes) {
      e.alarm.scheduledTime = Date.now() + e.alarm.periodInMinutes * 60000;
      this.schedule(e);
    } else this.map.delete(e.alarm.name);
    this.save();
  }
  create(name, info = {}) {
    const now = Date.now();
    let when = info.when;
    if (when == null) when = now + (info.delayInMinutes ?? info.periodInMinutes ?? 0) * 60000;
    const alarm = { name, scheduledTime: when };
    if (info.periodInMinutes) alarm.periodInMinutes = info.periodInMinutes;
    const old = this.map.get(name);
    if (old) clearTimeout(old.timer);
    const e = { alarm, timer: null };
    this.map.set(name, e);
    this.schedule(e);
    this.save();
  }
  clear(name) {
    const e = this.map.get(name);
    if (!e) return false;
    clearTimeout(e.timer);
    this.map.delete(name);
    this.save();
    return true;
  }
  dispose() { for (const e of this.map.values()) clearTimeout(e.timer); }
}

export function alarmsApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('alarms', () => new AlarmsState(ext));
  return {
    create: fn((a, b) => { if (typeof a === 'string') st.create(a, b); else st.create('', a); }),
    get: fn((name = '') => { const e = st.map.get(name); return e ? { ...e.alarm } : undefined; }),
    getAll: fn(() => [...st.map.values()].map((e) => ({ ...e.alarm }))),
    clear: fn((name = '') => st.clear(name)),
    clearAll: fn(() => { const any = st.map.size > 0; for (const n of [...st.map.keys()]) st.clear(n); return any; }),
    onAlarm: h.event('alarms.onAlarm'),
  };
}

// ------------------------------------------------------------------ downloads

export function downloadsApi(h) {
  const { ext, fn, ctx } = h;
  const st = ext.shared('downloads', () => ({ n: 0, items: new Map() }));
  return {
    download: fn(async (o = {}) => {
      const id = ++st.n;
      let href = o.url;
      const p = ext.resolvePath(o.url, ctx.isExtensionPage ? ctx.path : null);
      if (p != null) href = URL.createObjectURL(await ext.vfs.blob(p));
      else if (/^https?:/i.test(href) && new URL(href).origin !== location.origin) {
        try {
          const r = await ext.shim.nativeFetch(href, { method: o.method || 'GET', headers: Object.fromEntries((o.headers || []).map((x) => [x.name, x.value])), body: o.body });
          href = URL.createObjectURL(await r.blob());
        } catch { /* fall back to a plain link */ }
      }
      const name = (o.filename || '').split(/[\\/]/).pop() || (o.url.split(/[?#]/)[0].split('/').pop() || 'download');
      const a = document.createElement('a');
      a.href = href;
      a.download = name;
      a.rel = 'noopener';
      a.style.display = 'none';
      (document.body || document.documentElement).appendChild(a);
      a.click();
      a.remove();
      if (href.startsWith('blob:') && href !== o.url) setTimeout(() => URL.revokeObjectURL(href), 600000);
      const item = { href, id, url: o.url, finalUrl: o.url, filename: name, state: 'complete', mime: '', startTime: new Date().toISOString(), endTime: new Date().toISOString(), exists: true, paused: false, canResume: false, danger: 'safe', incognito: false, bytesReceived: 0, totalBytes: -1, fileSize: -1, byExtensionId: ext.id, byExtensionName: ext.name, referrer: '' };
      st.items.set(id, item);
      ext.dispatch('downloads.onCreated', () => [{ ...item, state: 'in_progress' }]);
      ext.dispatch('downloads.onChanged', () => [{ id, state: { previous: 'in_progress', current: 'complete' } }]);
      return id;
    }),
    search: fn((q = {}) => [...st.items.values()].filter((i) => q.id == null || i.id === q.id)),
    erase: fn((q = {}) => { const ids = [...st.items.keys()].filter((i) => q.id == null || i === q.id); ids.forEach((i) => st.items.delete(i)); return ids; }),
    cancel: fn(() => {}), pause: fn(() => {}), resume: fn(() => {}),
    open: fn((id) => { const it = st.items.get(id); if (!it) throw new Error('Invalid download id ' + id); window.open(it.href || it.url, '_blank', 'noopener'); }),
    show: fn((id) => { const it = st.items.get(id); if (!it) return false; window.open(it.href || it.url, '_blank', 'noopener'); return true; }),
    showDefaultFolder: fn(() => {}),
    removeFile: fn((id) => { const it = st.items.get(id); if (it) it.exists = false; }),
    getFileIcon: fn((id) => { const it = st.items.get(id); if (!it) throw new Error('Invalid download id ' + id); return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#5f6368" d="M7 3h12l6 6v20H7z"/><path fill="#fff" d="M19 3v6h6"/></svg>'); }),
    acceptDanger: fn(() => {}), drag: fn(() => {}),
    setShelfEnabled: () => {}, setUiOptions: fn(() => {}),
    onCreated: h.event('downloads.onCreated'), onChanged: h.event('downloads.onChanged'), onErased: h.event('downloads.onErased'),
    onDeterminingFilename: h.event('downloads.onDeterminingFilename'),
  };
}

// ------------------------------------------------------------------ idle

export function idleApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('idle', () => {
    const s = { last: Date.now(), interval: 60, state: 'active', timer: null };
    const bump = () => {
      s.last = Date.now();
      if (s.state !== 'active') { s.state = 'active'; ext.dispatch('idle.onStateChanged', ['active']); }
    };
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'];
    evs.forEach((e) => window.addEventListener(e, bump, { capture: true, passive: true }));
    s.timer = setInterval(() => {
      if (s.state === 'active' && Date.now() - s.last > s.interval * 1000) { s.state = 'idle'; ext.dispatch('idle.onStateChanged', ['idle']); }
    }, 15000);
    s.dispose = () => { clearInterval(s.timer); evs.forEach((e) => window.removeEventListener(e, bump, { capture: true })); };
    return s;
  });
  return {
    queryState: fn((secs = 60) => (Date.now() - st.last > Math.max(15, secs) * 1000 ? 'idle' : 'active')),
    setDetectionInterval: (secs) => { st.interval = Math.max(15, secs | 0); },
    getAutoLockDelay: fn(() => 0),
    onStateChanged: h.event('idle.onStateChanged'),
    IdleState: { ACTIVE: 'active', IDLE: 'idle', LOCKED: 'locked' },
  };
}

// ------------------------------------------------------------------ tts

export function ttsApi(h) {
  const { ext, fn } = h;
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  return {
    speak: fn((text, o = {}) => {
      const engine = (ext.state.ttsEngineVoices || []).find((v) => (o.voiceName && v.voiceName === o.voiceName) || (!o.voiceName && o.lang && v.lang === o.lang));
      if (engine) {
        const requestId = Math.floor(Math.random() * 1e9);
        if (!ext.state.ttsRequests) ext.state.ttsRequests = new Map();
        ext.state.ttsRequests.set(requestId, (e) => { if (typeof o.onEvent === 'function') o.onEvent(e); if (/end|error|interrupted|cancelled/.test(e.type)) ext.state.ttsRequests.delete(requestId); });
        ext.dispatch('ttsEngine.onSpeak', () => [String(text), { voiceName: engine.voiceName, lang: o.lang || engine.lang, rate: o.rate ?? 1, pitch: o.pitch ?? 1, volume: o.volume ?? 1 }, (e) => { const r = ext.state.ttsRequests.get(requestId); if (r) r(e); }]);
        return;
      }
      if (!synth) throw new Error('Speech synthesis is not available.');
      if (!o.enqueue) synth.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      if (o.lang) u.lang = o.lang;
      if (o.rate) u.rate = o.rate;
      if (o.pitch) u.pitch = o.pitch;
      if (o.volume != null) u.volume = o.volume;
      if (o.voiceName) { const v = synth.getVoices().find((x) => x.name === o.voiceName); if (v) u.voice = v; }
      const ev = (type, extra = {}) => { if (typeof o.onEvent === 'function') { try { o.onEvent({ type, charIndex: 0, ...extra }); } catch (e) { ext.log.error(e); } } };
      u.onstart = () => ev('start');
      u.onend = () => ev('end', { charIndex: String(text).length });
      u.onerror = (e) => ev('error', { errorMessage: e.error });
      u.onboundary = (e) => ev(e.name === 'sentence' ? 'sentence' : 'word', { charIndex: e.charIndex });
      u.onpause = () => ev('pause');
      u.onresume = () => ev('resume');
      synth.speak(u);
    }),
    stop: () => synth && synth.cancel(),
    pause: () => synth && synth.pause(),
    resume: () => synth && synth.resume(),
    isSpeaking: fn(() => !!synth && synth.speaking),
    getVoices: fn(() => [...(ext.state.ttsEngineVoices || []), ...(synth ? synth.getVoices().map((v) => ({ voiceName: v.name, lang: v.lang, remote: !v.localService, eventTypes: ['start', 'end', 'word', 'error'] })) : [])]),
    onEvent: h.event('tts.onEvent'),
    onVoicesChanged: h.event('tts.onVoicesChanged'),
    EventType: { START: 'start', END: 'end', WORD: 'word', SENTENCE: 'sentence', MARKER: 'marker', INTERRUPTED: 'interrupted', CANCELLED: 'cancelled', ERROR: 'error', PAUSE: 'pause', RESUME: 'resume' },
  };
}

// ------------------------------------------------------------------ offscreen

export function offscreenApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('offscreen', () => ({ doc: null, frame: null, dispose() { if (this.doc) this.doc.destroy(); if (this.frame) this.frame.remove(); } }));
  return {
    createDocument: fn(async (o = {}) => {
      if (st.doc && st.doc.alive) throw new Error('Only a single offscreen document may be created.');
      const path = ext.resolvePath(o.url, '');
      if (path == null) throw new Error('Invalid offscreen document URL.');
      st.frame = ext.shim.ui.hiddenFrame(ext, 'offscreen');
      st.doc = await renderPage(ext, { type: 'offscreen', iframe: st.frame, path, search: (/\?[^#]*/.exec(o.url) || [''])[0] });
    }),
    closeDocument: fn(() => {
      if (!st.doc || !st.doc.alive) throw new Error('No current offscreen document.');
      st.doc.destroy();
      st.frame.remove();
      st.doc = null;
    }),
    hasDocument: fn(() => !!(st.doc && st.doc.alive)),
    Reason: Object.fromEntries(['TESTING', 'AUDIO_PLAYBACK', 'IFRAME_SCRIPTING', 'DOM_SCRAPING', 'BLOBS', 'DOM_PARSER', 'USER_MEDIA', 'DISPLAY_MEDIA', 'WEB_RTC', 'CLIPBOARD', 'LOCAL_STORAGE', 'WORKERS', 'BATTERY_STATUS', 'MATCH_MEDIA', 'GEOLOCATION'].map((r) => [r, r])),
  };
}

// ------------------------------------------------------------------ webNavigation

export function matchUrlFilters(filters, url) {
  if (!filters || !filters.length) return true;
  let u;
  try { u = new URL(url); } catch { return false; }
  const host = u.hostname;
  return filters.some((f) => {
    if (f.schemes && !f.schemes.includes(u.protocol.slice(0, -1))) return false;
    if (f.ports && !f.ports.some((p) => (Array.isArray(p) ? +u.port >= p[0] && +u.port <= p[1] : String(p) === (u.port || (u.protocol === 'https:' ? '443' : '80'))))) return false;
    const checks = {
      hostContains: () => ('.' + host).includes(f.hostContains), hostEquals: () => host === f.hostEquals, hostPrefix: () => host.startsWith(f.hostPrefix),
      hostSuffix: () => host.endsWith(f.hostSuffix), pathContains: () => u.pathname.includes(f.pathContains), pathEquals: () => u.pathname === f.pathEquals,
      pathPrefix: () => u.pathname.startsWith(f.pathPrefix), pathSuffix: () => u.pathname.endsWith(f.pathSuffix), queryContains: () => u.search.slice(1).includes(f.queryContains),
      queryEquals: () => u.search.slice(1) === f.queryEquals, queryPrefix: () => u.search.slice(1).startsWith(f.queryPrefix), querySuffix: () => u.search.slice(1).endsWith(f.querySuffix),
      urlContains: () => url.includes(f.urlContains), urlEquals: () => url === f.urlEquals, urlMatches: () => new RegExp(f.urlMatches).test(url),
      originAndPathMatches: () => new RegExp(f.originAndPathMatches).test(u.origin + u.pathname), urlPrefix: () => url.startsWith(f.urlPrefix), urlSuffix: () => url.endsWith(f.urlSuffix),
    };
    return Object.keys(checks).every((k) => f[k] == null || checks[k]());
  });
}

export function webNavigationApi(h) {
  const { ext, fn } = h;
  const frame = () => ({ errorOccurred: false, url: location.href, parentFrameId: -1, frameId: 0, documentId: 'D' + ext.shim.tabId, documentLifecycle: 'active', frameType: 'outermost_frame', processId: 1 });
  const events = {};
  for (const n of ['onBeforeNavigate', 'onCommitted', 'onDOMContentLoaded', 'onCompleted', 'onErrorOccurred', 'onCreatedNavigationTarget', 'onReferenceFragmentUpdated', 'onTabReplaced', 'onHistoryStateUpdated']) {
    events[n] = h.event('webNavigation.' + n);
  }
  return {
    getFrame: fn((d = {}) => (d.frameId === 0 || d.frameId == null ? frame() : null)),
    getAllFrames: fn(() => [frame()]),
    ...events,
  };
}
