// Lightweight scanner that finds the names a classic script declares at its top level
// (var / let / const / function / class, including destructuring patterns).
//
// Extension scripts that share one "world" (several content scripts, or a background
// page made of several files) see each other's top-level declarations. ExtShim runs each
// file inside a function wrapper, so it needs to know these names to re-expose them.
// The CLI uses acorn for this; the runtime (and the in-browser builder) use this scanner,
// which is validated against acorn in test/unit.mjs.

const PUNCS = [
  '>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=',
  '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--', '+=', '-=', '*=', '/=', '%=',
  '&=', '|=', '^=', '**', '<<', '>>',
];
const KEYWORDS_BEFORE_EXPR = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else',
  'yield', 'await', 'extends',
]);
const OPERATOR_KEYWORDS = new Set(['in', 'instanceof', 'of', 'typeof', 'void', 'delete', 'new', 'await', 'yield', 'return', 'throw', 'case', 'extends']);
const ID_START = /[A-Za-z_$\u00a0-\uffff\\]/;
const ID_PART = /[\w$\u00a0-\uffff\\\u200c\u200d]/;

export function tokenize(src) {
  const toks = [];
  const stack = [];
  let i = 0;
  let nl = false;
  const n = src.length;
  const last = () => toks[toks.length - 1];
  const push = (t, v) => { toks.push({ t, v, nl, d: stack.length }); nl = false; };

  const regexAllowed = () => {
    const p = last();
    if (!p) return true;
    if (p.t === 'punc') return !(p.v === ')' || p.v === ']' || p.v === '++' || p.v === '--');
    if (p.t === 'name') return KEYWORDS_BEFORE_EXPR.has(p.v);
    return false;
  };

  // Scan a template literal body starting at i (just after ` or after a closing } of ${}).
  const scanTemplate = () => {
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; push('tmpl', '`'); return; }
      if (c === '$' && src[i + 1] === '{') {
        i += 2;
        push('tmpl', '${');
        stack.push('${');
        return;
      }
      i++;
    }
  };

  if (src.startsWith('#!')) { while (i < n && src[i] !== '\n') i++; }

  while (i < n) {
    const c = src[i];
    const code = src.charCodeAt(i);
    if (c === '\n' || c === '\r' || code === 0x2028 || code === 0x2029) { nl = true; i++; continue; }
    if (c === ' ' || c === '\t' || code === 0xfeff || code === 0xa0 || code === 0x0b || code === 0x0c || (code > 0x7f && /\s/.test(c))) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n' && src[i] !== '\r') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const body = src.slice(i, end < 0 ? n : end);
      if (/[\n\r\u2028\u2029]/.test(body)) nl = true;
      i = end < 0 ? n : end + 2;
      continue;
    }
    if (c === '<' && src.startsWith('<!--', i)) { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '-' && nl && src.startsWith('-->', i)) { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') j++;
        else if (src[j] === '\n') break;
        j++;
      }
      i = j + 1;
      push('str', c);
      continue;
    }
    if (c === '`') { i++; scanTemplate(); continue; }
    if (ID_START.test(c)) {
      let j = i + 1;
      while (j < n && ID_PART.test(src[j])) j++;
      push('name', src.slice(i, j));
      i = j;
      continue;
    }
    if ((c >= '0' && c <= '9') || (c === '.' && src[i + 1] >= '0' && src[i + 1] <= '9')) {
      let j = i + 1;
      while (j < n && /[\w.]/.test(src[j])) {
        if ((src[j] === 'e' || src[j] === 'E') && (src[j + 1] === '+' || src[j + 1] === '-') && !/^0[xX]/.test(src.slice(i, j))) j += 2;
        else j++;
      }
      push('num', src.slice(i, j));
      i = j;
      continue;
    }
    if (c === '/' && regexAllowed()) {
      let j = i + 1;
      let inClass = false;
      while (j < n) {
        const d = src[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '\n') break;
        if (inClass) { if (d === ']') inClass = false; }
        else if (d === '[') inClass = true;
        else if (d === '/') break;
        j++;
      }
      j++;
      while (j < n && ID_PART.test(src[j])) j++;
      push('regex', '/');
      i = j;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') { push('punc', c); stack.push(c); i++; continue; }
    if (c === ')' || c === ']' || c === '}') {
      const top = stack.pop();
      i++;
      if (c === '}' && top === '${') { scanTemplate(); continue; }
      push('punc', c);
      continue;
    }
    let p = c;
    for (const cand of PUNCS) { if (src.startsWith(cand, i)) { p = cand; break; } }
    push('punc', p);
    i += p.length;
  }
  return toks;
}

function endsExpression(t) {
  if (!t) return false;
  if (t.t === 'name') return !OPERATOR_KEYWORDS.has(t.v);
  if (t.t === 'punc') return t.v === ')' || t.v === ']' || t.v === '}';
  if (t.t === 'tmpl') return t.v === '`';
  return true;
}

