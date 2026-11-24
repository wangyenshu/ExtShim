// Content-script side of the probe.
self.csShadow = () => {
  const host = document.getElementById('closed-host');
  const root = chrome.dom.openOrClosedShadowRoot(host);
  return root ? root.querySelector('span').textContent : null;
};
document.documentElement.dataset.probeCs = '1';
