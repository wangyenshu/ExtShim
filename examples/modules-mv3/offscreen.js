chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target !== 'offscreen') return;
  const doc = new DOMParser().parseFromString(msg.html, 'text/html');
  sendResponse({ title: doc.title, paragraphs: doc.querySelectorAll('p').length });
});
