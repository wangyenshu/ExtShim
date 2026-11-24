export const KEY = 'notes';
export async function getNotes() {
  const { [KEY]: notes = [] } = await chrome.storage.local.get(KEY);
  return notes;
}
export async function addNote(text) {
  const notes = await getNotes();
  notes.unshift({ text, at: Date.now() });
  await chrome.storage.local.set({ [KEY]: notes.slice(0, 50) });
  return notes.length;
}
export function wordCount(s) { return String(s).trim().split(/\s+/).filter(Boolean).length; }
