// Reward helpers — points are the single spendable currency. Rewards are bought
// by spending points from the balance. Defaults mirror the server's utils/math.DEFAULT_REWARDS.

export const DEFAULT_REWARDS = [
  { key: 'tv',        label: 'TV time',   costPoints: 20,   unit: 'minute' },
  { key: 'sleepover', label: 'Sleepover', costPoints: 2660, unit: 'event'  },
];

// Points earned per first-try-correct answer, by operation. Harder skills earn more:
// division (4) > subtraction (3) > add/multiply (1). Keep in sync with server/utils/math.js.
export function pointsForOp(op) {
  if (op === 'div') return 4;
  return op === 'sub' ? 3 : 1;
}

// How many units of a reward the balance can currently buy.
export function affordableQty(balance, reward) {
  if (!reward || reward.costPoints <= 0) return 0;
  return Math.floor(balance / reward.costPoints);
}

export function canAfford(balance, reward, qty = 1) {
  if (!reward) return false;
  return balance >= reward.costPoints * qty;
}

// Sleepover progress is balance-based (spending on TV pushes it further away).
export function sleepoverProgress(balance, rewards = DEFAULT_REWARDS) {
  const sleepover = rewards.find(r => r.key === 'sleepover');
  if (!sleepover || sleepover.costPoints <= 0) return 0;
  return Math.min(1, balance / sleepover.costPoints);
}
