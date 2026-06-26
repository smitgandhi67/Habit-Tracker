// Client mirror of server/utils/mathBonus.js — KEEP IN SYNC.
//
// TEMPORARY motivation promo (delete after it expires). 1-point question types
// (mul/add) pay a flat, per-kid bonus until a hard UTC cutoff. The client mirrors
// it so the optimistic "+points" + balance match what the server actually credits
// (the server stays authoritative and re-grades on flush).
//
//   Smit → 1-point questions pay 5
//   Mit  → 1-point questions pay 3
//   Active through Sunday 2026-06-28, end-of-day UTC.

const PROMO_END_MS = Date.UTC(2026, 5, 29, 0, 0, 0); // 2026-06-29T00:00:00.000Z

// Per-kid flat payout for a base-1 question, keyed by email prefix (case-insensitive).
const ONE_POINT_PROMO = [
  { prefix: 'smit', points: 5 },
  { prefix: 'mit', points: 3 },
];

// Effective first-try-correct payout for one question (mirrors the server).
export function effectivePoints(basePoints, user, nowMs = Date.now()) {
  if (basePoints !== 1) return basePoints;
  if (nowMs >= PROMO_END_MS) return basePoints;
  const email = String(user?.email || '').toLowerCase();
  if (!email) return basePoints;
  for (const { prefix, points } of ONE_POINT_PROMO) {
    if (email.startsWith(prefix)) return points;
  }
  return basePoints;
}
