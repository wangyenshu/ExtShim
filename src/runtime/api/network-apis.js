// webRequest, declarativeNetRequest, cookies, browsingData, dns, networkStatus, declarativeWebRequest.
import { defineNamespace, defineStartup } from './registry.js';
import { getInterceptor, StreamFilter } from '../interceptor.js';
import { matchesAny } from '../../core/match.js';
import { normalizePath, parseJSONC } from '../../core/util.js';
import { nextTask } from '../events.js';
import { registrableDomain } from '../psl.js';

const WR_EVENTS = ['onBeforeRequest', 'onBeforeSendHeaders', 'onSendHeaders', 'onHeadersReceived', 'onAuthRequired', 'onResponseStarted', 'onBeforeRedirect', 'onCompleted', 'onErrorOccurred', 'onActionIgnored'];
const STAGE_EVENT = { beforeRequest: 'onBeforeRequest', beforeSendHeaders: 'onBeforeSendHeaders', headersReceived: 'onHeadersReceived' };
const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };
const domainMatch = (host, list) => list.some((d) => host === d || host.endsWith('.' + d));

// ------------------------------------------------------------------ declarativeNetRequest engine

const ACTION_RANK = { allow: 0, allowAllRequests: 1, block: 2, upgradeScheme: 3, redirect: 4, modifyHeaders: 5 };
const ALL_TYPES = ['main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'font', 'object', 'xmlhttprequest', 'ping', 'csp_report', 'media', 'websocket', 'webtransport', 'webbundle', 'other'];

export function urlFilterToRegExp(filter, caseSensitive = false) {
  let s = String(filter);
  let prefix = '';
  let suffix = '';
  if (s.startsWith('||')) { prefix = '^[a-z][a-z0-9+.-]*:\\/\\/(?:[^/?#@]*@)?(?:[^/?#:]*\\.)?'; s = s.slice(2); } else if (s.startsWith('|')) { prefix = '^'; s = s.slice(1); }
  if (s.endsWith('|') && !s.endsWith('\\|')) { suffix = '$'; s = s.slice(0, -1); }
  let body = '';
  for (const ch of s) body += ch === '*' ? '.*' : ch === '^' ? '(?:[^A-Za-z0-9_\\-.%]|$)' : ch.replace(/[.+?${}()|[\]\\/]/g, '\\$&');
  return new RegExp(prefix + body + suffix, caseSensitive ? '' : 'i');
}

function validateRule(r) {
  if (!r || !Number.isInteger(r.id) || r.id < 1) throw new Error('Rule with id must have a positive integer id.');
  if (!r.action || !Object.hasOwn(ACTION_RANK, r.action.type)) throw new Error(`Rule with id ${r.id} specifies an invalid action type.`);
  if (r.condition && r.condition.regexFilter) { try { new RegExp(r.condition.regexFilter); } catch { throw new Error(`Rule with id ${r.id} specified a non-ascii or invalid regexFilter.`); } }
  if (r.action.type === 'redirect' && !r.action.redirect) throw new Error(`Rule with id ${r.id} does not specify the value for "action.redirect" key.`);
}

class DNR {
  constructor(ext) {
    this.ext = ext;
    this.internal = ext.storage.internal();
    this.static = new Map();
    this.dynamic = this.internal.data['dnr:dynamic'] || [];
    this.session = [];
    this.disabled = this.internal.data['dnr:disabled'] || {};
    this.matched = [];
    this.badge = { enabled: false, counts: new Map() };
    this.compiled = [];
    this.ready = this.load();
  }
  async load() {
    const res = (this.ext.manifest.declarative_net_request || {}).rule_resources || [];
    const enabledOverride = this.internal.data['dnr:enabled'];
    for (const r of res) {
      let rules = [];
      const t = await this.ext.vfs.text(normalizePath(r.path));
      if (t) { try { rules = parseJSONC(t); } catch (e) { this.ext.log.warn(`declarative_net_request ${r.path}:`, e.message); } }
      this.static.set(r.id, { rules: Array.isArray(rules) ? rules : [], enabled: enabledOverride ? enabledOverride.includes(r.id) : r.enabled !== false });
    }
    this.compile();
  }
  compile() {
    const list = [];
    const add = (rules, rulesetId, rank) => {
      for (const rule of rules) {
        try { list.push(compileRule(rule, rulesetId, rank)); } catch (e) { this.ext.log.warn(`Invalid rule ${rule && rule.id} in ${rulesetId}:`, e.message); }
      }
    };
    add(this.session, '_session', 0);
    add(this.dynamic, '_dynamic', 1);
    for (const [id, set] of this.static) {
      if (!set.enabled) continue;
      const off = new Set(this.disabled[id] || []);
      add(set.rules.filter((r) => !off.has(r.id)), id, 2);
    }
    list.sort((a, b) => b.priority - a.priority || ACTION_RANK[a.type] - ACTION_RANK[b.type] || a.rank - b.rank);
    this.compiled = list;
    this.pageAllow = null;
    const page = { url: location.href, type: 'main_frame', method: 'GET', initiator: null, tabId: this.ext.shim.tabId };
    for (const c of list) if (c.type === 'allowAllRequests' && c.test(page)) { this.pageAllow = c; break; }
  }
  match(d) { return this.compiled.filter((c) => c.test(d)); }
  record(c, d) {
    const info = { rule: { ruleId: c.rule.id, rulesetId: c.rulesetId }, timeStamp: Date.now(), tabId: d.tabId };
    this.matched.push(info);
    if (this.matched.length > 1000) this.matched.shift();
    const perms = this.ext.manifest.permissions || [];
    if (perms.includes('declarativeNetRequestFeedback')) {
      this.ext.dispatch('declarativeNetRequest.onRuleMatchedDebug', () => [{ request: { requestId: d.requestId, url: d.url, method: d.method, type: d.type, tabId: d.tabId, frameId: d.frameId, parentFrameId: d.parentFrameId, initiator: d.initiator }, rule: { ...info.rule } }]);
    }
    if (this.badge.enabled && (c.type === 'block' || c.type === 'redirect' || c.type === 'upgradeScheme')) this.bump(d.tabId, 1);
  }
  bump(tabId, n) {
    const v = (this.badge.counts.get(tabId) || 0) + n;
    this.badge.counts.set(tabId, v);
    const st = this.ext.state.action;
    if (st) st.set('badgeText', v ? String(v) : '', tabId);
  }
  /** Main decision: returns a webRequest-style BlockingResponse. */
  evaluate(stage, d) {
    if (!this.compiled.length) return null;
    if (stage === 'beforeRequest') {
      const m = this.match(d).filter((c) => c.type !== 'modifyHeaders');
      const best = m[0];
      if (!best) return null;
      if (this.pageAllow && this.pageAllow.priority >= best.priority) return null;
      this.record(best, d);
      if (best.type === 'block') return { cancel: true };
      if (best.type === 'upgradeScheme') return /^(http|ws):/.test(d.url) ? { upgradeToSecure: true } : null;
      if (best.type === 'redirect') { const u = best.redirect(d, this.ext); return u && u !== d.url ? { redirectUrl: u } : null; }
      return null;
    }
    const which = stage === 'beforeSendHeaders' ? 'requestHeaders' : 'responseHeaders';
    const all = this.match(d);
    const allow = all.find((c) => c.type === 'allow' || c.type === 'allowAllRequests');
    const floor = Math.max(allow ? allow.priority : -Infinity, this.pageAllow ? this.pageAllow.priority : -Infinity);
    const mods = all.filter((c) => c.type === 'modifyHeaders' && c.priority > floor && c.rule.action[which]);
    if (!mods.length) return null;
    let headers = (d[which] || []).map((x) => ({ ...x }));
    const touched = new Map();
    for (const c of mods) {
      this.record(c, d);
      for (const op of c.rule.action[which]) {
        const name = String(op.header).toLowerCase();
        const prev = touched.get(name);
        if (prev && prev !== 'append') continue; // a higher-priority set/remove wins
        if (op.operation === 'remove') headers = headers.filter((x) => x.name.toLowerCase() !== name);
        else if (op.operation === 'set') { headers = headers.filter((x) => x.name.toLowerCase() !== name); headers.push({ name: op.header, value: op.value }); }
        else if (op.operation === 'append') headers.push({ name: op.header, value: op.value });
        touched.set(name, op.operation);
      }
    }
    return { [which]: headers };
  }
  save() {
    return this.internal.set({ 'dnr:dynamic': this.dynamic, 'dnr:disabled': this.disabled, 'dnr:enabled': [...this.static].filter(([, s]) => s.enabled).map(([id]) => id) });
  }
}

function compileRule(rule, rulesetId, rank) {
  validateRule(rule);
  const c = rule.condition || {};
  const re = c.regexFilter ? new RegExp(c.regexFilter, c.isUrlFilterCaseSensitive ? '' : 'i') : c.urlFilter ? urlFilterToRegExp(c.urlFilter, !!c.isUrlFilterCaseSensitive) : null;
  const types = c.resourceTypes || ALL_TYPES.filter((t) => t !== 'main_frame' && !(c.excludedResourceTypes || []).includes(t));
  const lower = (a) => a && a.map((x) => String(x).toLowerCase());
  const reqDomains = lower(c.requestDomains);
  const exReqDomains = lower(c.excludedRequestDomains) || [];
  const initDomains = lower(c.initiatorDomains || c.domains);
  const exInitDomains = lower(c.excludedInitiatorDomains || c.excludedDomains) || [];
  const methods = lower(c.requestMethods);
  const exMethods = lower(c.excludedRequestMethods) || [];
  const headerCond = (list, headers) => (list || []).every((hc) => {
    const vals = (headers || []).filter((x) => x.name.toLowerCase() === hc.header.toLowerCase()).map((x) => x.value);
    if (!vals.length) return false;
    const pat = (p) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
    if (hc.values && !hc.values.some((p) => vals.some((v) => pat(p).test(v)))) return false;
    if (hc.excludedValues && hc.excludedValues.some((p) => vals.some((v) => pat(p).test(v)))) return false;
    return true;
  });
  return {
    rule, rulesetId, rank, priority: rule.priority || 1, type: rule.action.type, re,
    test(d) {
      if (re && !re.test(d.url)) return false;
      if (!types.includes(d.type)) return false;
      if (c.excludedResourceTypes && c.excludedResourceTypes.includes(d.type)) return false;
      const m = String(d.method || 'GET').toLowerCase();
      if (methods && !methods.includes(m)) return false;
      if (exMethods.includes(m)) return false;
      const host = hostOf(d.url);
      if (reqDomains && !domainMatch(host, reqDomains)) return false;
      if (exReqDomains.length && domainMatch(host, exReqDomains)) return false;
      const ih = d.initiator ? hostOf(d.initiator) : '';
      if (initDomains && !domainMatch(ih, initDomains)) return false;
      if (exInitDomains.length && ih && domainMatch(ih, exInitDomains)) return false;
      if (c.domainType && ih) {
        const third = registrableDomain(host) !== registrableDomain(ih);
        if ((c.domainType === 'thirdParty') !== third) return false;
      }
      if (c.tabIds && !c.tabIds.includes(d.tabId)) return false;
      if (c.excludedTabIds && c.excludedTabIds.includes(d.tabId)) return false;
      if (c.responseHeaders && !(d.responseHeaders && headerCond(c.responseHeaders, d.responseHeaders))) return false;
      if (c.excludedResponseHeaders && d.responseHeaders && c.excludedResponseHeaders.some((hc) => headerCond([hc], d.responseHeaders))) return false;
      return true;
    },
    redirect(d, ext) {
      const r = rule.action.redirect || {};
      if (r.url) return r.url;
      if (r.extensionPath) return ext.getURL(r.extensionPath);
      if (r.regexSubstitution && re) return d.url.replace(re, r.regexSubstitution.replace(/\$/g, '$$$$').replace(/\\(\d)/g, (_, n) => (n === '0' ? '$&' : '$' + n)));
      if (r.transform) {
        const u = new URL(d.url);
        const t = r.transform;
        if (t.scheme) u.protocol = t.scheme + ':';
        if (t.host != null) u.hostname = t.host;
        if (t.port != null) u.port = t.port;
        if (t.path != null) u.pathname = t.path;
        if (t.query != null) u.search = t.query;
        if (t.queryTransform) {
          for (const k of t.queryTransform.removeParams || []) u.searchParams.delete(k);
          for (const p of t.queryTransform.addOrReplaceParams || []) { if (p.replaceOnly && !u.searchParams.has(p.key)) continue; u.searchParams.set(p.key, p.value); }
        }
        if (t.fragment != null) u.hash = t.fragment;
        if (t.username != null) u.username = t.username;
        if (t.password != null) u.password = t.password;
        return u.href;
      }
      return null;
    },
  };
}

// ------------------------------------------------------------------ webRequest client (one per extension)

function filterMatches(filter, d) {
  if (!filter) return true;
  if (filter.urls && !matchesAny(filter.urls, d.url)) return false;
  if (filter.types && !filter.types.includes(d.type)) return false;
  if (filter.tabId != null && filter.tabId !== d.tabId) return false;
  if (filter.windowId != null && filter.windowId !== d.windowId) return false;
  return true;
}

function shape(d, ev, spec = []) {
  const o = { ...d };
  const wantReq = spec.includes('requestHeaders') && (ev === 'onBeforeSendHeaders' || ev === 'onSendHeaders');
  const wantRes = spec.includes('responseHeaders') && /^on(HeadersReceived|ResponseStarted|Completed|BeforeRedirect|AuthRequired)$/.test(ev);
  if (!wantReq) delete o.requestHeaders; else o.requestHeaders = o.requestHeaders.map((x) => ({ ...x }));
  if (!wantRes) delete o.responseHeaders; else o.responseHeaders = (o.responseHeaders || []).map((x) => ({ ...x }));
  if (!(ev === 'onBeforeRequest' && spec.includes('requestBody'))) delete o.requestBody;
  if (!/^on(HeadersReceived|ResponseStarted|Completed|BeforeRedirect|AuthRequired|ErrorOccurred)$/.test(ev)) { delete o.statusCode; delete o.statusLine; }
  return o;
}

export function networkClient(ext) {
  return ext.shared('netClient', () => {
    const perms = new Set([...(ext.manifest.permissions || []), ...(ext.manifest.optional_permissions || [])]);
    const useDnr = ext.options.allApis || [...perms].some((p) => /^declarativeNetRequest/.test(p));
    const client = {
      ext,
      dnr: useDnr ? new DNR(ext) : null,
      filters: new Map(),
      listeners(ev) {
        const out = [];
        for (const c of ext.contexts) {
          if (!c.alive || !c.isExtensionPage) continue;
          const e = c.events.get('webRequest.' + ev);
          if (e) for (const l of e._listeners) out.push([c, l]);
        }
        return out;
      },
      decide(stage, d, sync) {
        const ev = STAGE_EVENT[stage];
        const out = {};
        if (client.dnr) {
          const r = client.dnr.evaluate(stage, d);
          if (r) Object.assign(out, r);
          if (out.cancel || out.redirectUrl || out.upgradeToSecure) return out;
          if (r && r.requestHeaders) d.requestHeaders = r.requestHeaders;
          if (r && r.responseHeaders) d.responseHeaders = r.responseHeaders;
        }
        const pending = [];
        for (const [c, l] of client.listeners(ev)) {
          const [filter, spec = []] = l.extra;
          if (!filterMatches(filter, d)) continue;
          const details = shape(d, ev, spec);
          const blocking = spec.includes('blocking');
          if (!blocking) { nextTask(() => { if (c.alive) { try { l.fn(details); } catch (e) { c.log.error(`Error in webRequest.${ev} listener:`, e); } } }); continue; }
          let r;
          try { r = l.fn(details); } catch (e) { c.log.error(`Error in webRequest.${ev} listener:`, e); continue; }
          if (r && typeof r.then === 'function') pending.push(r);
          else if (r) Object.assign(out, r);
        }
        if (stage === 'beforeRequest' && client.filters.has(d.requestId)) { out.filters = [client.filters.get(d.requestId)]; client.filters.delete(d.requestId); }
        if (!pending.length || sync) return out;
        return Promise.all(pending.map((p) => p.catch(() => null))).then((rs) => {
          for (const r of rs) if (r) Object.assign(out, r);
          if (stage === 'beforeRequest' && client.filters.has(d.requestId)) { out.filters = [client.filters.get(d.requestId)]; client.filters.delete(d.requestId); }
          return out;
        });
      },
      notify(ev, d) {
        if (ev === 'onBeforeRequest' || ev === 'onBeforeSendHeaders' || ev === 'onHeadersReceived') {
          // Observed-only requests: deliver as non-blocking.
          for (const [c, l] of client.listeners(ev)) {
            const [filter, spec = []] = l.extra;
            if (!filterMatches(filter, d)) continue;
            const details = shape(d, ev, spec);
            nextTask(() => { if (c.alive) { try { l.fn(details); } catch (e) { c.log.error(e); } } });
          }
          return;
        }
        for (const [c, l] of client.listeners(ev)) {
          const [filter, spec = []] = l.extra;
          if (!filterMatches(filter, d)) continue;
          const details = shape(d, ev, spec);
          nextTask(() => { if (c.alive) { try { l.fn(details); } catch (e) { c.log.error(`Error in webRequest.${ev} listener:`, e); } } });
        }
      },
    };
    const remove = getInterceptor(ext.shim).addClient(client);
    ext.cleanups.push(remove);
    return client;
  });
}

defineStartup(async (ext) => {
  const client = networkClient(ext);
  if (!client.dnr) return;
  await client.dnr.ready;
  // DNR main_frame rules apply to the page itself (e.g. redirect extensions).
  const page = { ...getInterceptor(ext.shim).base(location.href, 'GET', 'main_frame'), initiator: null };
  const r = client.dnr.evaluate('beforeRequest', page);
  if (r && r.redirectUrl && r.redirectUrl !== location.href) location.replace(r.redirectUrl);
  else if (r && r.upgradeToSecure && location.protocol === 'http:') location.replace(location.href.replace(/^http:/, 'https:'));
  else if (r && r.cancel) {
    const box = document.createElement('div');
    box.style.cssText = 'font:16px system-ui,sans-serif;padding:15vh 10vw;color:#202124';
    box.textContent = `This page has been blocked by an extension (${ext.name}). ERR_BLOCKED_BY_CLIENT`;
    document.documentElement.replaceChildren(document.createElement('head'), Object.assign(document.createElement('body'), {}));
    document.body.append(box);
  }
}, ['webRequest', 'webRequestBlocking', 'declarativeNetRequest', 'declarativeNetRequestWithHostAccess', 'declarativeNetRequestFeedback']);

export function webRequestApi(h) {
  const { ext, fn } = h;
  const client = networkClient(ext);
  const api = {
    MAX_HANDLER_BEHAVIOR_CHANGED_CALLS_PER_10_MINUTES: 20,
    handlerBehaviorChanged: fn(() => {}),
    filterResponseData: (requestId) => {
      const f = new StreamFilter(String(requestId));
      client.filters.set(String(requestId), f);
      return f;
    },
    getSecurityInfo: fn((requestId) => {
      const e = getInterceptor(ext.shim).log.find((x) => x.requestId === String(requestId));
      return { state: e && /^https:/.test(e.url) ? 'secure' : 'insecure', certificates: [] };
    }),
  };
  for (const ev of WR_EVENTS) api[ev] = h.event('webRequest.' + ev);
  return api;
}

export function declarativeNetRequestApi(h) {
  const { ext, fn } = h;
  const client = networkClient(ext);
  const dnr = client.dnr;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const update = (listName) => fn(async (o = {}) => {
    await dnr.ready;
    const list = dnr[listName].filter((r) => !(o.removeRuleIds || []).includes(r.id));
    for (const r of o.addRules || []) {
      validateRule(r);
      if (list.some((x) => x.id === r.id)) throw new Error(`Rule with id ${r.id} does not have a unique ID.`);
      list.push(clone(r));
    }
    dnr[listName] = list;
    dnr.compile();
    if (listName === 'dynamic') await dnr.save();
  });
  return {
    MAX_NUMBER_OF_RULES: 30000, MAX_NUMBER_OF_DYNAMIC_RULES: 30000, MAX_NUMBER_OF_UNSAFE_DYNAMIC_RULES: 5000, MAX_NUMBER_OF_SESSION_RULES: 5000,
    MAX_NUMBER_OF_UNSAFE_SESSION_RULES: 5000, MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES: 5000, MAX_NUMBER_OF_REGEX_RULES: 1000,
    MAX_NUMBER_OF_STATIC_RULESETS: 100, MAX_NUMBER_OF_ENABLED_STATIC_RULESETS: 50, MAX_NUMBER_OF_DISABLED_STATIC_RULES: 5000, GUARANTEED_MINIMUM_STATIC_RULES: 30000,
    GETMATCHEDRULES_QUOTA_INTERVAL: 10, MAX_GETMATCHEDRULES_CALLS_PER_INTERVAL: 20, DYNAMIC_RULESET_ID: '_dynamic', SESSION_RULESET_ID: '_session',
    updateDynamicRules: update('dynamic'),
    getDynamicRules: fn(async (f = {}) => { await dnr.ready; return clone(dnr.dynamic.filter((r) => !f.ruleIds || f.ruleIds.includes(r.id))); }),
    updateSessionRules: update('session'),
    getSessionRules: fn(async (f = {}) => { await dnr.ready; return clone(dnr.session.filter((r) => !f.ruleIds || f.ruleIds.includes(r.id))); }),
    updateEnabledRulesets: fn(async (o = {}) => {
      await dnr.ready;
      for (const id of [...(o.enableRulesetIds || []), ...(o.disableRulesetIds || [])]) if (!dnr.static.has(id)) throw new Error(`Invalid ruleset id: ${id}.`);
      for (const id of o.disableRulesetIds || []) dnr.static.get(id).enabled = false;
      for (const id of o.enableRulesetIds || []) dnr.static.get(id).enabled = true;
      dnr.compile();
      await dnr.save();
    }),
    getEnabledRulesets: fn(async () => { await dnr.ready; return [...dnr.static].filter(([, s]) => s.enabled).map(([id]) => id); }),
    updateStaticRules: fn(async (o = {}) => {
      await dnr.ready;
      if (!dnr.static.has(o.rulesetId)) throw new Error(`Invalid ruleset id: ${o.rulesetId}.`);
      const set = new Set(dnr.disabled[o.rulesetId] || []);
      for (const id of o.disableRuleIds || []) set.add(id);
      for (const id of o.enableRuleIds || []) set.delete(id);
      dnr.disabled[o.rulesetId] = [...set];
      dnr.compile();
      await dnr.save();
    }),
    getDisabledRuleIds: fn(async (o = {}) => { await dnr.ready; return [...(dnr.disabled[o.rulesetId] || [])]; }),
    getAvailableStaticRuleCount: fn(async () => { await dnr.ready; return 30000 - [...dnr.static.values()].filter((s) => s.enabled).reduce((n, s) => n + s.rules.length, 0); }),
    getMatchedRules: fn(async (f = {}) => ({ rulesMatchedInfo: clone(dnr.matched.filter((m) => (f.tabId == null || m.tabId === f.tabId) && (f.minTimeStamp == null || m.timeStamp >= f.minTimeStamp))) })),
    setExtensionActionOptions: fn((o = {}) => {
      if (o.displayActionCountAsBadgeText !== undefined) dnr.badge.enabled = !!o.displayActionCountAsBadgeText;
      if (o.tabUpdate) dnr.bump(o.tabUpdate.tabId, o.tabUpdate.increment || 0);
    }),
    isRegexSupported: fn((o = {}) => {
      try { new RegExp(o.regex, o.isCaseSensitive === false ? 'i' : ''); return { isSupported: true }; } catch { return { isSupported: false, reason: 'syntaxError' }; }
    }),
    testMatchOutcome: fn(async (req = {}) => {
      await dnr.ready;
      const d = { url: req.url, type: req.type || 'xmlhttprequest', method: req.method || 'get', initiator: req.initiator, tabId: req.tabId ?? -1, responseHeaders: req.responseHeaders ? Object.entries(req.responseHeaders).flatMap(([name, v]) => v.map((value) => ({ name, value }))) : undefined };
      return { matchedRules: dnr.match(d).map((c) => ({ ruleId: c.rule.id, rulesetId: c.rulesetId })) };
    }),
    onRuleMatchedDebug: h.event('declarativeNetRequest.onRuleMatchedDebug'),
  };
}

// ------------------------------------------------------------------ cookies (this site's cookies)

function toCookie(c) {
  const host = location.hostname;
  const domain = c.domain ? (c.domain.startsWith('.') ? c.domain : '.' + c.domain) : host;
  const ss = { strict: 'strict', lax: 'lax', none: 'no_restriction' }[String(c.sameSite || '').toLowerCase()] || 'unspecified';
  const out = { name: c.name, value: c.value, domain, hostOnly: !c.domain, path: c.path || '/', secure: c.secure ?? location.protocol === 'https:', httpOnly: false, sameSite: ss, session: !c.expires, storeId: '0', firstPartyDomain: '' };
  if (c.expires) out.expirationDate = c.expires / 1000;
  if (c.partitioned) out.partitionKey = { topLevelSite: location.origin };
  return out;
}

async function pageCookies() {
  if (window.cookieStore) { try { return (await cookieStore.getAll()).map(toCookie); } catch { /* fall back */ } }
  return document.cookie.split(';').map((s) => s.trim()).filter(Boolean).map((s) => { const i = s.indexOf('='); return toCookie({ name: i < 0 ? '' : s.slice(0, i), value: i < 0 ? s : s.slice(i + 1) }); });
}

function sameSite(url) {
  try {
    const u = new URL(url);
    const h = u.hostname;
    const here = location.hostname;
    return h === here || h.endsWith('.' + here) || here.endsWith('.' + h) || registrableDomain(h) === registrableDomain(here);
  } catch { return false; }
}

export function cookiesApi(h) {
  const { ext, fn } = h;
  const st = ext.shared('cookies', () => {
    const s = { last: null, timer: null };
    const fire = (cookie, removed, cause) => ext.dispatch('cookies.onChanged', () => [{ removed, cookie: { ...cookie }, cause }]);
    if (window.cookieStore && cookieStore.addEventListener) {
      const onChange = (e) => {
        for (const c of e.changed || []) fire(toCookie(c), false, 'explicit');
        for (const c of e.deleted || []) fire(toCookie(c), true, 'explicit');
      };
      cookieStore.addEventListener('change', onChange);
      s.dispose = () => cookieStore.removeEventListener('change', onChange);
    } else {
      let prev = document.cookie;
      s.timer = setInterval(async () => {
        if (document.cookie === prev) return;
        const before = new Map(prev.split(';').map((x) => x.trim()).filter(Boolean).map((x) => [x.split('=')[0], x]));
        prev = document.cookie;
        const now = await pageCookies();
        for (const c of now) { const b = before.get(c.name); if (b !== `${c.name}=${c.value}`) fire(c, false, 'explicit'); before.delete(c.name); }
        for (const [name] of before) fire(toCookie({ name, value: '' }), true, 'explicit');
      }, 1500);
      s.dispose = () => clearInterval(s.timer);
    }
    return s;
  });
  void st; // the change listener lives as long as the extension
  const check = (url) => { if (url && !sameSite(url)) return false; return true; };
  return {
    get: fn(async (d = {}) => {
      if (!check(d.url)) return null;
      return (await pageCookies()).find((c) => c.name === d.name) || null;
    }),
    getAll: fn(async (d = {}) => {
      if (d.url && !check(d.url)) return [];
      if (d.domain && !sameSite('https://' + String(d.domain).replace(/^\./, '') + '/')) return [];
      return (await pageCookies()).filter((c) => (d.name == null || c.name === d.name) && (d.path == null || c.path === d.path) &&
        (d.secure == null || c.secure === d.secure) && (d.session == null || c.session === d.session));
    }),
    set: fn(async (d = {}) => {
      if (!d.url || !check(d.url)) throw new Error(`Failed to parse or set cookie named "${d.name || ''}".`);
      if (d.httpOnly) throw new Error(`Failed to set cookie "${d.name || ''}": HttpOnly cookies cannot be set from a web page.`);
      const opts = { name: d.name || '', value: d.value || '', path: d.path || '/' };
      if (d.domain) opts.domain = String(d.domain).replace(/^\./, '');
      if (d.expirationDate) opts.expires = Math.round(d.expirationDate * 1000);
      if (d.sameSite && d.sameSite !== 'unspecified') opts.sameSite = d.sameSite === 'no_restriction' ? 'none' : d.sameSite;
      if (window.cookieStore) await cookieStore.set(opts);
      else {
        let s = `${encodeURIComponent(opts.name)}=${opts.value}; path=${opts.path}`;
        if (opts.domain) s += `; domain=${opts.domain}`;
        if (opts.expires) s += `; expires=${new Date(opts.expires).toUTCString()}`;
        if (d.secure) s += '; secure';
        if (opts.sameSite) s += `; samesite=${opts.sameSite}`;
        document.cookie = s;
      }
      return (await pageCookies()).find((c) => c.name === opts.name) || toCookie({ ...opts, expires: opts.expires });
    }),
    remove: fn(async (d = {}) => {
      if (!check(d.url)) return null;
      const c = (await pageCookies()).find((x) => x.name === d.name);
      if (!c) return null;
      if (window.cookieStore) await cookieStore.delete({ name: d.name, path: c.path, domain: c.hostOnly ? undefined : c.domain.replace(/^\./, '') });
      else document.cookie = `${encodeURIComponent(d.name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${c.path}`;
      return { url: d.url, name: d.name, storeId: '0' };
    }),
    getAllCookieStores: fn(() => [{ id: '0', tabIds: [ext.shim.tabId], incognito: false }]),
    getPartitionKey: fn(() => ({ partitionKey: { topLevelSite: location.origin, hasCrossSiteAncestor: false } })),
    onChanged: h.event('cookies.onChanged'),
  };
}

// ------------------------------------------------------------------ browsingData (this site's data)

export function browsingDataApi(h) {
  const { ext, fn } = h;
  const TYPES = ['appcache', 'cache', 'cacheStorage', 'cookies', 'downloads', 'fileSystems', 'formData', 'history', 'indexedDB', 'localStorage', 'passwords', 'pluginData', 'serverBoundCertificates', 'serviceWorkers', 'webSQL'];
  const applies = (o = {}) => {
    if (o.origins && !o.origins.some((x) => { try { return new URL(x).origin === location.origin; } catch { return false; } })) return false;
    if (o.excludeOrigins && o.excludeOrigins.some((x) => { try { return new URL(x).origin === location.origin; } catch { return false; } })) return false;
    return true;
  };
  const removers = {
    async cookies() { for (const c of await pageCookies()) { if (window.cookieStore) await cookieStore.delete({ name: c.name, path: c.path }).catch(() => {}); else document.cookie = `${c.name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${c.path}`; } },
    async localStorage() { for (const k of Object.keys(localStorage)) if (!k.startsWith('extshim:')) localStorage.removeItem(k); try { sessionStorage.clear(); } catch { /* ignore */ } },
    async indexedDB() { if (indexedDB.databases) for (const d of await indexedDB.databases()) if (d.name && !d.name.startsWith('extshim:')) indexedDB.deleteDatabase(d.name); },
    async cacheStorage() { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); },
    async cache() { return removers.cacheStorage(); },
    async serviceWorkers() { if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); },
    async history(since) {
      const p = ext.state['profile:history'];
      if (p) { p.data.visits = p.data.visits.filter((v) => v.visitTime < since); for (const u of Object.keys(p.data.items)) if (!p.data.visits.some((v) => v.url === u)) delete p.data.items[u]; p.save(); }
    },
    async downloads() { const d = ext.state.downloads; if (d) d.items.clear(); },
  };
  const remove = async (o = {}, data = {}) => {
    if (!applies(o)) return;
    for (const [k, on] of Object.entries(data)) if (on && removers[k]) await removers[k](o.since || 0);
  };
  const api = {
    settings: fn(() => ({ options: { since: 0 }, dataToRemove: Object.fromEntries(TYPES.map((t) => [t, !!removers[t]])), dataRemovalPermitted: Object.fromEntries(TYPES.map((t) => [t, true])) })),
    remove: fn(remove),
  };
  for (const t of TYPES) api['remove' + t[0].toUpperCase() + t.slice(1)] = fn((o) => remove(o, { [t]: true }));
  api.removeWebSQL = fn(() => {});
  api.removeAppcache = fn(() => {});
  return api;
}

