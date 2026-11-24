// devtools.* (an in-page "DevTools" drawer hosting the extension's panels) and debugger
// (a subset of the Chrome DevTools Protocol implemented against the page itself).
import { defineNamespace, defineStartup, features } from './registry.js';
import { ExtEvent } from '../events.js';
import { renderPage } from '../pages.js';
import { getInterceptor } from '../interceptor.js';
import { captureVisibleTab } from '../capture.js';
import { normalizePath } from '../../core/util.js';
import { canEval } from '../scope.js';

// ------------------------------------------------------------------ DevTools drawer state

export function devtoolsState(ext) {
  return ext.shared('devtools', () => ({
    page: null, frame: null, drawer: null, panels: [], panes: [], selected: null, openResource: null, themeHandlers: new Set(),
    dispose() { if (this.drawer) this.drawer.close(); if (this.page) this.page.destroy(); if (this.frame) this.frame.remove(); },
  }));
}

export async function openDevTools(ext) {
  if (!ext.manifest.devtools_page) return;
  const st = devtoolsState(ext);
  if (!st.page) {
    st.frame = ext.shim.ui.hiddenFrame(ext, 'devtools');
    st.page = await renderPage(ext, { type: 'devtools', iframe: st.frame, path: normalizePath(ext.manifest.devtools_page) });
  }
  if (!st.drawer) {
    st.drawer = ext.shim.ui.drawer(ext, {
      title: `${ext.name} — DevTools`,
      onPick: (el) => {
        st.selected = el;
        try { Object.defineProperty(window, '$0', { value: el, configurable: true, writable: true }); } catch { /* ignore */ }
        ext.dispatch('devtools.panels.elements.onSelectionChanged', []);
      },
      onClose: () => { st.drawer = null; for (const p of [...st.panels, ...st.panes]) if (p.ctx) { p.ctx.destroy(); p.ctx = null; } },
    });
    for (const p of [...st.panels, ...st.panes]) addTab(ext, st, p);
  }
}

function addTab(ext, st, p) {
  if (!st.drawer) return;
  p.tab = st.drawer.addTab(p.title, {
    show: async (iframe) => {
      if (p.json !== undefined && !p.path) { st.drawer.showJson(p.tab, p.json); p.onShown.dispatch(null); return; }
      if (!p.path) return;
      if (!p.ctx) p.ctx = await renderPage(ext, { type: 'devtools', iframe, path: p.path });
      p.onShown.dispatch(p.ctx.win);
    },
    hide: () => p.onHidden.dispatch(),
  });
}

defineStartup((ext) => {
  // Keep a request log for devtools.network even before the drawer opens.
  const client = { ext, decide: () => null, notify: () => {} };
  ext.cleanups.push(getInterceptor(ext.shim).addClient(client));
  const fn = (entry) => ext.dispatch('devtools.network.onRequestFinished', () => [harEntry(ext, entry)]);
  getInterceptor(ext.shim).listeners.add(fn);
  ext.cleanups.push(() => getInterceptor(ext.shim).listeners.delete(fn));
  ext.navHooks.add((url) => ext.dispatch('devtools.network.onNavigated', [url]));
}, (ext) => !!ext.manifest.devtools_page);

function harEntry(ext, e) {
  const q = (() => { try { return [...new URL(e.url).searchParams].map(([name, value]) => ({ name, value })); } catch { return []; } })();
  const time = Math.max(0, (e.endTime || e.timeStamp) - e.timeStamp);
  const mime = ((e.responseHeaders || []).find((x) => x.name.toLowerCase() === 'content-type') || {}).value || '';
  return {
    startedDateTime: new Date(e.timeStamp).toISOString(), time,
    request: { method: e.method || 'GET', url: e.url, httpVersion: 'HTTP/1.1', headers: (e.requestHeaders || []).map((x) => ({ ...x })), queryString: q, cookies: [], headersSize: -1, bodySize: -1 },
    response: { status: e.statusCode || 0, statusText: '', httpVersion: 'HTTP/1.1', headers: (e.responseHeaders || []).map((x) => ({ ...x })), cookies: [], content: { size: e.size || -1, mimeType: mime }, redirectURL: '', headersSize: -1, bodySize: -1, _error: e.error },
    cache: {}, timings: { blocked: -1, dns: -1, connect: -1, send: 0, wait: time, receive: 0, ssl: -1 }, serverIPAddress: '', _resourceType: e.type,
    getContent(cb) {
      const p = ext.shim.nativeFetch(e.url).then((r) => r.text()).then((t) => [t, ''], () => ['', '']);
      if (typeof cb === 'function') p.then(([c, enc]) => cb(c, enc));
      return p;
    },
  };
}

