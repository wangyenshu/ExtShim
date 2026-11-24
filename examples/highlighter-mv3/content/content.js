// Content script: uses highlightAll() from highlight-lib.js.
/* global highlightAll, clearHighlights, MARK_CLASS */
let lastTerm = '';
window.extensionMarker = 'set-by-content-script'; // must NOT leak into the page

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'highlight') {
    lastTerm = msg.term;
    const count = highlightAll(msg.term, msg.color);
    sendResponse({ count, term: lastTerm });
  } else if (msg.type === 'clear') {
    clearHighlights();
    sendResponse({ ok: true });
  } else if (msg.type === 'state') {
    sendResponse({ term: lastTerm, count: document.querySelectorAll('mark.' + MARK_CLASS).length, title: document.title });
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.color && lastTerm) {
    const count = highlightAll(lastTerm, changes.color.newValue);
    chrome.runtime.sendMessage({ type: 'count-update', count });
  }
});

// Page <-> content-script messaging, the classic window.postMessage pattern.
window.addEventListener('message', (e) => {
  if (e.source !== window || !e.data || e.data.type !== 'page-asks-highlight') return;
  const count = highlightAll(e.data.term, '#a5d8ff');
  window.postMessage({ type: 'content-did-highlight', count }, '*');
});

document.documentElement.dataset.highlighterReady = chrome.runtime.id;