// ------------------------------------------------------------------ dns (DNS-over-HTTPS)

export function dnsApi(h) {
  const { ext, fn } = h;
  return {
    resolve: fn(async (hostname, flags = []) => {
      const endpoint = ext.options.dnsResolver || 'https://cloudflare-dns.com/dns-query';
      const q = async (type) => {
        const r = await ext.shim.nativeFetch(`${endpoint}?name=${encodeURIComponent(hostname)}&type=${type}`, { headers: { accept: 'application/dns-json' } });
        return r.ok ? r.json() : { Answer: [] };
      };
      const wantV6 = !(flags || []).includes('disable_ipv6');
      const wantV4 = !(flags || []).includes('disable_ipv4');
      const [a, aaaa] = await Promise.all([wantV4 ? q('A') : { Answer: [] }, wantV6 ? q('AAAA') : { Answer: [] }]);
      const ans = [...(a.Answer || []), ...(aaaa.Answer || [])];
      const addresses = ans.filter((x) => x.type === 1 || x.type === 28).map((x) => x.data);
      if (!addresses.length) throw new Error('NS_ERROR_UNKNOWN_HOST');
      const cname = ans.filter((x) => x.type === 5).map((x) => x.data.replace(/\.$/, '')).pop();
      return { addresses, canonicalName: (flags || []).includes('canonical_name') ? cname || hostname : undefined, isTRR: true, resultCode: 0, address: addresses[0] };
    }),
  };
}

