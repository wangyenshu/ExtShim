// Service worker: context menu, badge, notifications, commands, alarms.
const DEFAULTS = { color: '#ffe066', history: [] };

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'highlight-selection', title: chrome.i18n.getMessage('menuHighlight'), contexts: ['selection'] });
    chrome.contextMenus.create({ id: 'clear', title: chrome.i18n.getMessage('menuClear'), contexts: ['page', 'action'] });
  });
  chrome.storage.sync.get(DEFAULTS).then((v) => chrome.storage.sync.set(v));
  console.log('Installed:', reason);
});

async function highlightInTab(tabId, term) {
  const { color } = await chrome.storage.sync.get(DEFAULTS);
  const res = await chrome.tabs.sendMessage(tabId, { type: 'highlight', term, color });
  await chrome.action.setBadgeText({ tabId, text: res && res.count ? String(res.count) : '' });
  return res;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'highlight-selection') {
    const res = await highlightInTab(tab.id, info.selectionText);
    chrome.notifications.create('hl', {
      type: 'basic', iconUrl: 'icons/icon128.png', title: chrome.i18n.getMessage('notifTitle'),
      message: chrome.i18n.getMessage('notifBody', [String(res.count), info.selectionText]),
    });
  } else if (info.menuItemId === 'clear') {
    await chrome.tabs.sendMessage(tab.id, { type: 'clear' });
    chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'clear-highlights') {
    await chrome.tabs.sendMessage(tab.id, { type: 'clear' });
    chrome.action.setBadgeText({ text: '' });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'highlight-request') {
    highlightInTab(msg.tabId ?? sender.tab.id, msg.term).then(sendResponse);
    return true; // keep the channel open for the async response
  }
  if (msg.type === 'count-update' && sender.tab) {
    chrome.action.setBadgeBackgroundColor({ color: '#3b5bdb' });
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: msg.count ? String(msg.count) : '' });
  }
  if (msg.type === 'ping') sendResponse({ pong: true, from: 'background', url: self.location.href });
});

chrome.alarms.create('heartbeat', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((a) => console.log('alarm', a.name));
