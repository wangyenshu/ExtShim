// Screen/tab capture through getDisplayMedia (the page asks the user, like a share prompt).
// Backs tabs.captureVisibleTab / captureTab, tabCapture, desktopCapture and debugger screenshots.

const streams = new Map(); // streamId -> MediaStream (desktopCapture / tabCapture.getMediaStreamId)

export async function displayStream({ video = true, audio = false, currentTab = true } = {}) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) throw new Error('Screen capture is not available in this browser.');
  const opts = { video: video === true ? { displaySurface: currentTab ? 'browser' : undefined } : video, audio: !!audio };
  if (currentTab) Object.assign(opts, { preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude' });
  try {
    return await navigator.mediaDevices.getDisplayMedia(opts);
  } catch (e) {
    if (e && e.name === 'NotAllowedError') throw new Error('The user declined to share the screen.', { cause: e });
    if (e && e.name === 'InvalidStateError') throw new Error('Screen capture needs a recent user gesture (for example a click in the popup).', { cause: e });
    throw e;
  }
}

export async function grabFrame(stream) {
  const track = stream.getVideoTracks()[0];
  if (!track) throw new Error('No video track to capture.');
  if (typeof ImageCapture === 'function') {
    try { return await new ImageCapture(track).grabFrame(); } catch { /* fall back to <video> */ }
  }
  const v = document.createElement('video');
  v.muted = true;
  v.srcObject = stream;
  await v.play();
  await new Promise((r) => (v.readyState >= 2 ? r() : v.addEventListener('loadeddata', r, { once: true })));
  const c = document.createElement('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  v.srcObject = null;
  return c;
}

/** Screenshot of the current tab as a data: URL. */
export async function captureVisibleTab(o = {}) {
  const stream = await displayStream({ currentTab: true });
  try {
    const frame = await grabFrame(stream);
    const c = document.createElement('canvas');
    c.width = frame.width;
    c.height = frame.height;
    c.getContext('2d').drawImage(frame, 0, 0);
    const png = o.format === 'png';
    return c.toDataURL(png ? 'image/png' : 'image/jpeg', png ? undefined : (o.quality ?? 92) / 100);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export function registerStream(stream) {
  const id = 'extshim-stream-' + Math.random().toString(36).slice(2);
  streams.set(id, stream);
  return id;
}

/** getUserMedia() understanding chromeMediaSourceId constraints from desktopCapture/tabCapture. */
export function wrapGetUserMedia(win) {
  const md = win.navigator && win.navigator.mediaDevices;
  if (!md || md.__extshimWrapped) return;
  const orig = md.getUserMedia.bind(md);
  const idOf = (c) => c && typeof c === 'object' && ((c.mandatory && c.mandatory.chromeMediaSourceId) || c.chromeMediaSourceId || (c.deviceId && typeof c.deviceId === 'object' && c.deviceId.exact));
  md.getUserMedia = function getUserMedia(constraints = {}) {
    const id = idOf(constraints.video) || idOf(constraints.audio);
    if (id && streams.has(id)) return Promise.resolve(streams.get(id));
    return orig(constraints);
  };
  try { Object.defineProperty(md, '__extshimWrapped', { value: true }); } catch { /* ignore */ }
}
