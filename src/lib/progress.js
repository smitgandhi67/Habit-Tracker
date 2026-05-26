// Pure helpers for the Gym Progress tab.
//
// Input shape (from GET /api/gym/progress):
//   { exerciseName, bodyPart, weeks: [{ weekStart, maxWeight, totalVolume, sessions }] }
//
// "Active" week = one with sessions > 0. % deltas compare the FIRST and LAST
// active weeks within the window. Exercises with fewer than 2 active weeks
// (or zero baseline) get null deltas; they show "—" in the UI and are excluded
// from the overall averages.

export function summarize(weeks) {
  const active = (weeks || []).filter(w => w.sessions > 0);
  if (active.length === 0) {
    return { sessions: 0, weightPct: null, volumePct: null, currentWeight: 0, currentVolume: 0, firstWeight: 0, firstVolume: 0 };
  }
  const sessions = active.reduce((s, w) => s + w.sessions, 0);
  const first = active[0];
  const last  = active[active.length - 1];

  const weightPct = (active.length >= 2 && first.maxWeight > 0)
    ? ((last.maxWeight - first.maxWeight) / first.maxWeight) * 100
    : null;
  const volumePct = (active.length >= 2 && first.totalVolume > 0)
    ? ((last.totalVolume - first.totalVolume) / first.totalVolume) * 100
    : null;

  return {
    sessions,
    weightPct,
    volumePct,
    currentWeight: last.maxWeight,
    currentVolume: last.totalVolume,
    firstWeight:   first.maxWeight,
    firstVolume:   first.totalVolume,
  };
}

// Average of percentages, ignoring null. Returns null if no contributors.
export function averagePct(values) {
  const real = values.filter(v => typeof v === 'number' && Number.isFinite(v));
  if (real.length === 0) return null;
  return real.reduce((s, v) => s + v, 0) / real.length;
}

// "+12%" / "0%" / "-3%" / "—"
export function formatPct(pct) {
  if (pct == null || !Number.isFinite(pct)) return '—';
  const rounded = Math.round(pct);
  if (rounded === 0) return '0%';
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

// Tailwind color class trio { text, border, bg } based on sign.
export function pctTone(pct) {
  if (pct == null || !Number.isFinite(pct)) return { text: 'text-slate-400', border: 'border-l-slate-200', bg: 'bg-slate-50' };
  if (pct > 0)   return { text: 'text-green-600', border: 'border-l-green-500', bg: 'bg-green-50' };
  if (pct < 0)   return { text: 'text-red-500',   border: 'border-l-red-400',   bg: 'bg-red-50'   };
  return                { text: 'text-slate-500', border: 'border-l-slate-300', bg: 'bg-slate-50' };
}

// Sort: weight Δ% desc, nulls last; stable on name. Mutates a copy, returns it.
export function sortByWeightPctDesc(rows) {
  return rows.slice().sort((a, b) => {
    const av = a.weightPct;
    const bv = b.weightPct;
    const aNull = av == null;
    const bNull = bv == null;
    if (aNull && bNull) return a.exerciseName.localeCompare(b.exerciseName);
    if (aNull) return 1;
    if (bNull) return -1;
    if (bv !== av) return bv - av;
    return a.exerciseName.localeCompare(b.exerciseName);
  });
}

export const PERIOD_OPTIONS = [
  { key: '1mo', label: '1mo', weeks: 4 },
  { key: '3mo', label: '3mo', weeks: 13 },
  { key: 'all', label: 'All', weeks: 52 },
];

export function periodForKey(key) {
  return PERIOD_OPTIONS.find(p => p.key === key) || PERIOD_OPTIONS[0];
}
