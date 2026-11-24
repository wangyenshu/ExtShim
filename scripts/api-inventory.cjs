// Extract every API member (functions, events, properties, enums, classes) from
// @types/chrome and @types/firefox-webext-browser into test/api-inventory.json.
// Usage: node scripts/api-inventory.cjs <dir containing node_modules/@types>
const fs = require('fs');
const path = require('path');
const ts = require(require.resolve('typescript', { paths: [path.resolve(process.argv[2] || process.cwd())] }));
const base = path.resolve(process.argv[2] || process.cwd());

function collect(file, rootName) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const out = [];
  const interfaces = new Map(); // "ns.Name" -> InterfaceDeclaration
  const nsOf = (node) => {
    const parts = [];
    for (let p = node.parent; p; p = p.parent) if (ts.isModuleDeclaration(p)) parts.unshift(p.name.text);
    return parts.join('.');
  };
  const isEventType = (t) => /(^|\.)(Event|events\.Event|WebExtEvent)\b|Event<|Event$/.test(t) && !/^(MouseEvent|KeyboardEvent)/.test(t);
  // First pass: index interfaces / type aliases.
  (function index(node) {
    if (ts.isInterfaceDeclaration(node)) interfaces.set(nsOf(node) + '.' + node.name.text, node);
    ts.forEachChild(node, index);
  })(src);
  const resolveIface = (ns, typeText) => {
    const name = typeText.replace(/<.*$/, '');
    let n = ns;
    while (true) {
      if (interfaces.has(n + '.' + name)) return interfaces.get(n + '.' + name);
      if (!n.includes('.')) break;
      n = n.slice(0, n.lastIndexOf('.'));
    }
    return interfaces.get(name.includes('.') ? (ns.split('.')[0] + '.' + name) : '') || null;
  };
  const expand = (ns, prefix, iface, depth) => {
    for (const m of iface.members) {
      if (!m.name || !m.name.text && !m.name.escapedText) continue;
      const name = m.name.text || m.name.escapedText;
      const p = prefix + '.' + name;
      if (ts.isMethodSignature(m)) { out.push({ path: p, kind: 'function' }); continue; }
      if (!ts.isPropertySignature(m) || !m.type) continue;
      const t = m.type.getText(src);
      if (isEventType(t)) out.push({ path: p, kind: 'event' });
      else if (/ChromeSetting|types\.Setting|Setting</.test(t)) out.push({ path: p, kind: 'setting' });
      else if (ts.isFunctionTypeNode(m.type)) out.push({ path: p, kind: 'function' });
      else {
        const sub = depth < 2 && resolveIface(ns, t);
        if (sub && sub.members.some((x) => x.type && /ChromeSetting|Setting|Event/.test(x.type.getText(src)) || ts.isMethodSignature(x))) expand(ns, p, sub, depth + 1);
      }
    }
  };
  (function walk(node) {
    const ns = nsOf(node);
    const exported = node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const inRoot = ns === rootName || ns.startsWith(rootName + '.');
    if (inRoot && ns !== rootName && (exported || ts.isModuleBlock(node.parent))) {
      if (ts.isFunctionDeclaration(node) && node.name) out.push({ path: `${ns}.${node.name.text}`, kind: 'function' });
      else if (ts.isVariableStatement(node)) {
        for (const d of node.declarationList.declarations) {
          const t = d.type ? d.type.getText(src) : '';
          const p = `${ns}.${d.name.getText(src)}`;
          const iface = d.type && !ts.isTypeLiteralNode(d.type) && resolveIface(ns, t);
          const ifaceIsGroup = iface && iface.members.some((x) => x.type && /ChromeSetting|Setting</.test(x.type.getText(src)));
          if (d.type && ts.isTypeLiteralNode(d.type)) expand(ns, p, d.type, 0);
          else if (ifaceIsGroup) expand(ns, p, iface, 0);
          else if (isEventType(t)) out.push({ path: p, kind: 'event' });
          else if (/ChromeSetting|types\.Setting|Setting</.test(t)) out.push({ path: p, kind: 'setting' });
          else if (d.type && ts.isFunctionTypeNode(d.type)) out.push({ path: p, kind: 'function' });
          else if (iface) expand(ns, p, iface, 0);
          else out.push({ path: p, kind: 'property', type: t });
        }
      } else if (ts.isEnumDeclaration(node)) {
        const values = {};
        let n = 0;
        for (const m of node.members) {
          const k = m.name.getText(src).replace(/^["']|["']$/g, '');
          if (m.initializer) { const t = m.initializer.getText(src); values[k] = /^["'`]/.test(t) ? t.slice(1, -1) : Number(t); if (typeof values[k] === 'number') n = values[k] + 1; }
          else values[k] = n++;
        }
        out.push({ path: `${ns}.${node.name.text}`, kind: 'enum', members: Object.keys(values), values });
      }
      else if (ts.isClassDeclaration(node) && node.name) out.push({ path: `${ns}.${node.name.text}`, kind: 'class' });
    }
    ts.forEachChild(node, walk);
  })(src);
  const seen = new Set();
  return out.filter((e) => !seen.has(e.path) && seen.add(e.path));
}

const chrome = collect(path.join(base, 'node_modules/@types/chrome/index.d.ts'), 'chrome');
const firefox = collect(path.join(base, 'node_modules/@types/firefox-webext-browser/index.d.ts'), 'browser');
const outFile = path.join(__dirname, '..', 'test', 'api-inventory.json');
// Generated enum table for the runtime.
const enums = {};
for (const e of chrome) if (e.kind === 'enum') enums[e.path.split('.').slice(1).join('.').replace(/^_debugger/, 'debugger')] = e.values;
fs.writeFileSync(path.join(__dirname, '..', 'src', 'runtime', 'api', 'enums.js'),
  '// Generated by scripts/api-inventory.cjs from @types/chrome. Do not edit.\n// namespace path -> { MEMBER: value }\nexport const ENUMS = ' + JSON.stringify(enums) + ';\n');
fs.writeFileSync(outFile, JSON.stringify({ generatedFrom: { chrome: require(path.join(base, 'node_modules/@types/chrome/package.json')).version, firefox: require(path.join(base, 'node_modules/@types/firefox-webext-browser/package.json')).version }, chrome, firefox }, null, 0));
const count = (l, k) => l.filter((e) => e.kind === k).length;
const nss = (l) => new Set(l.map((e) => e.path.split('.').slice(1, -1).join('.'))).size;
console.log(`chrome: ${chrome.length} members in ${nss(chrome)} namespaces (${count(chrome, 'function')} functions, ${count(chrome, 'event')} events, ${count(chrome, 'setting')} settings, ${count(chrome, 'enum')} enums, ${count(chrome, 'class')} classes, ${count(chrome, 'property')} properties)`);
console.log(`firefox: ${firefox.length} members in ${nss(firefox)} namespaces (${count(firefox, 'function')} functions, ${count(firefox, 'event')} events, ${count(firefox, 'setting')} settings, ${count(firefox, 'enum')} enums, ${count(firefox, 'property')} properties)`);
