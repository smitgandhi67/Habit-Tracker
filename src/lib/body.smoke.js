/* global process */
// Smoke test for lib/body.js pure helpers. Run with:
//   node src/lib/body.smoke.js
// Exits 0 if all assertions pass, 1 otherwise. Not wired into CI.

import {
  latestWeight, avg7, valueNDaysAgo, weeklyDelta, weightAlert, weeklyBuckets,
} from './body.js';

let failures = 0;
function expect(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${ok ? '' : `→ expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
  if (!ok) failures++;
}
function approx(label, actual, expected, eps = 1e-9) {
  const ok = actual != null && Math.abs(actual - expected) < eps;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${ok ? '' : `→ expected ~${expected}, got ${actual}`}`);
  if (!ok) failures++;
}

// asOf reference: 2026-06-08 (a Monday).
const M = [
  { date: '2026-05-25', weight: 80, waist: 86 },   // 2 weeks prior
  { date: '2026-06-01', weight: 79, waist: 85 },   // 7 days prior
  { date: '2026-06-02', weight: 79.4 },
  { date: '2026-06-06', weight: 78.8 },
  { date: '2026-06-07', weight: 78.6 },
  { date: '2026-06-08', weight: 78.4, waist: 84 }, // asOf
];
const asOf = '2026-06-08';

// latestWeight
expect('latestWeight', latestWeight(M), { date: '2026-06-08', value: 78.4 });
expect('latestWeight empty', latestWeight([]), null);

// avg7: window 06-02..06-08 inclusive → 79.4, 78.8, 78.6, 78.4 (06-01 excluded)
approx('avg7 asOf', avg7(M, asOf), (79.4 + 78.8 + 78.6 + 78.4) / 4);
// avg7 a week earlier 05-26..06-01 → only 06-01 (79); 05-25 excluded
approx('avg7 prev week', avg7(M, '2026-06-01'), 79);
expect('avg7 none', avg7(M, '2020-01-01'), null);

// valueNDaysAgo: waist 7 days before asOf → on/before 06-01 → 85
expect('valueNDaysAgo waist 7d', valueNDaysAgo(M, 'waist', asOf, 7), { date: '2026-06-01', value: 85 });
expect('valueNDaysAgo waist 0d', valueNDaysAgo(M, 'waist', asOf, 0), { date: '2026-06-08', value: 84 });

// weeklyDelta weight: avg7(asOf) - avg7(asOf-7=06-01)
const wd = weeklyDelta(M, 'weight', asOf);
approx('weeklyDelta weight current', wd.current, (79.4 + 78.8 + 78.6 + 78.4) / 4);
approx('weeklyDelta weight previous', wd.previous, 79);
// weeklyDelta waist: 84 - 85 = -1
expect('weeklyDelta waist', weeklyDelta(M, 'waist', asOf).delta, -1);

// weightAlert: prev 80, cur 80.4 → +0.5% ≤ 1% → null
expect('weightAlert under band', weightAlert(80.4, 80, 1), null);
// prev 80, cur 81 → +1.25% > 1% → gain
expect('weightAlert gain', weightAlert(81, 80, 1), { dir: 'gain', deltaPct: ((81 - 80) / 80) * 100 });
// prev 80, cur 78.5 → -1.875% → loss
expect('weightAlert loss dir', weightAlert(78.5, 80, 1).dir, 'loss');
expect('weightAlert null prev', weightAlert(80, null, 1), null);
expect('weightAlert zero prev', weightAlert(80, 0, 1), null);

// weeklyBuckets weight, 4 weeks ending asOf. Weeks (Mon-start):
//   05-18, 05-25, 06-01, 06-08
const buckets = weeklyBuckets(M, 'weight', 4, asOf);
expect('weeklyBuckets length', buckets.length, 4);
expect('weeklyBuckets starts', buckets.map(b => b.weekStart), ['2026-05-18', '2026-05-25', '2026-06-01', '2026-06-08']);
// 05-18 week: no data → null; 05-25 week: 80; 06-01 week latest = 06-07 (78.6); 06-08 week: 78.4
expect('weeklyBuckets values', buckets.map(b => b.value), [null, 80, 78.6, 78.4]);

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
