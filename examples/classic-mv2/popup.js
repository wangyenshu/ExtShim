var bg = chrome.extension.getBackgroundPage();
var s = bg.getStats();
document.getElementById('last').textContent = s.last ? s.last.text + ' (' + s.last.words + ' words)' : '—';
document.getElementById('seen').textContent = s.pagesSeen;
document.getElementById('lifetime').textContent = s.lifetime;
document.getElementById('wpm').textContent = bg.WORDS_PER_MINUTE + ' wpm';
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  document.body.dataset.tab = tabs[0].title;
});
