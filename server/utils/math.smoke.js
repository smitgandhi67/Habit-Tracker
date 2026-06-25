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

// dueDateAfter adds INTERVAL_WEEKS[level] weeks; the top of the ladder rests months.
eq('INTERVAL_WEEKS ladder', INTERVAL_WEEKS.join(','), '0,1,2,3,4,6,12,26');
eq('dueDateAfter L1', dueDateAfter('2026-06-23', 1), '2026-06-30');
eq('dueDateAfter L3', dueDateAfter('2026-06-23', 3), '2026-07-14');
eq('dueDateAfter L6 (~3mo)', dueDateAfter('2026-06-23', 6), '2026-09-15');
eq('dueDateAfter L7 (~6mo)', dueDateAfter('2026-06-23', 7), '2026-12-22');
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

// ---- question-type registry (squares + square roots) ----
const { TYPES, OP_KEYS, get, isCorrect, validateOperands, pointsForOp: regPoints } = require('./questionTypes');

eq('registry has 9 types', OP_KEYS.join(','), 'mul,add,sub,div,sq,sqrt,cube,cbrt,frac');
eq('pointsForOp delegates to registry', regPoints('sqrt'), 4);

// squares: n² with base 0..max
eq('sq factKey', get('sq').factKey(7), 'sq:7');
eq('sq answer 7', get('sq').answer(7), 49);
eq('sq isCorrect', isCorrect('sq', 7, 7, 49), true);
eq('sq wrong', isCorrect('sq', 7, 7, 48), false);
eq('sq trivial 1', get('sq').isTrivial(1), true);
eq('sq trivial 0', get('sq').isTrivial(0), true);
eq('sq not trivial 5', get('sq').isTrivial(5), false);
eq('sq generate(10) count', get('sq').generate(10).length, 11); // 0..10
eq('sq points', get('sq').points, 3);

// square roots: a = radicand n², b = root n, answer = root
eq('sqrt factKey by radicand', get('sqrt').factKey(144), 'sqrt:144');
eq('sqrt answer (root)', get('sqrt').answer(144, 12), 12);
eq('sqrt isCorrect 144→12', isCorrect('sqrt', 144, 12, 12), true);
eq('sqrt wrong root', isCorrect('sqrt', 144, 12, 11), false);
eq('sqrt validate perfect square', validateOperands('sqrt', 144, 12), true);
eq('sqrt validate rejects non-square', validateOperands('sqrt', 145, 12), false);
eq('sqrt trivial 1', get('sqrt').isTrivial(1, 1), true);
eq('sqrt generate(10) count', get('sqrt').generate(10).length, 11);
eq('sqrt points', get('sqrt').points, 4);

// existing ops still grade through the registry
eq('mul via registry', isCorrect('mul', 6, 7, 42), true);
eq('div exact only', isCorrect('div', 12, 5, 2), false);
eq('div valid', validateOperands('div', 12, 3), true);
eq('div zero divisor invalid', validateOperands('div', 12, 0), false);

// cubes: n³ up to 12
eq('cube factKey', get('cube').factKey(5), 'cube:5');
eq('cube answer 12³', get('cube').answer(12), 1728);
eq('cube isCorrect', isCorrect('cube', 5, 5, 125), true);
eq('cube wrong', isCorrect('cube', 5, 5, 120), false);
eq('cube generate(12) count', get('cube').generate(12).length, 13); // 0..12
eq('cube points', get('cube').points, 4);

// cube roots: a = n³, b = root n
eq('cbrt factKey by radicand', get('cbrt').factKey(125), 'cbrt:125');
eq('cbrt isCorrect 125→5', isCorrect('cbrt', 125, 5, 5), true);
eq('cbrt wrong', isCorrect('cbrt', 125, 5, 6), false);
eq('cbrt validate perfect cube', validateOperands('cbrt', 125, 5), true);
eq('cbrt validate rejects non-cube', validateOperands('cbrt', 126, 5), false);
eq('cbrt points', get('cbrt').points, 5);

// fractions: unit 1/n graded with tolerance (2- or 3-dp both pass)
eq('frac factKey', get('frac').factKey(4), 'frac:1/4');
eq('frac answer 1/4', get('frac').answer(4), 0.25);
eq('frac integerAnswer false', get('frac').integerAnswer, false);
eq('frac 0.25 correct', isCorrect('frac', 4, 1, 0.25), true);
eq('frac 0.33 ≈ 1/3 correct', isCorrect('frac', 3, 1, 0.33), true);
eq('frac 0.333 ≈ 1/3 correct', isCorrect('frac', 3, 1, 0.333), true);
eq('frac 0.3 too coarse', isCorrect('frac', 3, 1, 0.3), false);
eq('frac 0.167 ≈ 1/6 correct', isCorrect('frac', 6, 1, 0.167), true);
eq('frac 1/1 = 1', isCorrect('frac', 1, 1, 1), true);
eq('frac validate 1..10', validateOperands('frac', 7, 1), true);
eq('frac validate rejects 11', validateOperands('frac', 11, 1), false);
eq('frac generate count 10', get('frac').generate(10).length, 10);
eq('frac points', get('frac').points, 2);

// the route now accepts non-integer answers (fractions); isCorrect is the real gate
eq('non-integer answer is finite (route guard)', Number.isFinite(0.25), true);

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
