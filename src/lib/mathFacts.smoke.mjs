// Smoke test for src/lib/mathFacts.js (Leitner / all-ops generation + picking).
// Run with: node src/lib/mathFacts.smoke.mjs
// Exits 0 if all assertions pass, 1 otherwise.

import {
  generateAllFacts, generateFacts, factCount, factKeyFor, canonicalKey,
  pickDueQuestion, answerChoices, choicesForAnswer,
} from './mathFacts.js';
import { isTrivialFact } from './mathSchedule.js';

let failures = 0;
function assert(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  → ${detail}`}`);
  if (!ok) failures++;
}
function eq(label, a, b) { assert(label, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

const OPS = ['mul', 'add', 'sub', 'div'];
const ANSWER = { mul: (a, b) => a * b, add: (a, b) => a + b, sub: (a, b) => a - b, div: (a, b) => a / b };

// mul universe now includes 0/1: operands 0..20 → 21*22/2 = 231 deduped facts.
eq('generateAllFacts(20) incl 0/1', generateAllFacts(20).length, 231);
eq('generateAllFacts(9)', generateAllFacts(9).length, 55); // 0..9 → 10*11/2
eq('factCount mul == generateAllFacts', factCount('mul', 20), 231);

// Every op: keys are unique and match factKeyFor; operands satisfy the op's invariant.
for (const op of OPS) {
  const facts = generateFacts(op, 20);
  const keys = new Set(facts.map(f => f.key));
  assert(`${op}: keys unique`, keys.size === facts.length, `${facts.length - keys.size} dupes`);
  assert(`${op}: key == factKeyFor`, facts.every(f => f.key === factKeyFor(op, f.a, f.b)), 'key mismatch');
  let invariantOk = true;
  for (const f of facts) {
    if (op === 'add' && f.a + f.b > 20) invariantOk = false;
    if (op === 'sub' && f.b > f.a) invariantOk = false;
    if (op === 'div' && (f.b < 1 || f.a % f.b !== 0)) invariantOk = false;
    if (op === 'mul' && (f.a > f.b)) invariantOk = false;
  }
  assert(`${op}: operands satisfy invariant`, invariantOk, 'operand invariant broke');
}

// 0/1 trivial facts are now present in every universe.
const has = (op, k) => generateFacts(op, 20).some(f => f.key === k);
assert('mul has 0x5', has('mul', '0x5'), 'missing');
assert('mul has 1x9', has('mul', '1x9'), 'missing');
assert('add has 0+5', has('add', '0+5'), 'missing');
assert('sub has 7-0', has('sub', '7-0'), 'missing');
assert('sub has 7-7', has('sub', '7-7'), 'missing');
assert('div has 5/1', has('div', '5/1'), 'missing');
assert('div has 4/4', has('div', '4/4'), 'missing');

// factKeyFor round-trips / canonicalization.
eq('factKeyFor mul commutes', factKeyFor('mul', 8, 7), canonicalKey(8, 7));
eq('factKeyFor add commutes', factKeyFor('add', 5, 3), '3+5');
eq('factKeyFor sub ordered', factKeyFor('sub', 9, 4), '9-4');
eq('factKeyFor div ordered', factKeyFor('div', 12, 3), '12/3');

// pickDueQuestion: never returns a suppressed key; computes the right answer.
for (const op of OPS) {
  const all = generateFacts(op, 12).map(f => f.key);
  const keep = all[Math.floor(all.length / 2)];
  const suppressed = new Set(all.filter(k => k !== keep)); // leave exactly one due
  let ok = true;
  for (let i = 0; i < 100; i++) {
    const q = pickDueQuestion(op, 12, suppressed, null, {});
    if (!q || q.key !== keep || q.answer !== ANSWER[op](q.a, q.b)) { ok = false; break; }
  }
  assert(`${op}: pickDueQuestion respects suppressed + answer`, ok, 'returned wrong/suppressed key or answer');
  // fully suppressed → null
  eq(`${op}: all suppressed → null`, pickDueQuestion(op, 12, new Set(all), null, {}), null);
}

// Avoids an immediate repeat when alternatives exist.
let repeats = 0, last = null;
for (let i = 0; i < 300; i++) {
  const q = pickDueQuestion('mul', 9, [], last, {});
  if (q.key === last) repeats++;
  last = q.key;
}
assert('pickDueQuestion avoids immediate repeat', repeats === 0, `${repeats} repeats`);

// Trivial 0/1 facts are deprioritized: with non-trivial facts due and no level info,
// the picker (which favors the lowest level, trivial defaulting high) never shows them.
let trivialShown = 0;
for (let i = 0; i < 300; i++) {
  const q = pickDueQuestion('mul', 12, [], null, {});
  if (isTrivialFact('mul', q.a, q.b)) trivialShown++;
}
assert('trivial facts deprioritized', trivialShown === 0, `${trivialShown} trivial facts shown`);

// Explicit level weighting: a single level-0 fact wins over everything else.
const target = '6x7';
const levels = {};
for (const f of generateFacts('mul', 9)) levels[f.key] = f.key === target ? 0 : 5;
let weightOk = true;
for (let i = 0; i < 50; i++) {
  if (pickDueQuestion('mul', 9, [], null, levels).key !== target) { weightOk = false; break; }
}
assert('lowest level is picked first', weightOk, 'did not always pick the level-0 fact');

// choicesForAnswer: 4 distinct, includes correct, non-negative.
const gc = choicesForAnswer(17, 8, 9);
eq('choicesForAnswer length 4', gc.length, 4);
eq('choicesForAnswer distinct', new Set(gc).size, 4);
assert('choicesForAnswer includes correct', gc.includes(17), JSON.stringify(gc));
assert('choicesForAnswer non-negative', gc.every(c => c >= 0), JSON.stringify(gc));
const ac = answerChoices(7, 8);
assert('answerChoices includes 56', ac.includes(56), JSON.stringify(ac));

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
