const color = document.getElementById('color');
const notify = document.getElementById('notify');
document.getElementById('id').textContent = chrome.runtime.id;
chrome.storage.sync.get({ color: '#ffe066', notify: true }, (v) => {
  color.value = v.color;
  notify.checked = v.notify;
});
document.getElementById('save').addEventListener('click', () => {
  chrome.storage.sync.set({ color: color.value, notify: notify.checked }, () => {
    document.getElementById('saved').textContent = 'Saved.';
    setTimeout(() => { document.getElementById('saved').textContent = ''; }, 1500);
  });
});
