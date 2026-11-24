chrome.devtools.panels.create('Probe panel', '', 'panel.html', (panel) => {
  panel.onShown.addListener((win) => { win.document.body.dataset.shown = '1'; });
});
chrome.devtools.inspectedWindow.eval('document.title', (result, exc) => {
  chrome.storage.session.set({ devtoolsEval: exc ? 'ERR ' + JSON.stringify(exc) : result });
});
chrome.devtools.network.getHAR((har) => chrome.storage.session.set({ harEntries: har.entries.length }));
