import { wordCount } from './lib/notes.js';
const out = document.getElementById('out');
document.getElementById('add').onclick = async () => {
  const text = document.getElementById('text').value;
  const res = await chrome.runtime.sendMessage({ type: 'add', text });
  out.textContent = `Saved (${res.count} notes, ${wordCount(text)} words).`;
};
document.getElementById('side').onclick = async () => {
  const win = await chrome.windows.getCurrent();
  await chrome.sidePanel.open({ windowId: win.id });
  window.close();
};
document.body.dataset.ready = '1';