function startsStatement(t) {
  if (!t) return true;
  if (t.t === 'name') return !OPERATOR_KEYWORDS.has(t.v) || t.v === 'new' || t.v === 'typeof' || t.v === 'void' || t.v === 'delete' || t.v === 'await' || t.v === 'return' || t.v === 'throw';
  return t.t === 'str' || t.t === 'num';
}

/** @returns {{names: string[], ok: boolean}} */
export function scanTopLevelDeclarations(src) {
  let toks;
  try { toks = tokenize(String(src)); } catch { return { names: [], ok: false }; }
  const names = new Set();
  const N = toks.length;

  const isStatementStart = (i) => {
    const p = toks[i - 1];
    if (!p) return true;
    if (p.t === 'punc' && (p.v === ';' || p.v === '}')) return true;
    if (toks[i].nl && endsExpression(p)) return true;
    return false;
  };

  // Skip an expression until a terminator at depth `d` (',' or ';' or closer at d-1, or ASI).
  const skipExpr = (j, d, closer) => {
    for (; j < N; j++) {
      const t = toks[j];
      if (t.d < d) return j;
      if (t.d === d - 1 && closer && t.v === closer) return j;
      if (t.d === d && t.t === 'punc' && (t.v === ',' || t.v === ';')) return j;
      if (d === 0 && t.d === 0 && t.nl && endsExpression(toks[j - 1]) && startsStatement(t)) return j;
    }
    return j;
  };

  const parseTarget = (j) => {
    const t = toks[j];
    if (!t) return j;
    if (t.t === 'name') { names.add(t.v); return j + 1; }
    if (t.v === '{' || t.v === '[') return parsePattern(j);
    return j + 1;
  };

  const parsePattern = (j) => {
    const open = toks[j];
    const D = open.d;
    const closer = open.v === '{' ? '}' : ']';
    j++;
    while (j < N) {
      let t = toks[j];
      if (t.d === D && t.v === closer) return j + 1;
      if (open.v === '[') {
        if (t.v === ',') { j++; continue; }
        if (t.v === '...') j++;
        j = parseTarget(j);
      } else {
        if (t.v === '...') { j = parseTarget(j + 1); }
        else {
          let key = null;
          if (t.v === '[') {
            j++;
            while (j < N && !(toks[j].d === D + 1 && toks[j].v === ']')) j++;
            j++;
          } else { if (t.t === 'name') key = t.v; j++; }
          t = toks[j];
          if (t && t.v === ':') j = parseTarget(j + 1);
          else if (key) names.add(key);
        }
      }
      t = toks[j];
      if (t && t.v === '=') j = skipExpr(j + 1, D + 1, closer);
      t = toks[j];
      if (t && t.v === ',' && t.d === D + 1) j++;
      else if (t && !(t.d === D && t.v === closer)) {
        // Unexpected token: resync to the next separator.
        while (j < N && !(toks[j].d === D + 1 && toks[j].v === ',') && !(toks[j].d === D && toks[j].v === closer)) j++;
        if (toks[j] && toks[j].v === ',') j++;
      }
    }
    return j;
  };

  const parseBindingList = (j, d) => {
    while (j < N) {
      const t = toks[j];
      if (!t || t.d !== d) return j;
      if (t.t === 'name') { names.add(t.v); j++; }
      else if (t.v === '{' || t.v === '[') j = parsePattern(j);
      else return j;
      let u = toks[j];
      if (u && u.t === 'name' && (u.v === 'in' || u.v === 'of')) return j;
      if (u && u.v === '=') j = skipExpr(j + 1, d, d > 0 ? ')' : null);
      u = toks[j];
      if (u && u.d === d && u.v === ',') { j++; continue; }
      return j;
    }
    return j;
  };

  for (let i = 0; i < N; i++) {
    const t = toks[i];
    if (t.d !== 0 || t.t !== 'name') continue;
    const next = toks[i + 1];
    if ((t.v === 'var' || t.v === 'const' || t.v === 'let') && isStatementStart(i)) {
      if (t.v === 'let' && !(next && ((next.t === 'name' && next.v !== 'in' && next.v !== 'instanceof') || next.v === '[' || next.v === '{'))) continue;
      i = parseBindingList(i + 1, 0) - 1;
    } else if (t.v === 'function' && isStatementStart(i)) {
      let j = i + 1;
      if (toks[j] && toks[j].v === '*') j++;
      if (toks[j] && toks[j].t === 'name') names.add(toks[j].v);
    } else if (t.v === 'async' && next && next.v === 'function' && !next.nl && isStatementStart(i)) {
      let j = i + 2;
      if (toks[j] && toks[j].v === '*') j++;
      if (toks[j] && toks[j].t === 'name') names.add(toks[j].v);
      i = j;
    } else if (t.v === 'class' && isStatementStart(i)) {
      if (next && next.t === 'name' && next.v !== 'extends') names.add(next.v);
    } else if (t.v === 'for' && next && next.v === '(') {
      const v = toks[i + 2];
      if (v && v.v === 'var' && v.d === 1) parseBindingList(i + 3, 1);
    }
  }
  return { names: [...names], ok: true };
}
