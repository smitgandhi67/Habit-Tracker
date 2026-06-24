// Smoke test for src/lib/mathFacts.js + question-type registry.
// Run with: node src/lib/mathFacts.smoke.mjs
// Exits 0 if all assertions pass, 1 otherwise.

import {
  generateAllFacts, generateFacts, factCount, factKeyFor, canonicalKey,
  pickDueQuestion, answerChoices, choicesForAnswer, choicesForQuestion,
} from './mathFacts.js';
import { TYPES, OP_KEYS } from './questionTypes.js';
import { isTrivialFact } from './mathSchedule.js';

let failures = 0;
function assert(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  → ${detail}`}`);
  if (!ok) failures++;
}
function eq(label, a, b) { assert(label, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// registry shape
eq('registry has 6 types', OP_KEYS.join(','), 'mul,add,sub,div,sq,sqrt');

// mul universe includes 0/1: operands 0..20 → 231 deduped facts.
eq('generateAllFacts(20) incl 0/1', generateAllFacts(20).length, 231);
eq('generateAllFacts(9)', generateAllFacts(9).length, 55);
eq('factCount mul', factCount('mul', 20), 231);

// Every registered type: keys unique, key == factKeyFor, operands satisfy invariant,
// rendered answer matches the descriptor.
for (const op of OP_KEYS) {
  const facts = generateFacts(op, 12);
  assert(`${op}: non-empty universe`, facts.length > 0, 'empty');
  const keys = new Set(facts.map(f => f.key));
  assert(`${op}: keys unique`, keys.size === facts.length, `${facts.length - keys.size} dupes`);
  assert(`${op}: key == factKeyFor`, facts.every(f => f.key === factKeyFor(op, f.a, f.b)), 'key mismatch');
  let inv = true;
  for (const f of facts) {
    if (op === 'mul' && f.a > f.b) inv = false;
    if (op === 'add' && (f.a > f.b || f.a + f.b > 12)) inv = false;
    if (op === 'sub' && f.b > f.a) inv = false;
    if (op === 'div' && (f.b < 1 || f.a % f.b !== 0)) inv = false;
    if (op === 'sq' && f.a !== f.b) inv = false;
    if (op === 'sqrt' && f.b * f.b !== f.a) inv = false;
  }
  assert(`${op}: operand invariant`, inv, 'broke');
}

// 0/1 trivial facts present in every universe.
const has = (op, k) => generateFacts(op, 20).some(f => f.key === k);
assert('mul has 0x5', has('mul', '0x5'), 'missing');
assert('add has 0+5', has('add', '0+5'), 'missing');
assert('sub has 7-7', has('sub', '7-7'), 'missing');
assert('div has 5/1', has('div', '5/1'), 'missing');
assert('sq has sq:0', has('sq', 'sq:0'), 'missing');
assert('sqrt has sqrt:1', has('sqrt', 'sqrt:1'), 'missing');

// squares + square roots specifics
eq('sq generate(10) count', generateFacts('sq', 10).length, 11);   // 0..10
eq('sqrt generate(10) count', generateFacts('sqrt', 10).length, 11);
eq('sq factKey', factKeyFor('sq', 7, 7), 'sq:7');
eq('sqrt factKey by radicand', factKeyFor('sqrt', 144, 12), 'sqrt:144');
eq('sq display', TYPES.sq.display(8), '8²');
eq('sqrt display', TYPES.sqrt.display(144), '√144');
assert('sqrt radicands are perfect squares', generateFacts('sqrt', 12).every(f => Math.sqrt(f.a) === f.b), 'non-square radicand');

// factKeyFor round-trips / canonicalization for binary ops.
eq('factKeyFor mul commutes', factKeyFor('mul', 8, 7), canonicalKey(8, 7));
eq('factKeyFor add commutes', factKeyFor('add', 5, 3), '3+5');
eq('factKeyFor sub ordered', factKeyFor('sub', 9, 4), '9-4');
eq('factKeyFor div ordered', factKeyFor('div', 12, 3), '12/3');

// pickDueQuestion: never returns a suppressed key; answer matches the descriptor.
for (const op of OP_KEYS) {
  const all = generateFacts(op, 12).map(f => f.key);
  const keep = all[Math.floor(all.length / 2)];
  const suppressed = new Set(all.filter(k => k !== keep));
  let ok = true;
  for (let i = 0; i < 80; i++) {
    const q = pickDueQuestion(op, 12, suppressed, null, {});
    if (!q || q.key !== keep || q.answer !== TYPES[op].answer(q.a, q.b) || !q.display) { ok = false; break; }
  }
  assert(`${op}: pickDueQuestion respects suppressed + answer + display`, ok, 'bad pick');
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

// Trivial facts deprioritized (favor lowest level; trivial defaults high).
let trivialShown = 0;
for (let i = 0; i < 300; i++) {
  const q = pickDueQuestion('mul', 12, [], null, {});
  if (isTrivialFact('mul', q.a, q.b)) trivialShown++;
}
assert('trivial facts deprioritized', trivialShown === 0, `${trivialShown} trivial shown`);

// Explicit level weighting: a single level-0 fact wins.
const target = '6x7';
const levels = {};
for (const f of generateFacts('mul', 9)) levels[f.key] = f.key === target ? 0 : 5;
let weightOk = true;
for (let i = 0; i < 50; i++) if (pickDueQuestion('mul', 9, [], null, levels).key !== target) { weightOk = false; break; }
assert('lowest level picked first', weightOk, 'did not pick level-0 fact');

// choices: square roots use small-root neighbors (not the big radicand).
const sqrtQ = { op: 'sqrt', a: 144, b: 12, answer: 12 };
const sqrtCh = choicesForQuestion(sqrtQ);
eq('sqrt choices length 4', sqrtCh.length, 4);
assert('sqrt choices include root 12', sqrtCh.includes(12), JSON.stringify(sqrtCh));
assert('sqrt choices stay small', sqrtCh.every(c => c <= 22), JSON.stringify(sqrtCh));
const gc = choicesForAnswer(17, 8, 9);
eq('choicesForAnswer distinct', new Set(gc).size, 4);
assert('answerChoices includes 56', answerChoices(7, 8).includes(56), 'missing');

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
