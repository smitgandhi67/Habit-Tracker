// Smoke test for server/utils/math.js. Run with:
//   node server/utils/math.smoke.js
// Exits 0 if all assertions pass, 1 otherwise. Not wired into CI; local verification only.

const {
  canonicalKey, isValidOperand, isoWeekKey, balanceOf, MIN_OPERAND, MAX_OPERAND,
  factKeyFor, dueDateAfter, isTrivialFact, initialLevelFor, INTERVAL_WEEKS, MAX_LEVEL,
} = require('./math');

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

// operand range now 0..20 (0/1 trivial facts are included, deprioritized)
eq('isValidOperand(0)',   isValidOperand(0), true);
eq('isValidOperand(1)',   isValidOperand(1), true);
eq('isValidOperand(2)',   isValidOperand(2), true);
eq('isValidOperand(20)',  isValidOperand(20), true);
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

// ---- Leitner schedule helpers ----
// per-op canonical keys (mul/add commute; sub/div ordered)
eq('factKeyFor mul commutes', factKeyFor('mul', 8, 7), '7x8');
eq('factKeyFor add commutes', factKeyFor('add', 5, 3), '3+5');
eq('factKeyFor sub ordered',  factKeyFor('sub', 9, 4), '9-4');
eq('factKeyFor div ordered',  factKeyFor('div', 12, 3), '12/3');

// dueDateAfter adds INTERVAL_WEEKS[level] weeks (gentle table 0,1,2,3,4,6)
eq('INTERVAL_WEEKS gentle', INTERVAL_WEEKS.join(','), '0,1,2,3,4,6');
eq('dueDateAfter L1', dueDateAfter('2026-06-23', 1), '2026-06-30');
eq('dueDateAfter L3', dueDateAfter('2026-06-23', 3), '2026-07-14');
eq('dueDateAfter L0 (due now)', dueDateAfter('2026-06-23', 0), '2026-06-23');

// trivial = identity/zero operand; starts near the top of the box stack
eq('trivial mul x1',  isTrivialFact('mul', 1, 9), true);
eq('trivial mul x0',  isTrivialFact('mul', 0, 9), true);
eq('non-trivial mul', isTrivialFact('mul', 2, 9), false);
eq('trivial add +0',  isTrivialFact('add', 0, 5), true);
eq('trivial sub -0',  isTrivialFact('sub', 7, 0), true);
eq('trivial sub n-n', isTrivialFact('sub', 7, 7), true);
eq('non-trivial sub', isTrivialFact('sub', 7, 3), false);
eq('trivial div /1',  isTrivialFact('div', 5, 1), true);
eq('trivial div n/n', isTrivialFact('div', 4, 4), true);
eq('non-trivial div', isTrivialFact('div', 6, 3), false);
eq('initialLevel trivial', initialLevelFor('mul', 1, 9), MAX_LEVEL - 1);
eq('initialLevel normal',  initialLevelFor('mul', 6, 7), 0);

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
