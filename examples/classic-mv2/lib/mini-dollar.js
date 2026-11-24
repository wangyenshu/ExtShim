// A tiny jQuery-like helper defined with a top-level function declaration.
function $(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
