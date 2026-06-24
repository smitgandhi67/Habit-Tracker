// Leitner spaced-repetition schedule — client mirror of server/utils/math.js.
// A fact carries a mastery level + a dueDate. Mastering it (PROMOTE_AT first-try
// corrects on distinct days) bumps the level and rests it for INTERVAL_WEEKS[level]
// weeks; a first-try miss of a due fact demotes it DEMOTE_STEP levels, due now.
// KEEP IN SYNC with server/utils/math.js.

export const PROMOTE_AT = 2;                       // distinct-day corrects to advance a level
export const MAX_LEVEL = 5;
export const DEMOTE_STEP = 2;                       // levels dropped on a due-fact miss
export const INTERVAL_WEEKS = [0, 1, 2, 3, 4, 6];   // index = level; level 0 (new) is due now

// 'YYYY-MM-DD' that is INTERVAL_WEEKS[level] weeks after dateStr (UTC-safe).
export function dueDateAfter(dateStr, level) {
  const weeks = INTERVAL_WEEKS[Math.min(level, MAX_LEVEL)] || 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + weeks * 7));
  return dt.toISOString().slice(0, 10);
}

// A fact is "trivial" (kid already knows it) when an identity/zero operand is
// involved: ×0/×1, +0, −0, ÷1. Included for completeness but rarely surfaced.
export function isTrivialFact(op, a, b) {
  if (op === 'mul') return a <= 1 || b <= 1;
  if (op === 'add') return a === 0 || b === 0;
  if (op === 'sub') return b === 0 || a === b;
  if (op === 'div') return b === 1 || a === b;
  return false;
}

// Starting level for a fact with no mastery row: trivial → near the top (long rest,
// low priority); everything else → level 0 (due now).
export function initialLevelFor(op, a, b) {
  return isTrivialFact(op, a, b) ? MAX_LEVEL - 1 : 0;
}
