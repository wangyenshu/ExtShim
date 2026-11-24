// Behaviour checks for the extended API surface. runChecks() returns {name: value | {error}}.
const results = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const events = {};
const count = (name) => (...a) => { (events[name] = events[name] || []).push(a); };

chrome.bookmarks.onCreated.addListener(count('bookmarks.onCreated'));
chrome.cookies.onChanged.addListener(count('cookies.onChanged'));
chrome.privacy.websites.doNotTrackEnabled.onChange.addListener(count('privacy.onChange'));
chrome.ttsEngine.onSpeak.addListener((text, opts, send) => { count('ttsEngine.onSpeak')(text); send({ type: 'end', charIndex: text.length }); });
chrome.webRequest.onCompleted.addListener(count('webRequest.onCompleted'), { urls: ['<all_urls>'], types: ['xmlhttprequest'] });
chrome.webRequest.onBeforeRequest.addListener((d) => {
  if (d.url.includes('/wr-cancel')) return { cancel: true };
  if (d.url.includes('/wr-redirect')) return { redirectUrl: d.url.replace('/wr-redirect', '/echo') + '&wr=1' };
}, { urls: ['<all_urls>'] }, ['blocking']);
chrome.webRequest.onBeforeSendHeaders.addListener((d) => {
  if (!d.url.includes('wrhdr')) return;
  d.requestHeaders.push({ name: 'X-WebRequest', value: 'hello' });
  return { requestHeaders: d.requestHeaders };
}, { urls: ['<all_urls>'] }, ['blocking', 'requestHeaders']);
chrome.webRequest.onHeadersReceived.addListener((d) => {
  if (!d.url.includes('wrhdr')) return;
  return { responseHeaders: [...d.responseHeaders, { name: 'X-Added', value: 'by-extension' }] };
}, { urls: ['<all_urls>'] }, ['blocking', 'responseHeaders']);
chrome.webAuthenticationProxy.onGetRequest.addListener((req) => {
  const opts = JSON.parse(req.requestDetailsJson);
  chrome.webAuthenticationProxy.completeGetRequest({ requestId: req.requestId, responseJson: JSON.stringify({ id: 'cred-' + opts.challenge, rawId: 'AQID', type: 'public-key', response: { clientDataJSON: 'e30', authenticatorData: 'AA', signature: 'AA' } }) });
});
chrome.input.ime.onFocus.addListener((ctx) => { self.imeContext = ctx.contextID; });

async function check(name, fn) {
  try { results[name] = await fn(); } catch (e) { results[name] = { error: String(e && e.message || e) }; }
}

