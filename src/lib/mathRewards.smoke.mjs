// Smoke test for src/lib/mathRewards.js. Run with:
//   node src/lib/mathRewards.smoke.mjs
// Exits 0 if all assertions pass, 1 otherwise.

import { DEFAULT_REWARDS, affordableQty, canAfford, sleepoverProgress } from './mathRewards.js';

let failures = 0;
function eq(label, a, b) {
  const ok = a === b;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${ok ? '' : `→ expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`}`);
  if (!ok) failures++;
}

const tv = DEFAULT_REWARDS.find(r => r.key === 'tv');
const sleepover = DEFAULT_REWARDS.find(r => r.key === 'sleepover');

// TV: 20 points = 1 minute
eq('40 pts → 2 TV min',  affordableQty(40, tv), 2);
eq('19 pts → 0 TV min',  affordableQty(19, tv), 1 - 1); // 0, just being explicit
eq('200 pts → 10 TV min', affordableQty(200, tv), 10);

// canAfford
eq('canAfford 20 for 1 TV min', canAfford(20, tv, 1), true);
eq('canAfford 19 for 1 TV min', canAfford(19, tv, 1), false);
eq('canAfford sleepover at 2660', canAfford(2660, sleepover, 1), true);
eq('canAfford sleepover at 2659', canAfford(2659, sleepover, 1), false);

// sleepover progress is balance-based, clamped to 1
eq('sleepover 0%',   sleepoverProgress(0), 0);
eq('sleepover 50%',  sleepoverProgress(1330), 0.5);
eq('sleepover 100%', sleepoverProgress(2660), 1);
eq('sleepover clamps >100%', sleepoverProgress(5000), 1);

// spending TV reduces what's left for sleepover (shared pool semantics)
const balanceAfterTv = 1330 - tv.costPoints * 10; // spent 10 TV min
eq('after spending 10 TV min, progress drops', sleepoverProgress(balanceAfterTv), (1330 - 200) / 2660);

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
