// runtime/tabs messaging: one-shot messages and long-lived ports between contexts.
import { ExtEvent, nextTask } from './events.js';

export const NO_RESPONSE = Symbol('no-response');
const NO_RECEIVER = 'Could not establish connection. Receiving end does not exist.';

export function cloneMessage(v, mode = 'json') {
  if (v === undefined) return undefined;
  if (mode === 'structured' && typeof structuredClone === 'function') return structuredClone(v);
  const s = JSON.stringify(v);
  return s === undefined ? undefined : JSON.parse(s);
}

export class Bus {
  constructor(ext) {
    this.ext = ext;
  }

  _targets(from, target) {
    const ext = this.ext;
    return [...ext.contexts].filter((c) => {
      if (!c.alive || c === from) return false;
      if (target.tabId == null) return c.isExtensionPage;
      return c.type === 'content' && c.tabId === target.tabId && (target.frameId == null || c.frameId === target.frameId) &&
        (target.documentId == null || c.documentId === target.documentId);
    });
  }

  /** @returns {Promise<any>} resolves with the response, NO_RESPONSE, or rejects when nobody listens. */
  send(from, message, target = {}) {
    const mode = this.ext.options.messageSerialization;
    let data;
    try { data = cloneMessage(message, mode); } catch (e) { return Promise.reject(new Error('Could not serialize message.')); }
    const sender = from.sender();
    return new Promise((resolve, reject) => {
      nextTask(async () => {
        if (target.tabId == null) await this.ext.whenBackgroundReady();
        const targets = this._targets(from, target);
        await Promise.all(targets.map((c) => c.ready));
        const entries = [];
        const evKey = from.userScript ? 'runtime.onUserScriptMessage' : 'runtime.onMessage';
        for (const c of targets) {
          const ev = c.events.get(evKey);
          if (ev && ev.hasListeners()) entries.push([c, ev]);
        }
        if (!entries.length) { reject(new Error(NO_RECEIVER)); return; }
        let done = false;
        let pending = 0;
        const respond = (v) => {
          if (done) return;
          done = true;
          try { resolve(cloneMessage(v, mode)); } catch { reject(new Error('Could not serialize message.')); }
        };
        for (const [c, ev] of entries) {
          if (!c.alive) continue;
          for (const l of [...ev._listeners]) {
            let r;
            try {
              r = l.fn(cloneMessage(data, mode), { ...sender }, (v) => respond(v));
            } catch (e) {
              c.log.error('Error in event handler for runtime.onMessage:', e);
              continue;
            }
            if (r === true) pending++;
            else if (r && typeof r.then === 'function') {
              pending++;
              r.then(respond, (e) => {
                if (done) return;
                done = true;
                reject(new Error(e && e.message ? e.message : String(e)));
              });
            }
          }
        }
        if (!done && pending === 0) { done = true; resolve(NO_RESPONSE); }
      });
    });
  }

  /** Open a port from `from` to the target contexts; returns the opener's Port object. */
  connect(from, { name = '', tabId = null, frameId = null } = {}) {
    const opener = new Port(this, from, name, undefined);
    nextTask(async () => {
      if (tabId == null) await this.ext.whenBackgroundReady();
      const targets = this._targets(from, { tabId, frameId });
      await Promise.all(targets.map((c) => c.ready));
      for (const c of targets) {
        const ev = c.events.get(from.userScript ? 'runtime.onUserScriptConnect' : 'runtime.onConnect');
        if (!ev || !ev.hasListeners() || !opener.connected) continue;
        const rp = new Port(this, c, name, from.sender());
        rp.peers.add(opener);
        opener.peers.add(rp);
        ev.dispatch(rp.api);
      }
      opener.established = true;
      if (!opener.peers.size) opener._remoteDisconnect(NO_RECEIVER);
      else opener._flush();
    });
    return opener.api;
  }
}

class Port {
  constructor(bus, ctx, name, sender) {
    this.bus = bus;
    this.ctx = ctx;
    this.peers = new Set();
    this.connected = true;
    this.established = sender !== undefined; // receiving ports are established immediately
    this.queue = [];
    const onMessage = new ExtEvent('Port.onMessage', ctx.log);
    const onDisconnect = new ExtEvent('Port.onDisconnect', ctx.log);
    this.onMessage = onMessage;
    this.onDisconnect = onDisconnect;
    const self = this;
    this.api = {
      name,
      sender,
      onMessage,
      onDisconnect,
      postMessage(msg) { self.post(msg); },
      disconnect() { self.disconnect(); },
    };
    if (sender === undefined) delete this.api.sender;
    ctx.ports.add(this);
  }
  post(msg) {
    if (!this.connected) throw new Error('Attempting to use a disconnected port object');
    const data = cloneMessage(msg, this.bus.ext.options.messageSerialization);
    if (!this.established) { this.queue.push(data); return; }
    for (const p of this.peers) {
      nextTask(() => { if (p.connected && p.ctx.alive) p.onMessage.dispatch(cloneMessage(data), p.api); });
    }
  }
  _flush() {
    const q = this.queue.splice(0);
    for (const m of q) this.post(m);
  }
  disconnect() {
    if (!this.connected) return;
    this.connected = false;
    this.ctx.ports.delete(this);
    for (const p of this.peers) {
      p.peers.delete(this);
      if (!p.peers.size) nextTask(() => p._remoteDisconnect());
    }
    this.peers.clear();
  }
  _remoteDisconnect(error) {
    if (!this.connected) return;
    this.connected = false;
    this.ctx.ports.delete(this);
    if (!this.ctx.alive) return;
    if (error) this.ctx.withLastError(error, () => this.onDisconnect.dispatch(this.api));
    else this.onDisconnect.dispatch(this.api);
  }
}
