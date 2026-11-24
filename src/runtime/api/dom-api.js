// chrome.dom (always available, including in content scripts).
import { defineNamespace, defineStartup } from './registry.js';

// ------------------------------------------------------------------ dom (Chrome)

const closedRoots = new WeakMap();
let shadowHooked = false;
/** Record closed shadow roots created from now on (chrome.dom.openOrClosedShadowRoot). */
export function hookShadowRoots() {
  if (shadowHooked || typeof Element === 'undefined') return;
  shadowHooked = true;
  const orig = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function attachShadow(init) {
    const root = orig.call(this, init);
    if (init && init.mode === 'closed') closedRoots.set(this, root);
    return root;
  };
  Object.defineProperty(Element.prototype.attachShadow, 'toString', { value: () => 'function attachShadow() { [native code] }' });
}

export function domApi() {
  return {
    openOrClosedShadowRoot: (el) => {
      if (!(el instanceof Element)) throw new TypeError('Error in invocation of dom.openOrClosedShadowRoot: element must be an HTMLElement.');
      return el.shadowRoot || closedRoots.get(el) || null;
    },
  };
}
defineStartup(() => hookShadowRoots());

defineNamespace('dom', domApi, { always: true, contexts: 'all' });
