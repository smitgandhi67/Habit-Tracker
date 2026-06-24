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

// Per-operation canonical fact key (op is stored separately on the mastery row, so
// keys are op-local). mul/add commute (min first); sub/div are ordered. Mirrors
// src/lib/mathSchedule.js — keep in sync.
function factKeyFor(op, a, b) {
  if (op === 'add') return `${Math.min(a, b)}+${Math.max(a, b)}`;
  if (op === 'sub') return `${a}-${b}`;
  if (op === 'div') return `${a}/${b}`;
  return canonicalKey(a, b); // mul
}

// Operands now include 0 and 1 (trivial facts, kept at low priority — see
// isTrivialFact). mul operands range 0..MAX_OPERAND.
function isValidOperand(n) {
  return Number.isInteger(n) && n >= 0 && n <= MAX_OPERAND;
}

// ---- Leitner spaced-repetition schedule -----------------------------------
// A fact carries a mastery level + a dueDate. Mastering it (PROMOTE_AT first-try
// corrects on distinct days) bumps the level and rests it for INTERVAL_WEEKS[level]
// weeks; a first-try miss of a due fact demotes it DEMOTE_STEP levels, due now.
// Mirrored in src/lib/mathSchedule.js — keep both in sync.
const PROMOTE_AT = 2;                     // distinct-day corrects to advance a level
const MAX_LEVEL = 5;
const DEMOTE_STEP = 2;                     // levels dropped on a due-fact miss
const INTERVAL_WEEKS = [0, 1, 2, 3, 4, 6]; // index = level; level 0 (new) is due now

// 'YYYY-MM-DD' that is INTERVAL_WEEKS[level] weeks after dateStr (UTC-safe).
function dueDateAfter(dateStr, level) {
  const weeks = INTERVAL_WEEKS[Math.min(level, MAX_LEVEL)] || 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + weeks * 7));
  return dt.toISOString().slice(0, 10);
}

// A fact is "trivial" (kid already knows it) when an identity/zero operand is
// involved: ×0/×1, +0, −0, ÷1. These are included for completeness but seeded at a
// high level so they rest long and rarely surface.
function isTrivialFact(op, a, b) {
  if (op === 'mul') return a <= 1 || b <= 1;          // ×0 or ×1 (incl. 0)
  if (op === 'add') return a === 0 || b === 0;        // +0
  if (op === 'sub') return b === 0 || a === b;        // −0 or n−n
  if (op === 'div') return b === 1 || a === b;        // ÷1 or n÷n
  return false;
}

// Starting mastery level for a fact with no row yet: trivial facts start near the
// top (long rest, low priority); everything else starts fresh (level 0, due now).
function initialLevelFor(op, a, b) {
  return isTrivialFact(op, a, b) ? MAX_LEVEL - 1 : 0;
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

// Points earned per first-try-correct answer, by operation. Harder skills earn more:
// division (4) > subtraction (3) > add/multiply (1). Keep in sync with src/lib/mathRewards.js.
function pointsForOp(op) {
  if (op === 'div') return 4;
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
  factKeyFor,
  isValidOperand,
  isoWeekKey,
  balanceOf,
  pointsForOp,
  PROMOTE_AT,
  MAX_LEVEL,
  DEMOTE_STEP,
  INTERVAL_WEEKS,
  dueDateAfter,
  isTrivialFact,
  initialLevelFor,
};
