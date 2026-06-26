// TEMPORARY motivation promo (delete after it expires).
//
// 1-point question types (mul/add) pay a flat, per-kid bonus until a hard UTC
// cutoff. Higher-weight types (sub/div/sq/…) are untouched. After the cutoff,
// effectivePoints() returns the base weight everywhere, so removing this file's
// wiring later is a no-op for behavior — only cleanup.
//
//   Smit → 1-point questions pay 5
//   Mit  → 1-point questions pay 3
//   Active through Sunday 2026-06-28, end-of-day UTC.

// Promo is active while now < this instant (the midnight UTC after Sun Jun 28).
const PROMO_END_MS = Date.UTC(2026, 5, 29, 0, 0, 0); // 2026-06-29T00:00:00.000Z

// Per-kid flat payout for a base-1 question, keyed by email prefix
// (case-insensitive), matching the convention used by server/scripts (mit@…, smit@…).
// Longest prefix first so an email can't match a shorter, overlapping rule by accident.
const ONE_POINT_PROMO = [
  { prefix: 'smit', points: 5 },
  { prefix: 'mit', points: 3 },
];

// Effective first-try-correct payout for a single question.
//   basePoints — the op's normal weight (from pointsForOp)
//   user       — req.user (decoded JWT; needs .email)
//   nowMs      — current epoch ms, injectable for tests
function effectivePoints(basePoints, user, nowMs = Date.now()) {
  if (basePoints !== 1) return basePoints;       // promo only touches 1-point question types
  if (nowMs >= PROMO_END_MS) return basePoints;  // expired → normal weight
  const email = String(user?.email || '').toLowerCase();
  if (!email) return basePoints;
  for (const { prefix, points } of ONE_POINT_PROMO) {
    if (email.startsWith(prefix)) return points;
  }
  return basePoints;
}

module.exports = { effectivePoints, PROMO_END_MS, ONE_POINT_PROMO };
