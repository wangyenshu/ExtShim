const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
  $('heading').textContent = chrome.i18n.getMessage('popupHeading');
  $('go').textContent = chrome.i18n.getMessage('popupButton');
  const { color } = await chrome.storage.sync.get({ color: '#ffe066' });
  $('color').value = color;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const state = await chrome.tabs.sendMessage(tab.id, { type: 'state' }).catch(() => null);
  if (state && state.term) {
    $('term').value = state.term;
    $('result').textContent = chrome.i18n.getMessage('matches', [String(state.count)]);
  }
  document.body.dataset.ready = '1';
});

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const res = await chrome.runtime.sendMessage({ type: 'highlight-request', tabId: tab.id, term: $('term').value });
  $('result').textContent = chrome.i18n.getMessage('matches', [String(res.count)]);
});

$('color').addEventListener('change', () => chrome.storage.sync.set({ color: $('color').value }));

$('count').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [r] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (minLen) => document.body.innerText.split(/\s+/).filter((w) => w.length >= minLen).length,
    args: [1],
  });
  $('result').textContent = `${r.result} words on “${tab.title}”`;
});

$('options').addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
