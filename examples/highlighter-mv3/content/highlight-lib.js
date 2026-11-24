// Shared helpers. Declared at top level, used by content.js (another file of the same world).
const MARK_CLASS = 'wh-mark';

function clearHighlights(root = document.body) {
  for (const m of root.querySelectorAll('mark.' + MARK_CLASS)) {
    m.replaceWith(document.createTextNode(m.textContent));
  }
  root.normalize();
}

function highlightAll(term, color, root = document.body) {
  clearHighlights(root);
  if (!term) return 0;
  const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest('script,style,textarea,input,mark') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let count = 0;
  for (const node of nodes) {
    const text = node.nodeValue;
    re.lastIndex = 0;
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      frag.append(text.slice(last, m.index));
      const mark = document.createElement('mark');
      mark.className = MARK_CLASS;
      mark.style.backgroundColor = color;
      mark.textContent = m[0];
      frag.append(mark);
      last = m.index + m[0].length;
      count++;
    }
    frag.append(text.slice(last));
    node.replaceWith(frag);
  }
  return count;
}
