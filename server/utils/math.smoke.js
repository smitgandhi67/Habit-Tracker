// Smoke test for server/utils/math.js. Run with:
//   node server/utils/math.smoke.js
// Exits 0 if all assertions pass, 1 otherwise. Not wired into CI; local verification only.

const { canonicalKey, isValidOperand, isoWeekKey, balanceOf, MIN_OPERAND, MAX_OPERAND } = require('./math');

let failures = 0;
function eq(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${ok ? '' : `→ expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
  if (!ok) failures++;
}

// canonicalKey is commutative
eq('canonicalKey(7,8)',          canonicalKey(7, 8), '7x8');
eq('canonicalKey(8,7) == (7,8)', canonicalKey(8, 7), '7x8');
eq('canonicalKey(2,2)',          canonicalKey(2, 2), '2x2');
eq('canonicalKey(20,2)',         canonicalKey(20, 2), '2x20');

// operand range 2..20
eq('isValidOperand(2)',   isValidOperand(2), true);
eq('isValidOperand(20)',  isValidOperand(20), true);
eq('isValidOperand(1)',   isValidOperand(1), false);
eq('isValidOperand(21)',  isValidOperand(21), false);
eq('isValidOperand(7.5)', isValidOperand(7.5), false);
eq('range constants',     `${MIN_OPERAND}-${MAX_OPERAND}`, '2-20');

// 190 unique deduped facts across the 2..20 x 2..20 grid
const keys = new Set();
for (let a = MIN_OPERAND; a <= MAX_OPERAND; a++) {
  for (let b = MIN_OPERAND; b <= MAX_OPERAND; b++) keys.add(canonicalKey(a, b));
}
eq('unique deduped facts == 190', keys.size, 190);

// isoWeekKey: Mon and Sun of the same ISO week share a key; next Mon differs
eq('Mon 2026-06-15 week',  isoWeekKey('2026-06-15'), '2026-W25');
eq('Sun 2026-06-21 == Mon week', isoWeekKey('2026-06-21'), '2026-W25');
eq('Mon 2026-06-22 next week',   isoWeekKey('2026-06-22'), '2026-W26');

// balanceOf clamps at 0 and subtracts spend
eq('balance 10-3', balanceOf({ pointsEarned: 10, pointsSpent: 3 }), 7);
eq('balance never negative', balanceOf({ pointsEarned: 2, pointsSpent: 9 }), 0);
eq('balance undefined safe', balanceOf(undefined), 0);

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
