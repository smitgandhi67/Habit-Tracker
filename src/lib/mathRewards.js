// Reward helpers — points are the single spendable currency. Rewards are bought
// by spending points from the balance. Defaults mirror the server's utils/math.DEFAULT_REWARDS.

export const DEFAULT_REWARDS = [
  { key: 'tv',        label: 'TV time',   costPoints: 20,   unit: 'minute' },
  { key: 'sleepover', label: 'Sleepover', costPoints: 2660, unit: 'event'  },
];

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
