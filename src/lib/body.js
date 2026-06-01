// Pure helpers for the Body Measurements tab. Unit-agnostic — values are raw
// numbers; the unit is a label carried on the User (weightUnit / lengthUnit).
//
// `measurements` is the array from GET /api/body/measurements, each item:
//   { date: 'YYYY-MM-DD', weight?, chest?, waist?, abdomen?, hips? }
// sorted ascending by date. All functions tolerate sparse/missing metrics.

import { parseISO, differenceInCalendarDays, subDays, addDays, format, startOfWeek } from 'date-fns';

export const METRICS = ['weight', 'chest', 'waist', 'abdomen', 'hips'];

const has = (m, k) => m[k] !== null && m[k] !== undefined && Number.isFinite(m[k]);

// Most recent entry that has a weight: { date, value } | null.
export function latestWeight(measurements) {
  for (let i = measurements.length - 1; i >= 0; i--) {
    if (has(measurements[i], 'weight')) {
      return { date: measurements[i].date, value: measurements[i].weight };
    }
  }
  return null;
}

// Mean weight over the 7-day window ending at `asOf` (inclusive). null if none.
export function avg7(measurements, asOf) {
  const end = parseISO(asOf);
  const vals = [];
  for (const m of measurements) {
    if (!has(m, 'weight')) continue;
    const diff = differenceInCalendarDays(end, parseISO(m.date));
    if (diff >= 0 && diff <= 6) vals.push(m.weight);
  }
  if (!vals.length) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

// Nearest value of `metric` on or before (asOf − n days): { date, value } | null.
export function valueNDaysAgo(measurements, metric, asOf, n) {
  const target = format(subDays(parseISO(asOf), n), 'yyyy-MM-dd');
  let best = null;
  for (const m of measurements) {
    if (!has(m, metric)) continue;
    if (m.date <= target && (!best || m.date > best.date)) {
      best = { date: m.date, value: m[metric] };
    }
  }
  return best;
}

// Weekly change of `metric` at `asOf`. Weight uses the 7-day average on each
// side; circumferences use the nearest value on/before each side.
// Returns { current, previous, delta } with nulls where data is missing.
export function weeklyDelta(measurements, metric, asOf) {
  let current, previous;
  if (metric === 'weight') {
    current = avg7(measurements, asOf);
    previous = avg7(measurements, format(subDays(parseISO(asOf), 7), 'yyyy-MM-dd'));
  } else {
    current  = valueNDaysAgo(measurements, metric, asOf, 0)?.value ?? null;
    previous = valueNDaysAgo(measurements, metric, asOf, 7)?.value ?? null;
  }
  const delta = current != null && previous != null ? current - previous : null;
  return { current, previous, delta };
}

// Weight-threshold alert. Warn when |Δ| / prevAvg × 100 exceeds `pct`.
// Returns null | { dir: 'gain' | 'loss', deltaPct }.
export function weightAlert(curAvg, prevAvg, pct = 1) {
  if (curAvg == null || prevAvg == null || prevAvg <= 0) return null;
  const deltaPct = ((curAvg - prevAvg) / prevAvg) * 100;
  if (Math.abs(deltaPct) <= pct) return null;
  return { dir: deltaPct > 0 ? 'gain' : 'loss', deltaPct };
}

// Last `weeks` ISO weeks (Mon-start) ending at `asOf`, oldest→newest. Each:
//   { weekStart: 'YYYY-MM-DD', value: number | null }
// value = latest non-null `metric` within that week.
export function weeklyBuckets(measurements, metric, weeks = 4, asOf = format(new Date(), 'yyyy-MM-dd')) {
  const out = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const ref = subDays(parseISO(asOf), w * 7);
    const start = startOfWeek(ref, { weekStartsOn: 1 });
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(addDays(start, 6), 'yyyy-MM-dd');
    let picked = null;
    for (const m of measurements) {
      if (!has(m, metric)) continue;
      if (m.date >= startStr && m.date <= endStr && (!picked || m.date >= picked.date)) {
        picked = { date: m.date, value: m[metric] };
      }
    }
    out.push({ weekStart: startStr, value: picked ? picked.value : null });
  }
  return out;
}

// Formatting helpers ────────────────────────────────────────────────────────

export function formatDelta(delta, decimals = 1) {
  if (delta == null || !Number.isFinite(delta)) return '—';
  const r = Number(delta.toFixed(decimals));
  if (r === 0) return '0';
  return `${r > 0 ? '+' : ''}${r}`;
}

// Tone for a weight change: gaining and losing are both "neutral" unless the
// alert fires, so plain Δ just gets an up/down color.
export function deltaTone(delta) {
  if (delta == null || !Number.isFinite(delta) || delta === 0) {
    return { text: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200' };
  }
  return delta > 0
    ? { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' }
    : { text: 'text-sky-600',   bg: 'bg-sky-50',   border: 'border-sky-200'  };
}