// ------------------------------------------------------------------ devtools.* API (devtools contexts only)

export function devtoolsApi(h) {
  const { ext, ctx } = h;
  const st = devtoolsState(ext);
  const cbOrPromise = (cb, p) => { if (typeof cb === 'function') { p.then((v) => cb(...(Array.isArray(v) ? v : [v]))); return undefined; } return p; };
  const dark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  if (!st.themeWatch) {
    st.themeWatch = true;
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { for (const f of st.themeHandlers) try { f(dark() ? 'dark' : 'default'); } catch { /* ignore */ } });
  }
  const makeEvent = (name) => new ExtEvent(name, ctx.log);
  const createSidebarPane = (where) => (title, cb) => {
    const pane = { title: `${where} › ${title}`, path: null, json: undefined, onShown: makeEvent('ExtensionSidebarPane.onShown'), onHidden: makeEvent('ExtensionSidebarPane.onHidden') };
    st.panes.push(pane);
    addTab(ext, st, pane);
    const api = {
      onShown: pane.onShown, onHidden: pane.onHidden,
      setHeight() {},
      setPage(path) { pane.path = ext.resolvePath(path, ctx.path) ?? normalizePath(path); },
      setObject(json, rootTitle, cb2) { pane.json = typeof json === 'string' ? json : JSON.stringify(json, null, 2); if (st.drawer && pane.tab) st.drawer.showJson(pane.tab, pane.json, true); if (typeof cb2 === 'function') cb2(); return Promise.resolve(); },
      setExpression(expr, rootTitle, cb2) {
        let v;
        try { v = canEval() ? (0, eval)(expr) : '(eval blocked by the page)'; } catch (e) { v = String(e); }
        try { v = JSON.stringify(v, null, 2); } catch { v = String(v); }
        return api.setObject(v, rootTitle, cb2);
      },
    };
    return cbOrPromise(cb, Promise.resolve(api));
  };
  const panels = {
    get themeName() { return dark() ? 'dark' : 'default'; },
    create(title, iconPath, pagePath, cb) {
      const panel = { title, path: ext.resolvePath(pagePath, ctx.path) ?? normalizePath(pagePath), onShown: makeEvent('ExtensionPanel.onShown'), onHidden: makeEvent('ExtensionPanel.onHidden') };
      st.panels.push(panel);
      addTab(ext, st, panel);
      const api = {
        onShown: panel.onShown, onHidden: panel.onHidden, onSearch: makeEvent('ExtensionPanel.onSearch'),
        createStatusBarButton: () => ({ onClicked: makeEvent('Button.onClicked'), update() {} }),
        show() { if (st.drawer && panel.tab) st.drawer.select(panel.tab); },
      };
      return cbOrPromise(cb, Promise.resolve(api));
    },
    setOpenResourceHandler(cb) { st.openResource = cb || null; },
    openResource(url, line, col, cb) { if (st.openResource) st.openResource({ url, type: 'document' }, line); else window.open(url, '_blank'); return cbOrPromise(cb, Promise.resolve()); },
    setThemeChangeHandler(cb) { if (cb) st.themeHandlers.add(cb); },
    onThemeChanged: (() => { const e = makeEvent('devtools.panels.onThemeChanged'); st.themeHandlers.add((t) => e.dispatch(t)); return e; })(),
    elements: { createSidebarPane: createSidebarPane('Elements'), onSelectionChanged: h.event('devtools.panels.elements.onSelectionChanged') },
    sources: { createSidebarPane: createSidebarPane('Sources'), onSelectionChanged: h.event('devtools.panels.sources.onSelectionChanged') },
  };
  const resources = () => {
    const list = [{ url: location.href, type: 'document' }];
    for (const e of performance.getEntriesByType('resource')) list.push({ url: e.name, type: { script: 'script', link: 'stylesheet', css: 'image', img: 'image', font: 'font' }[e.initiatorType] || 'other' });
    return list.map((r) => ({
      ...r,
      getContent(cb) {
        const p = (r.url === location.href ? Promise.resolve(document.documentElement.outerHTML) : ext.shim.nativeFetch(r.url).then((x) => x.text())).then((t) => [t, ''], () => ['', '']);
        return cbOrPromise(cb, p);
      },
      setContent(content, commit, cb) { return cbOrPromise(cb, Promise.resolve({ code: 'E_NOTSUPPORTED', description: 'Resources cannot be edited from a page.' })); },
    }));
  };
  return {
    inspectedWindow: {
      tabId: ext.shim.tabId,
      eval(expression, options, cb) {
        if (typeof options === 'function') { cb = options; options = {}; }
        options = options || {};
        let result;
        let exc;
        try {
          if (!canEval()) throw Object.assign(new Error('eval is blocked by the page\'s Content-Security-Policy'), { protocol: true });
          if (options.useContentScriptContext) result = ext.content.isolated(ext.content.frame(window)).evaluate(String(expression));
          else result = (0, eval)(String(expression));
          result = result === undefined ? undefined : JSON.parse(JSON.stringify(result));
        } catch (e) {
          exc = e && e.protocol ? { isError: true, code: 'E_PROTOCOLERROR', description: 'Inspector protocol error: %s', details: [e.message] } : { isException: true, value: String(e && e.stack ? e.stack.split('\n')[0] : e) };
          result = undefined;
        }
        const p = Promise.resolve([result, exc]);
        if (typeof cb === 'function') { setTimeout(() => cb(result, exc), 0); return undefined; }
        return p;
      },
      reload() { setTimeout(() => location.reload(), 0); },
      getResources(cb) { return cbOrPromise(cb, Promise.resolve(resources())); },
      onResourceAdded: h.event('devtools.inspectedWindow.onResourceAdded'),
      onResourceContentCommitted: h.event('devtools.inspectedWindow.onResourceContentCommitted'),
    },
    network: {
      getHAR(cb) {
        const har = { version: '1.2', creator: { name: 'ExtShim', version: ext.shim.version }, pages: [{ startedDateTime: new Date(performance.timeOrigin).toISOString(), id: 'page_1', title: document.title, pageTimings: {} }], entries: getInterceptor(ext.shim).log.map((e) => harEntry(ext, e)) };
        return cbOrPromise(cb, Promise.resolve(har));
      },
      onRequestFinished: h.event('devtools.network.onRequestFinished'),
      onNavigated: h.event('devtools.network.onNavigated'),
    },
    panels,
    performance: { onProfilingStarted: h.event('devtools.performance.onProfilingStarted'), onProfilingStopped: h.event('devtools.performance.onProfilingStopped') },
    recorder: {
      createView(title, pagePath) {
        const view = { title: 'Recorder › ' + title, path: ext.resolvePath(pagePath, ctx.path) ?? normalizePath(pagePath), onShown: makeEvent('RecorderView.onShown'), onHidden: makeEvent('RecorderView.onHidden') };
        st.panels.push(view);
        addTab(ext, st, view);
        return { onShown: view.onShown, onHidden: view.onHidden, show() { openDevTools(ext).then(() => st.drawer && view.tab && st.drawer.select(view.tab)); } };
      },
      registerRecorderExtensionPlugin() {},
    },
  };
}

