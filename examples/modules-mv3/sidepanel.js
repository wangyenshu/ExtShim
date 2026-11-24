const list = document.getElementById('list');
async function render() {
  const notes = await chrome.runtime.sendMessage({ type: 'list' });
  list.replaceChildren(...notes.map((n) => Object.assign(document.createElement('li'), { textContent: n.text })));
  document.body.dataset.count = String(notes.length);
}
chrome.storage.onChanged.addListener(render);
render();
document.getElementById('parse').onclick = async () => {
  const r = await chrome.runtime.sendMessage({ type: 'parse', html: '<html><head><title>Parsed &amp; fine</title></head><body><p>x</p></body></html>' });
  document.getElementById('parsed').textContent = r.title;
};
