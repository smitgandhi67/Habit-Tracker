// Leitner spaced-repetition schedule — client mirror of server/utils/math.js.
// A fact carries a mastery level + a dueDate. Mastering it (PROMOTE_AT first-try
// corrects on distinct days) bumps the level and rests it for INTERVAL_WEEKS[level]
// weeks; a first-try miss of a due fact demotes it DEMOTE_STEP levels, due now.
// The top of the ladder rests for months (a refresher ~twice a year) rather than
// retiring — durable recall without ever fully forgetting.
// KEEP IN SYNC with server/utils/math.js.

import { isTrivialFact } from './questionTypes.js';

export { isTrivialFact };

export const PROMOTE_AT = 2;                                  // distinct-day corrects to advance a level
export const MAX_LEVEL = 7;
export const DEMOTE_STEP = 2;                                 // levels dropped on a due-fact miss
export const INTERVAL_WEEKS = [0, 1, 2, 3, 4, 6, 12, 26];     // index = level; level 0 (new) is due now

// 'YYYY-MM-DD' that is INTERVAL_WEEKS[level] weeks after dateStr (UTC-safe).
export function dueDateAfter(dateStr, level) {
  const weeks = INTERVAL_WEEKS[Math.min(level, MAX_LEVEL)] || 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + weeks * 7));
  return dt.toISOString().slice(0, 10);
}

// Starting level for a fact with no mastery row: trivial (identity) facts → near the
// top (long rest, low priority); everything else → level 0 (due now).
export function initialLevelFor(op, a, b) {
  return isTrivialFact(op, a, b) ? MAX_LEVEL - 1 : 0;
}