// ------------------------------------------------------------------ debugger (CDP subset)

function remoteObject(v, byValue) {
  const t = typeof v;
  if (v === null) return { type: 'object', subtype: 'null', value: null };
  if (t === 'undefined') return { type: 'undefined' };
  if (t === 'object' || t === 'function') {
    const o = { type: t, className: (v && v.constructor && v.constructor.name) || 'Object', description: t === 'function' ? String(v).slice(0, 100) : (v instanceof Node ? v.nodeName : Array.isArray(v) ? `Array(${v.length})` : 'Object') };
    if (v instanceof Node) o.subtype = 'node';
    else if (Array.isArray(v)) o.subtype = 'array';
    if (byValue) { try { o.value = JSON.parse(JSON.stringify(v)); } catch { /* not serializable */ } }
    return o;
  }
  return { type: t, value: v, description: String(v) };
}

export function debuggerApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('debugger', () => ({ attached: new Map(), nodes: new Map(), nodeIds: new WeakMap(), next: 1, headers: null, netOff: null, dispose() { for (const a of this.attached.values()) a.banner.remove(); } }));
  const key = (t = {}) => String(t.tabId ?? t.targetId ?? t.extensionId);
  const target = () => ({ type: 'page', id: 'T' + ext.shim.tabId, title: document.title, url: location.href, attached: st.attached.size > 0, tabId: ext.shim.tabId, faviconUrl: ext.pageTab().favIconUrl });
  const emit = (source, method, params) => ext.dispatch('debugger.onEvent', () => [{ ...source }, method, JSON.parse(JSON.stringify(params))]);
  const nodeId = (n) => { if (!n) return 0; let id = st.nodeIds.get(n); if (!id) { id = st.next++; st.nodeIds.set(n, id); st.nodes.set(id, n); } return id; };
  const node = (id) => { const n = id ? st.nodes.get(id) : document; if (!n) throw new Error('{"code":-32000,"message":"Could not find node with given id"}'); return n; };
  const describe = (n, depth = 1) => {
    const d = { nodeId: nodeId(n), backendNodeId: nodeId(n), nodeType: n.nodeType, nodeName: n.nodeName, localName: n.localName || '', nodeValue: n.nodeValue || '', childNodeCount: n.childNodes.length };
    if (n.attributes) d.attributes = [...n.attributes].flatMap((a) => [a.name, a.value]);
    if (n === document) { d.documentURL = location.href; d.baseURL = document.baseURI; }
    if (depth > 0 || depth === -1) d.children = [...n.childNodes].filter((c) => c.nodeType !== 3 || c.nodeValue.trim()).map((c) => describe(c, depth === -1 ? -1 : depth - 1));
    return d;
  };
  const mouse = (p) => {
    const el = document.elementFromPoint(p.x, p.y) || document.body;
    const map = { mousePressed: 'mousedown', mouseReleased: 'mouseup', mouseMoved: 'mousemove', mouseWheel: 'wheel' };
    const init = { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, button: { left: 0, middle: 1, right: 2 }[p.button] ?? 0, detail: p.clickCount || 1, altKey: !!(p.modifiers & 1), ctrlKey: !!(p.modifiers & 2), metaKey: !!(p.modifiers & 4), shiftKey: !!(p.modifiers & 8) };
    if (p.type === 'mouseWheel') el.dispatchEvent(new WheelEvent('wheel', { ...init, deltaX: p.deltaX || 0, deltaY: p.deltaY || 0 }));
    else {
      el.dispatchEvent(new PointerEvent(map[p.type].replace('mouse', 'pointer'), init));
      el.dispatchEvent(new MouseEvent(map[p.type], init));
      if (p.type === 'mousePressed' && el.focus) el.focus();
      if (p.type === 'mouseReleased') el.dispatchEvent(new MouseEvent(init.button === 2 ? 'contextmenu' : 'click', init));
    }
  };
  const key2 = (p) => {
    const el = document.activeElement || document.body;
    const init = { key: p.key, code: p.code, keyCode: p.windowsVirtualKeyCode || 0, bubbles: true, cancelable: true, altKey: !!(p.modifiers & 1), ctrlKey: !!(p.modifiers & 2), metaKey: !!(p.modifiers & 4), shiftKey: !!(p.modifiers & 8) };
    if (p.type === 'keyUp') el.dispatchEvent(new KeyboardEvent('keyup', init));
    else if (p.type === 'char') document.execCommand('insertText', false, p.text || '');
    else {
      const ok = el.dispatchEvent(new KeyboardEvent('keydown', init));
      if (ok && p.type === 'keyDown' && p.text) document.execCommand('insertText', false, p.text);
    }
  };
  const commands = {
    'Browser.getVersion': () => ({ protocolVersion: '1.3', product: 'ExtShim/' + ext.shim.version, revision: '', userAgent: navigator.userAgent, jsVersion: '' }),
    'Target.getTargets': () => ({ targetInfos: [{ targetId: target().id, type: 'page', title: document.title, url: location.href, attached: true, canAccessOpener: false }] }),
    'Page.navigate': (p) => { setTimeout(() => { location.href = p.url; }, 0); return { frameId: 'main', loaderId: 'L' + Date.now() }; },
    'Page.reload': () => { setTimeout(() => location.reload(), 0); return {}; },
    'Page.captureScreenshot': async (p) => { const url = await captureVisibleTab({ format: p.format === 'png' || !p.format ? 'png' : 'jpeg', quality: p.quality }); return { data: url.split(',')[1] }; },
    'Page.getLayoutMetrics': () => {
      const vp = { pageX: scrollX, pageY: scrollY, clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight };
      const size = { x: 0, y: 0, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight };
      return { layoutViewport: vp, cssLayoutViewport: vp, visualViewport: { offsetX: 0, offsetY: 0, ...vp, scale: 1, zoom: 1 }, cssVisualViewport: { offsetX: 0, offsetY: 0, ...vp, scale: 1, zoom: 1 }, contentSize: size, cssContentSize: size };
    },
    'Page.getFrameTree': () => ({ frameTree: { frame: { id: 'main', loaderId: 'L', url: location.href, domainAndRegistry: '', securityOrigin: location.origin, mimeType: document.contentType, adFrameStatus: { adFrameType: 'none' }, secureContextType: isSecureContext ? 'Secure' : 'InsecureScheme', crossOriginIsolatedContextType: 'NotIsolated', gatedAPIFeatures: [] } } }),
    'Runtime.evaluate': async (p) => {
      if (!canEval()) return { result: { type: 'undefined' }, exceptionDetails: { exceptionId: 1, text: 'EvalError: eval is blocked by the page\'s Content-Security-Policy', lineNumber: 0, columnNumber: 0 } };
      try {
        let v = (0, eval)(String(p.expression));
        if (p.awaitPromise && v && typeof v.then === 'function') v = await v;
        return { result: remoteObject(v, p.returnByValue) };
      } catch (e) {
        return { result: remoteObject(e, false), exceptionDetails: { exceptionId: 1, text: 'Uncaught', lineNumber: 0, columnNumber: 0, exception: { type: 'object', subtype: 'error', className: e && e.name, description: String(e && e.stack || e) } } };
      }
    },
    'DOM.getDocument': (p) => ({ root: describe(document, p.depth == null ? 2 : p.depth) }),
    'DOM.describeNode': (p) => ({ node: describe(node(p.nodeId || p.backendNodeId), p.depth || 0) }),
    'DOM.getOuterHTML': (p) => { const n = node(p.nodeId || p.backendNodeId); return { outerHTML: n === document ? '<!DOCTYPE html>' + document.documentElement.outerHTML : n.outerHTML || n.nodeValue || '' }; },
    'DOM.setOuterHTML': (p) => { node(p.nodeId).outerHTML = p.outerHTML; return {}; },
    'DOM.querySelector': (p) => ({ nodeId: nodeId(node(p.nodeId).querySelector(p.selector)) }),
    'DOM.querySelectorAll': (p) => ({ nodeIds: [...node(p.nodeId).querySelectorAll(p.selector)].map(nodeId) }),
    'DOM.setAttributeValue': (p) => { node(p.nodeId).setAttribute(p.name, p.value); return {}; },
    'DOM.removeAttribute': (p) => { node(p.nodeId).removeAttribute(p.name); return {}; },
    'DOM.removeNode': (p) => { node(p.nodeId).remove(); return {}; },
    'DOM.focus': (p) => { node(p.nodeId || p.backendNodeId).focus(); return {}; },
    'DOM.scrollIntoViewIfNeeded': (p) => { node(p.nodeId || p.backendNodeId).scrollIntoView({ block: 'center' }); return {}; },
    'DOM.getBoxModel': (p) => {
      const r = node(p.nodeId || p.backendNodeId).getBoundingClientRect();
      const q = [r.left, r.top, r.right, r.top, r.right, r.bottom, r.left, r.bottom];
      return { model: { content: q, padding: q, border: q, margin: q, width: r.width, height: r.height } };
    },
    'Input.dispatchMouseEvent': (p) => { mouse(p); return {}; },
    'Input.dispatchKeyEvent': (p) => { key2(p); return {}; },
    'Input.insertText': (p) => { document.execCommand('insertText', false, p.text); return {}; },
    'Network.setExtraHTTPHeaders': (p) => { st.headers = Object.entries(p.headers || {}).map(([name, value]) => ({ name, value: String(value) })); return {}; },
    'Network.enable': (p, source) => {
      if (!st.netOff) {
        const client = {
          ext,
          decide: (stage, d) => {
            if (stage === 'beforeRequest') emit(source, 'Network.requestWillBeSent', { requestId: d.requestId, loaderId: 'L', documentURL: location.href, request: { url: d.url, method: d.method, headers: Object.fromEntries((d.requestHeaders || []).map((x) => [x.name, x.value])) }, timestamp: performance.now() / 1000, wallTime: Date.now() / 1000, initiator: { type: 'script' }, type: d.type === 'xmlhttprequest' ? 'XHR' : 'Other' });
            if (stage === 'beforeSendHeaders' && st.headers) return { requestHeaders: [...(d.requestHeaders || []).filter((x) => !st.headers.some((y) => y.name.toLowerCase() === x.name.toLowerCase())), ...st.headers] };
            return null;
          },
          notify: (ev, d) => {
            if (ev === 'onCompleted') {
              emit(source, 'Network.responseReceived', { requestId: d.requestId, loaderId: 'L', timestamp: performance.now() / 1000, type: d.type === 'xmlhttprequest' ? 'XHR' : 'Other', response: { url: d.url, status: d.statusCode, statusText: '', headers: Object.fromEntries((d.responseHeaders || []).map((x) => [x.name, x.value])), mimeType: '', connectionReused: false, connectionId: 0, encodedDataLength: 0, securityState: 'unknown' } });
              emit(source, 'Network.loadingFinished', { requestId: d.requestId, timestamp: performance.now() / 1000, encodedDataLength: 0 });
            } else if (ev === 'onErrorOccurred') emit(source, 'Network.loadingFailed', { requestId: d.requestId, timestamp: performance.now() / 1000, type: 'Other', errorText: d.error, canceled: d.error === 'net::ERR_ABORTED' });
          },
        };
        st.netOff = getInterceptor(ext.shim).addClient(client);
      }
      return {};
    },
    'Network.disable': () => { if (st.netOff) { st.netOff(); st.netOff = null; } return {}; },
    'Runtime.enable': () => ({}), 'Page.enable': () => ({}), 'DOM.enable': () => ({}), 'CSS.enable': () => ({}), 'Log.enable': () => ({}),
    'Console.enable': () => ({}), 'Overlay.enable': () => ({}), 'Emulation.setDeviceMetricsOverride': () => ({}), 'Emulation.clearDeviceMetricsOverride': () => ({}),
    'Emulation.setUserAgentOverride': () => ({}), 'Network.setUserAgentOverride': () => ({}), 'Network.setCacheDisabled': () => ({}),
    'Runtime.disable': () => ({}), 'Page.disable': () => ({}), 'DOM.disable': () => ({}),
  };
  return {
    attach: fn((t = {}, version) => {
      if (t.tabId != null && t.tabId !== ext.shim.tabId) throw new Error(`No tab with given id ${t.tabId}.`);
      if (version && !/^1\./.test(version)) throw new Error(`Requested protocol version is not supported: ${version}.`);
      const k = key(t);
      if (st.attached.has(k)) throw new Error('Another debugger is already attached to the tab with id: ' + ext.shim.tabId + '.');
      const banner = ext.shim.ui.banner(ext, `"${ext.name}" started debugging this page`, () => {
        st.attached.delete(k);
        ext.dispatch('debugger.onDetach', () => [{ ...t }, 'canceled_by_user']);
      });
      st.attached.set(k, { target: t, banner });
    }),
    detach: fn((t = {}) => {
      const a = st.attached.get(key(t));
      if (!a) throw new Error('Debugger is not attached to the tab with id: ' + ext.shim.tabId + '.');
      a.banner.remove();
      st.attached.delete(key(t));
      if (!st.attached.size && st.netOff) { st.netOff(); st.netOff = null; }
    }),
    sendCommand: fn(async (t = {}, method, params = {}) => {
      if (!st.attached.has(key(t))) throw new Error('Debugger is not attached to the tab with id: ' + ext.shim.tabId + '.');
      const c = commands[method];
      if (!c) throw new Error(JSON.stringify({ code: -32601, message: `'${method}' wasn't found` }));
      return c(params || {}, t);
    }),
    getTargets: fn(() => [target()]),
    onEvent: h.event('debugger.onEvent'),
    onDetach: h.event('debugger.onDetach'),
  };
}

features.openDevTools = openDevTools;
defineNamespace('devtools', devtoolsApi, { always: true, contexts: 'devtools', when: (ext) => !!ext.manifest.devtools_page || ext.options.allApis });
defineNamespace('debugger', debuggerApi, { perms: ['debugger'] });
