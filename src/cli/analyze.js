// Precise top-level declaration analysis for classic scripts (used by the CLI).
import * as acorn from 'acorn';

function patternNames(node, out) {
  if (!node) return;
  switch (node.type) {
    case 'Identifier': out.add(node.name); break;
    case 'ObjectPattern':
      for (const p of node.properties) patternNames(p.type === 'RestElement' ? p.argument : p.value, out);
      break;
    case 'ArrayPattern': for (const e of node.elements) patternNames(e, out); break;
    case 'RestElement': patternNames(node.argument, out); break;
    case 'AssignmentPattern': patternNames(node.left, out); break;
  }
}

// Collect `var` declarations hoisted out of nested blocks (but not out of functions).
function hoistedVars(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((n) => hoistedVars(n, out)); return; }
  if (/Function/.test(node.type) || node.type === 'ClassBody' || node.type === 'StaticBlock') return;
  if (node.type === 'VariableDeclaration' && node.kind === 'var') node.declarations.forEach((d) => patternNames(d.id, out));
  for (const k in node) {
    if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
    const v = node[k];
    if (v && typeof v === 'object') hoistedVars(v, out);
  }
}

/**
 * @param {string} src classic script source
 * @param {{nested?: boolean}} [opts] include var declarations hoisted from nested blocks (default true)
 * @returns {{names: string[]}}
 */
export function analyzeWithAcorn(src, opts = {}) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, allowReturnOutsideFunction: false });
  const names = new Set();
  for (const stmt of ast.body) {
    if (stmt.type === 'VariableDeclaration') stmt.declarations.forEach((d) => patternNames(d.id, names));
    else if (stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') { if (stmt.id) names.add(stmt.id.name); }
    else if ((stmt.type === 'ForStatement' || stmt.type === 'ForInStatement' || stmt.type === 'ForOfStatement')) {
      const init = stmt.init || stmt.left;
      if (init && init.type === 'VariableDeclaration' && init.kind === 'var') init.declarations.forEach((d) => patternNames(d.id, names));
      if (opts.nested !== false) hoistedVars(stmt.body, names);
    } else if (opts.nested !== false) hoistedVars(stmt, names);
  }
  return { names: [...names] };
}

/** Does the source parse as a classic script? */
export function isClassicScript(src) {
  try { acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true }); return true; } catch { return false; }
}
