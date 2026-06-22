// Shared math helpers for the multiplication-practice feature.
// Kept framework-free so the smoke test (server/utils/math.smoke.js) can run under plain node.

const MIN_OPERAND = 2;
const MAX_OPERAND = 20;

// Default reward catalog, used to seed MathRewardConfig on first read.
// Admin can edit costs later via /api/math/admin/config.
const DEFAULT_REWARDS = [
  { key: 'tv',        label: 'TV time',   costPoints: 20,   unit: 'minute' },
  { key: 'sleepover', label: 'Sleepover', costPoints: 2660, unit: 'event'  },
];

// Canonical, commutative-deduped key for a fact: 7x8 and 8x7 → "7x8" (min first).
function canonicalKey(a, b) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `${lo}x${hi}`;
}

function isValidOperand(n) {
  return Number.isInteger(n) && n >= MIN_OPERAND && n <= MAX_OPERAND;
}

// ISO-8601 week key (Mon-Sun) from a 'YYYY-MM-DD' string, e.g. "2026-W25".
// Pure string→key math; no timezone needed (the client passes its own local date).
function isoWeekKey(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Work in UTC to avoid host-timezone drift; the date is already local-calendar.
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  // Shift to the Thursday of this week — ISO weeks belong to the year of their Thursday.
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date - firstThursday) / (7 * 24 * 60 * 60 * 1000));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

// Points earned per first-try-correct answer, by operation. Subtraction is worth
// more to reward the harder skill. Keep in sync with src/lib/mathRewards.js.
function pointsForOp(op) {
  return op === 'sub' ? 3 : 1;
}

// Current spendable balance — never negative.
function balanceOf(reward) {
  const earned = reward?.pointsEarned || 0;
  const spent = reward?.pointsSpent || 0;
  return Math.max(0, earned - spent);
}

module.exports = {
  MIN_OPERAND,
  MAX_OPERAND,
  DEFAULT_REWARDS,
  canonicalKey,
  isValidOperand,
  isoWeekKey,
  balanceOf,
  pointsForOp,
};
