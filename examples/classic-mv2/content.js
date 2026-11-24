/* global $ */ // from lib/mini-dollar.js (listed first in the content script)
var words = $('p, li, h1, h2, h3, td').map(function (el) { return el.textContent; }).join(' ').split(/\s+/).filter(Boolean).length;
var port = chrome.runtime.connect({ name: 'reader' });
port.onMessage.addListener(function (msg) {
  var bar = document.createElement('div');
  bar.id = 'reading-timer-bar';
  bar.textContent = '⏱ ' + msg.reply + ' read';
  bar.style.cssText = 'position:fixed;left:12px;bottom:12px;padding:6px 10px;background:#063;color:#fff;font:12px system-ui;border-radius:6px;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,.3)';
  bar.dataset.sender = msg.sender;
  document.body.appendChild(bar);
});
port.postMessage({ words: words, title: document.title });

var img = document.createElement('img');
img.id = 'reading-timer-logo';
img.src = chrome.extension.getURL('icons/icon16.png');
img.style.cssText = 'position:fixed;left:-100px;top:0';
document.body.appendChild(img);