export function networkStatusApi(h) {
  const { ext, fn } = h;
  ext.shared('networkStatus', () => {
    const fire = () => ext.dispatch('networkStatus.onConnectionChanged', [linkInfo()]);
    window.addEventListener('online', fire);
    window.addEventListener('offline', fire);
    if (navigator.connection) navigator.connection.addEventListener('change', fire);
    return { dispose() { window.removeEventListener('online', fire); window.removeEventListener('offline', fire); if (navigator.connection) navigator.connection.removeEventListener('change', fire); } };
  });
  return { getLinkInfo: fn(() => linkInfo()), onConnectionChanged: h.event('networkStatus.onConnectionChanged') };
}

function linkInfo() {
  const c = navigator.connection || {};
  return { status: navigator.onLine ? 'up' : 'down', type: { wifi: 'wifi', ethernet: 'ethernet', cellular: 'wwan', bluetooth: 'unknown', wimax: 'wimax', none: 'unknown' }[c.type] || 'unknown', id: undefined };
}

export function declarativeWebRequestApi(h) {
  return { onRequest: h.event('declarativeWebRequest.onRequest'), onMessage: h.event('declarativeWebRequest.onMessage') };
}

const WR_PERMS = ['webRequest', 'webRequestBlocking', 'webRequestAuthProvider', 'webRequestFilterResponse'];
defineNamespace('webRequest', webRequestApi, { perms: WR_PERMS });
defineNamespace('declarativeNetRequest', declarativeNetRequestApi, { perms: ['declarativeNetRequest', 'declarativeNetRequestWithHostAccess', 'declarativeNetRequestFeedback'] });
defineNamespace('declarativeWebRequest', declarativeWebRequestApi, { perms: ['declarativeWebRequest', 'webRequest'] });
defineNamespace('cookies', cookiesApi, { perms: ['cookies'] });
defineNamespace('browsingData', browsingDataApi, { perms: ['browsingData'] });
defineNamespace('dns', dnsApi, { perms: ['dns'] });
defineNamespace('networkStatus', networkStatusApi, { perms: ['networkStatus'] });
