// Stale-while-revalidate cache for the gym read endpoints, in localStorage.
//
// The gym page mounts and unmounts its tabs constantly, and plans / the
// exercise catalogue change maybe once a week — so re-hitting the API on every
// tab switch was pure latency. Reads paint from the cached copy first; a
// revalidation still runs afterwards unless the entry is younger than FRESH_MS.
//
// Keys are namespaced per user so a shared device can't show another account's
// plans, and every write path clears the key it invalidates (see useGym).

const PREFIX = 'gym:cache:';

// Long enough to cover tab switching and a there-and-back navigation; short
// enough that an edit made on another device shows up in the same session.
export const FRESH_MS = 5 * 60 * 1000;

export function cacheKey(userId, name) {
  return `${PREFIX}${userId || 'anon'}:${name}`;
}

// Returns the { at, value } envelope, or null when absent / unparseable.
export function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.at !== 'number') return null;
    return entry;
  } catch {
    return null;
  }
}

export function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    /* quota / private mode — the app still works, just uncached */
  }
}

export function clearCache(key) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

// A negative age means the clock moved backwards since the write; treat that as
// stale rather than trusting the entry until the clock catches up.
export function isFresh(entry, ttl = FRESH_MS) {
  if (!entry) return false;
  const age = Date.now() - entry.at;
  return age >= 0 && age < ttl;
}
