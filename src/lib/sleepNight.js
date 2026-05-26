// Client-side mirror of server/utils/sleepNight.js. Implementation uses
// Intl.DateTimeFormat so client + server produce identical 'YYYY-MM-DD'
// values regardless of host (browser vs node).
//
// Rule: 6pm cutoff. A start time before 6pm local belongs to the previous
// night; from 6pm onward it belongs to that calendar date.

export function nightDateFor(date, tz) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) throw new Error('nightDateFor: invalid date');
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = parseInt(parts.hour, 10) % 24;
  if (hour >= 18) return ymd;
  const prev = new Date(`${ymd}T00:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  return prev.toISOString().slice(0, 10);
}

// Elapsed millis for a session. Uses `now` if endAt is null (active).
export function elapsedMs(session, now = new Date()) {
  if (!session?.startAt) return 0;
  const start = new Date(session.startAt).getTime();
  const end = session.endAt ? new Date(session.endAt).getTime() : now.getTime();
  return Math.max(0, end - start);
}

// "7h 12m" / "42m" / "0m" / "—" (null/undefined)
export function formatDuration(ms) {
  if (ms == null) return '—';
  const totalMin = Math.floor(ms / 60000);
  if (totalMin <= 0) return '0m';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// hh:mm:ss for the active timer.
export function formatHMS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Groups sessions into night buckets. Returns newest-first.
// sessions: SleepSession[]. nightsByDate: { [YYYY-MM-DD]: { quality } }
export function groupByNight(sessions, nightsByDate = {}) {
  const buckets = new Map();
  for (const s of sessions) {
    const key = s.nightDate;
    if (!buckets.has(key)) {
      buckets.set(key, { nightDate: key, sessions: [], totalMs: 0, isActive: false, quality: null });
    }
    const b = buckets.get(key);
    b.sessions.push(s);
    if (s.endAt) {
      b.totalMs += elapsedMs(s);
    } else {
      b.isActive = true;
    }
  }
  // Include nights that have quality set but no sessions in window.
  for (const [date, info] of Object.entries(nightsByDate)) {
    if (!buckets.has(date)) {
      buckets.set(date, { nightDate: date, sessions: [], totalMs: 0, isActive: false, quality: info.quality ?? null });
    } else {
      buckets.get(date).quality = info.quality ?? null;
    }
  }
  for (const b of buckets.values()) {
    b.sessions.sort((a, b2) => new Date(a.startAt) - new Date(b2.startAt));
  }
  return Array.from(buckets.values()).sort((a, b) => (a.nightDate < b.nightDate ? 1 : -1));
}
