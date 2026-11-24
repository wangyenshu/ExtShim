/* global WORDS_PER_MINUTE: writable, formatMinutes */ // from lib/format.js (listed first in manifest background.scripts)
var pagesSeen = 0;
var lastReport = null;

function getStats() {
  return { pagesSeen: pagesSeen, last: lastReport, wpm: WORDS_PER_MINUTE, lifetime: Number(localStorage.getItem('lifetime') || 0) };
}

chrome.runtime.onConnect.addListener(function (port) {
  if (port.name !== 'reader') return;
  port.onMessage.addListener(function (msg) {
    if (msg.words != null) {
      pagesSeen++;
      localStorage.setItem('lifetime', String(Number(localStorage.getItem('lifetime') || 0) + 1));
      var minutes = msg.words / WORDS_PER_MINUTE;
      lastReport = { title: msg.title, words: msg.words, text: formatMinutes(minutes) };
      chrome.browserAction.setBadgeText({ text: String(Math.max(1, Math.round(minutes))) });
      chrome.browserAction.setBadgeBackgroundColor({ color: [0, 128, 96, 255] });
      port.postMessage({ reply: lastReport.text, sender: port.sender && port.sender.tab ? 'tab' : 'unknown' });
    }
  });
});

chrome.contextMenus.create({
  id: 'speed',
  title: 'Reading speed',
  contexts: ['all'],
});
['180', '230', '300'].forEach(function (wpm) {
  chrome.contextMenus.create({
    id: 'wpm-' + wpm, parentId: 'speed', type: 'radio', checked: wpm === '230', title: wpm + ' words/min', contexts: ['all'],
    onclick: function () { WORDS_PER_MINUTE = Number(wpm); },
  });
});
