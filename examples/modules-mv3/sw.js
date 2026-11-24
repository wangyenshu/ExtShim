import { addNote, getNotes, wordCount } from './lib/notes.js';
import { VERSION } from './lib/version.js';

self.addEventListener('install', () => console.log('[sw] install', VERSION));
self.addEventListener('activate', () => console.log('[sw] activate'));

async function parseWithOffscreen(html) {
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['DOM_PARSER'], justification: 'Parse HTML' });
  }
  return chrome.runtime.sendMessage({ target: 'offscreen', html });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target === 'offscreen') return; // handled by the offscreen document
  (async () => {
    if (msg.type === 'add') sendResponse({ count: await addNote(msg.text), words: wordCount(msg.text) });
    else if (msg.type === 'list') sendResponse(await getNotes());
    else if (msg.type === 'parse') sendResponse(await parseWithOffscreen(msg.html));
    else if (msg.type === 'whoami') sendResponse({ hasWindow: typeof window !== 'undefined', hasDocument: typeof document !== 'undefined', url: self.location.href, version: VERSION });
  })();
  return true;
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
