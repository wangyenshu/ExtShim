// Minimal ZIP / CRX reader. Works in browsers (DecompressionStream) and Node (pass zlib inflateRawSync).

function u16(b, o) { return b[o] | (b[o + 1] << 8); }
function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

/** Strip a CRX2/CRX3 header if present and return the embedded ZIP bytes. */
export function crxToZip(bytes) {
  if (bytes[0] === 0x43 && bytes[1] === 0x72 && bytes[2] === 0x32 && bytes[3] === 0x34) { // "Cr24"
    const version = u32(bytes, 4);
    if (version === 2) return bytes.subarray(16 + u32(bytes, 8) + u32(bytes, 12));
    if (version === 3) return bytes.subarray(12 + u32(bytes, 8));
    throw new Error('Unsupported CRX version ' + version);
  }
  return bytes;
}

export function isZipLike(bytes) {
  return (bytes[0] === 0x50 && bytes[1] === 0x4b) || (bytes[0] === 0x43 && bytes[1] === 0x72 && bytes[2] === 0x32 && bytes[3] === 0x34);
}

async function inflateRawBrowser(data) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([data]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * @param {Uint8Array} input zip or crx bytes
 * @param {{inflateRaw?: (data: Uint8Array) => Uint8Array|Promise<Uint8Array>}} [opts]
 * @returns {Promise<Map<string, Uint8Array>>} path -> bytes (directories omitted)
 */
export async function readZip(input, opts = {}) {
  const bytes = crxToZip(input instanceof Uint8Array ? input : new Uint8Array(input));
  const inflate = opts.inflateRaw || inflateRawBrowser;
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip file (end of central directory not found)');
  const count = u16(bytes, eocd + 10);
  let p = u32(bytes, eocd + 16);
  const files = new Map();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (u32(bytes, p) !== 0x02014b50) throw new Error('Corrupt zip central directory');
    const flags = u16(bytes, p + 8);
    const method = u16(bytes, p + 10);
    const compSize = u32(bytes, p + 20);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const localOff = u32(bytes, p + 42);
    const nameBytes = bytes.subarray(p + 46, p + 46 + nameLen);
    const name = (flags & 0x800) ? dec.decode(nameBytes) : Array.from(nameBytes, (c) => String.fromCharCode(c)).join('');
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    if (flags & 1) throw new Error('Encrypted zip entries are not supported: ' + name);
    const lh = localOff;
    if (u32(bytes, lh) !== 0x04034b50) throw new Error('Corrupt zip local header for ' + name);
    const start = lh + 30 + u16(bytes, lh + 26) + u16(bytes, lh + 28);
    const raw = bytes.subarray(start, start + compSize);
    let data;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = await inflate(raw);
    else throw new Error(`Unsupported zip compression method ${method} for ${name}`);
    files.set(name.replace(/\\/g, '/'), data instanceof Uint8Array ? data : new Uint8Array(data));
  }
  return files;
}

/**
 * Find manifest.json in a file map and strip any wrapping folder
 * (e.g. GitHub "repo-main/" archives). Ignores __MACOSX and nested node_modules.
 */
export function rootFiles(files) {
  const candidates = [...files.keys()]
    .filter((k) => /(^|\/)manifest\.json$/.test(k) && !/(^|\/)(__MACOSX|node_modules)\//.test(k))
    .sort((a, b) => a.split('/').length - b.split('/').length);
  if (!candidates.length) throw new Error('manifest.json not found');
  const prefix = candidates[0].slice(0, -'manifest.json'.length);
  const out = new Map();
  for (const [k, v] of files) {
    if (!k.startsWith(prefix) || /(^|\/)__MACOSX\//.test(k) || /(^|\/)\.DS_Store$/.test(k)) continue;
    out.set(k.slice(prefix.length), v);
  }
  return out;
}