async function runChecks() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const page = (fn, args = []) => chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fn, args, world: 'MAIN' }).then((r) => r[0].result);

  await check('bookmarks', async () => {
    const folder = await chrome.bookmarks.create({ parentId: '1', title: 'Probe folder' });
    const bm = await chrome.bookmarks.create({ parentId: folder.id, title: 'Example', url: 'https://example.com/' });
    const found = await chrome.bookmarks.search('example');
    await chrome.bookmarks.move(bm.id, { parentId: '2' });
    const [moved] = await chrome.bookmarks.get(bm.id);
    const tree = await chrome.bookmarks.getTree();
    await chrome.bookmarks.removeTree(folder.id);
    let err = null;
    try { await chrome.bookmarks.remove('1'); } catch (e) { err = e.message; }
    return { found: found.length, movedTo: moved.parentId, roots: tree[0].children.map((c) => c.title), rootErr: err, created: (events['bookmarks.onCreated'] || []).length };
  });
  await check('history', async () => {
    const items = await chrome.history.search({ text: '' });
    await chrome.history.addUrl({ url: 'https://example.org/added' });
    const after = await chrome.history.search({ text: 'example.org' });
    const visits = await chrome.history.getVisits({ url: 'https://example.org/added' });
    await chrome.history.deleteUrl({ url: 'https://example.org/added' });
    const gone = await chrome.history.search({ text: 'example.org' });
    return { hasPage: items.some((i) => i.url === tab.url), added: after.length, visits: visits.length, deleted: gone.length };
  });
  await check('topSites', async () => (await chrome.topSites.get()).some((s) => s.url === tab.url));
  await check('readingList', async () => {
    await chrome.readingList.addEntry({ url: 'https://example.com/read', title: 'Read me', hasBeenRead: false });
    await chrome.readingList.updateEntry({ url: 'https://example.com/read', hasBeenRead: true });
    const [e] = await chrome.readingList.query({ url: 'https://example.com/read' });
    await chrome.readingList.removeEntry({ url: 'https://example.com/read' });
    return { read: e.hasBeenRead, left: (await chrome.readingList.query({})).length };
  });
  await check('tabGroups', async () => {
    const gid = await chrome.tabs.group({ tabIds: [tab.id] });
    await chrome.tabGroups.update(gid, { title: 'Probe', color: 'green' });
    const g = await chrome.tabGroups.get(gid);
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.ungroup([tab.id]);
    return { title: g.title, color: g.color, tabGroupId: t.groupId === gid, left: (await chrome.tabGroups.query({})).length };
  });
  await check('sessions', async () => {
    await chrome.sessions.setTabValue(tab.id, 'k', { v: 1 });
    return { value: await chrome.sessions.getTabValue(tab.id, 'k'), closed: (await chrome.sessions.getRecentlyClosed()).map((s) => s.tab && s.tab.url) };
  });
  await check('privacy', async () => {
    const before = await chrome.privacy.websites.doNotTrackEnabled.get({});
    await chrome.privacy.websites.doNotTrackEnabled.set({ value: true });
    const after = await chrome.privacy.websites.doNotTrackEnabled.get({});
    await chrome.privacy.websites.doNotTrackEnabled.clear({});
    await wait(20);
    return { before: before.value, after: after.value, level: after.levelOfControl, events: (events['privacy.onChange'] || []).length };
  });
  await check('contentSettings', async () => {
    await chrome.contentSettings.javascript.set({ primaryPattern: '[*.]example.com', setting: 'block' });
    const a = await chrome.contentSettings.javascript.get({ primaryUrl: 'https://www.example.com/x' });
    const b = await chrome.contentSettings.javascript.get({ primaryUrl: 'https://other.org/' });
    return [a.setting, b.setting];
  });
  await check('fontSettings', async () => {
    await chrome.fontSettings.setDefaultFontSize({ pixelSize: 18 });
    return [(await chrome.fontSettings.getFont({ genericFamily: 'sansserif' })).fontId, (await chrome.fontSettings.getDefaultFontSize()).pixelSize];
  });
  await check('cookies', async () => {
    await chrome.cookies.set({ url: tab.url, name: 'probe', value: '42' });
    const c = await chrome.cookies.get({ url: tab.url, name: 'probe' });
    const docCookie = await page(() => document.cookie);
    await chrome.cookies.remove({ url: tab.url, name: 'probe' });
    const gone = await chrome.cookies.get({ url: tab.url, name: 'probe' });
    const foreign = await chrome.cookies.getAll({ url: 'https://unrelated.example/' });
    await wait(50);
    return { value: c && c.value, inDocument: docCookie.includes('probe=42'), removed: gone === null, foreign: foreign.length, events: (events['cookies.onChanged'] || []).length };
  });
  await check('browsingData', async () => {
    await page(() => { localStorage.setItem('pageKey', '1'); });
    await chrome.browsingData.removeLocalStorage({});
    return page(() => localStorage.getItem('pageKey'));
  });
  await check('webRequest', async () => {
    const cancel = await page(() => fetch('/wr-cancel?x').then(() => 'loaded', (e) => e.name));
    const redirect = await page(() => fetch('/wr-redirect?a=1').then((r) => r.json()));
    const hdr = await page(() => fetch('/echo?wrhdr').then(async (r) => ({ sent: (await r.json()).headers['x-webrequest'], added: r.headers.get('x-added') })));
    const xhr = await page(() => new Promise((res) => { const x = new XMLHttpRequest(); x.open('GET', '/wr-cancel?xhr'); x.onerror = () => res('error'); x.onload = () => res('loaded'); x.send(); }));
    await wait(50);
    return { cancel, redirected: redirect.query.wr, header: hdr.sent, responseHeader: hdr.added, xhr, completed: (events['webRequest.onCompleted'] || []).length > 0 };
  });
  await check('declarativeNetRequest', async () => {
    await chrome.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: true });
    const blocked = await page(() => fetch('/dnr-block/a').then(() => 'loaded', (e) => e.name));
    const redirected = await page(() => fetch('/dnr-redirect/abc').then((r) => r.json()));
    const hdr = await page(() => fetch('/echo?dnrhdr').then(async (r) => ({ req: (await r.json()).headers['x-dnr'], res: r.headers.get('x-dnr-response') })));
    const img = await page(() => new Promise((res) => { const i = new Image(); i.onerror = () => res('error'); i.onload = () => res('load'); i.src = '/dnr-block/pic.png'; }));
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: [{ id: 10, priority: 2, action: { type: 'block' }, condition: { urlFilter: '||example.net^', resourceTypes: ['xmlhttprequest'] } }] });
    const dyn = await chrome.declarativeNetRequest.getDynamicRules();
    const outcome = await chrome.declarativeNetRequest.testMatchOutcome({ url: 'https://sub.example.net/x', type: 'xmlhttprequest', tabId: tab.id });
    const matched = await chrome.declarativeNetRequest.getMatchedRules({ tabId: tab.id });
    const badge = await chrome.action.getBadgeText({ tabId: tab.id });
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [10] });
    return { blocked, redirected: redirected.query.redirected, reqHeader: hdr.req, resHeader: hdr.res, img, dynamic: dyn.length, outcome: outcome.matchedRules.map((r) => r.ruleId), matched: matched.rulesMatchedInfo.length > 0, badge };
  });
  await check('declarativeContent', async () => {
    await chrome.action.disable();
    await new Promise((r) => chrome.declarativeContent.onPageChanged.removeRules(undefined, r));
    await new Promise((r) => chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [new chrome.declarativeContent.PageStateMatcher({ css: ['#p1'] })],
      actions: [new chrome.declarativeContent.ShowAction()],
    }], r));
    await wait(50);
    const enabled = await chrome.action.isEnabled(tab.id);
    const rules = await new Promise((r) => chrome.declarativeContent.onPageChanged.getRules(r));
    await chrome.action.enable();
    return { enabled, rules: rules.length };
  });
  await check('userScripts', async () => {
    await chrome.userScripts.configureWorld({ messaging: true });
    const [r] = await chrome.userScripts.execute({ target: { tabId: tab.id }, js: [{ code: 'document.title + " / " + typeof chrome.runtime.sendMessage' }] });
    await chrome.userScripts.register([{ id: 'probe', matches: ['<all_urls>'], js: [{ code: 'console.log(1)' }] }]);
    const scripts = await chrome.userScripts.getScripts();
    await chrome.userScripts.unregister({ ids: ['probe'] });
    return { result: r.result, registered: scripts.map((s) => s.id) };
  });
  await check('find', async () => {
    const r = await browser.find.find('fox', { includeRangeData: true });
    await browser.find.highlightResults({ rangeIndex: 1, noScroll: true });
    const hl = await page(() => (window.CSS && CSS.highlights ? CSS.highlights.has('extshim-find') : 'n/a'));
    await browser.find.removeHighlighting();
    return { count: r.count, ranges: r.rangeData.length, highlighted: hl };
  });
  await check('theme', async () => {
    await browser.theme.update({ colors: { popup: '#123456', popup_text: '#ffffff' } });
    return (await browser.theme.getCurrent()).colors.popup;
  });
  await check('pageCapture', async () => {
    const blob = await chrome.pageCapture.saveAsMHTML({ tabId: tab.id });
    const text = await blob.text();
    return { type: blob.type, hasTitle: text.includes('ExtShim test page'), boundary: /boundary="/.test(text) };
  });
  await check('system', async () => {
    const cpu = await chrome.system.cpu.getInfo();
    const mem = await chrome.system.memory.getInfo();
    const st = await chrome.system.storage.getInfo();
    const disp = await chrome.system.display.getInfo();
    return { cpus: cpu.numOfProcessors > 0, memory: mem.capacity > 0, storage: st.length, displays: disp.length, width: disp[0].bounds.width > 0 };
  });
  await check('power', async () => { chrome.power.requestKeepAwake('display'); chrome.power.releaseKeepAwake(); return true; });
  await check('publicSuffix', async () => [await chrome.publicSuffix.getDomain('https://a.b.example.co.uk/x'), await chrome.publicSuffix.getKnownSuffix('https://x.github.io/')]);
  await check('debugger', async () => {
    const target = { tabId: tab.id };
    await chrome.debugger.attach(target, '1.3');
    const ev = await chrome.debugger.sendCommand(target, 'Runtime.evaluate', { expression: '6 * 7', returnByValue: true });
    const doc = await chrome.debugger.sendCommand(target, 'DOM.getDocument', { depth: 1 });
    const q = await chrome.debugger.sendCommand(target, 'DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#p1' });
    const html = await chrome.debugger.sendCommand(target, 'DOM.getOuterHTML', { nodeId: q.nodeId });
    await page(() => document.getElementById('inp').focus());
    await chrome.debugger.sendCommand(target, 'Input.insertText', { text: 'typed-by-cdp' });
    let unknown = null;
    try { await chrome.debugger.sendCommand(target, 'Foo.bar', {}); } catch (e) { unknown = e.message; }
    await chrome.debugger.detach(target);
    return { value: ev.result.value, html: html.outerHTML.startsWith('<p id="p1">'), typed: await page(() => document.getElementById('inp').value), unknown };
  });
  await check('identity', async () => [chrome.identity.getRedirectURL('cb'), (await chrome.instanceID.getID()).length, typeof (await chrome.gcm.register(['1']))]);
  await check('ttsEngine', async () => {
    await new Promise((resolve) => chrome.tts.speak('hello engine', { voiceName: 'Probe Voice', onEvent: (e) => { if (e.type === 'end') resolve(); } }));
    const voices = await chrome.tts.getVoices();
    return { spoken: (events['ttsEngine.onSpeak'] || []).map((a) => a[0]), hasVoice: voices.some((v) => v.voiceName === 'Probe Voice') };
  });
  await check('webAuthenticationProxy', async () => {
    await chrome.webAuthenticationProxy.attach();
    const id = await page(() => navigator.credentials.get({ publicKey: { challenge: new Uint8Array([1, 2, 3]) } }).then((c) => c.id + '/' + c.rawId.byteLength));
    await chrome.webAuthenticationProxy.detach();
    return id;
  });
  await check('inputIme', async () => {
    await page(() => { const i = document.getElementById('inp'); i.value = ''; i.blur(); i.focus(); });
    await wait(30);
    await chrome.input.ime.commitText({ contextID: self.imeContext, text: 'ime-text' });
    return page(() => document.getElementById('inp').value);
  });
  await check('audio', async () => Array.isArray(await chrome.audio.getDevices()));
  await check('enterprise', async () => { const [t] = await chrome.enterprise.platformKeys.getTokens(); return [t.id, typeof t.subtleCrypto.digest]; });
  await check('management', async () => (await chrome.management.getAll()).length >= 1);
  await check('search', async () => (await browser.search.get()).find((e) => e.isDefault).name);
  await check('containers', async () => (await browser.contextualIdentities.query({})).map((c) => c.name));
  await check('packageDir', async () => new Promise((resolve) => chrome.runtime.getPackageDirectoryEntry((dir) => dir.createReader().readEntries((es) => resolve(es.map((e) => e.name).sort())))));
  await check('enums', async () => [chrome.runtime.OnInstalledReason.INSTALL, chrome.tabGroups.Color.GREEN, chrome.declarativeNetRequest.RuleActionType.BLOCK]);
  return results;
}
