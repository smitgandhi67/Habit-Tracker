import { apiFetch } from './api';

// Shared localStorage key for the math answer buffer — the single source of truth used by
// both the practice loop (useMath) and the manual Sync button, so Sync posts exactly what
// practice wrote. Buffered entries are { a, b, answer, firstTry, date, op }.
export const mathBufferKey = (uid) => `math:buffer:${uid}`;

function readBuffer(uid) {
  try {
    const v = JSON.parse(localStorage.getItem(mathBufferKey(uid)) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// How many answers are still waiting locally (earned but not yet posted to the server).
export function pendingCount(uid) {
  return readBuffer(uid).length;
}

// Post any buffered answers to the server and clear them on success. Returns { synced }.
// Throws on network failure (the buffer is left intact so nothing is lost).
export async function flushPending(uid) {
  const buf = readBuffer(uid);
  if (buf.length === 0) return { synced: 0 };
  const res = await apiFetch('/api/math/answer/batch', {
    method: 'POST',
    body: JSON.stringify({ answers: buf }),
  });
  try { localStorage.removeItem(mathBufferKey(uid)); } catch { /* quota / private mode */ }
  return { synced: buf.length, reward: res.reward };
}
