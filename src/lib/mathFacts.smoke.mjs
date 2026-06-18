// Smoke test for src/lib/mathFacts.js. Run with:
//   node src/lib/mathFacts.smoke.mjs
// Exits 0 if all assertions pass, 1 otherwise.

import { generateAllFacts, canonicalKey, pickQuestion, answerChoices, choicesForAnswer, pickArithmetic, factCountForMax, TOTAL_FACTS } from './mathFacts.js';

let failures = 0;
function assert(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  → ${detail}`}`);
  if (!ok) failures++;
}
function eq(label, a, b) { assert(label, a === b, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// 190 unique deduped facts
const facts = generateAllFacts();
eq('generateAllFacts length', facts.length, 190);
eq('TOTAL_FACTS', TOTAL_FACTS, 190);
eq('all keys unique', new Set(facts.map(f => f.key)).size, 190);
assert('all keys canonical (a<=b)', facts.every(f => f.a <= f.b), 'found a>b');
eq('canonical commutative', canonicalKey(20, 2), canonicalKey(2, 20));

// grade caps shrink the fact set: 2..9 → 8 values → 8*9/2 = 36 facts
eq('factCountForMax(9) == 36',  factCountForMax(9), 36);
eq('factCountForMax(12) == 66', factCountForMax(12), 66);
eq('factCountForMax(20) == 190', factCountForMax(20), 190);
assert('capped facts never exceed max', generateAllFacts(9).every(f => f.a <= 9 && f.b <= 9), 'found operand > 9');
// pickQuestion respects the cap
let capOk = true;
for (let i = 0; i < 200; i++) {
  const q = pickQuestion([], null, 9);
  if (q.a > 9 || q.b > 9) { capOk = false; break; }
}
assert('pickQuestion respects max cap', capOk, 'returned operand > cap');

// pickQuestion never returns a retired fact
const retired = new Set(facts.slice(0, 189).map(f => f.key)); // leave exactly 1 live
let okPool = true;
for (let i = 0; i < 200; i++) {
  const q = pickQuestion(retired, null);
  if (!q || retired.has(q.key)) { okPool = false; break; }
}
assert('pickQuestion avoids retired', okPool, 'returned a retired/empty fact');

// empty pool → null
eq('pickQuestion empty pool → null', pickQuestion(new Set(facts.map(f => f.key)), null), null);

// avoids immediate repeat when alternatives exist
let repeats = 0;
let last = null;
for (let i = 0; i < 300; i++) {
  const q = pickQuestion([], last);
  if (q.key === last) repeats++;
  last = q.key;
}
assert('pickQuestion avoids immediate repeat', repeats === 0, `${repeats} repeats`);

// product orientation is consistent
const q = pickQuestion([], null);
eq('product matches a*b', q.product, q.a * q.b);

// answerChoices: 4 distinct, includes correct
const choices = answerChoices(7, 8);
eq('answerChoices length', choices.length, 4);
eq('answerChoices distinct', new Set(choices).size, 4);
assert('answerChoices includes correct', choices.includes(56), `got ${JSON.stringify(choices)}`);
assert('answerChoices all positive', choices.every(c => c > 0), `got ${JSON.stringify(choices)}`);
// smallest fact still yields 4 distinct positive choices
const small = answerChoices(2, 2);
eq('small fact 4 distinct', new Set(small).size, 4);
assert('small fact all positive', small.every(c => c > 0), `got ${JSON.stringify(small)}`);

// addition: a+b within cap, answer matches, never an immediate repeat
let addOk = true, addLast = null;
for (let i = 0; i < 400; i++) {
  const q = pickArithmetic('add', 20, addLast);
  if (q.a + q.b > 20 || q.answer !== q.a + q.b || q.op !== 'add' || q.key === addLast) { addOk = false; break; }
  addLast = q.key;
}
assert('add within cap, answer correct, no repeat', addOk, 'add generation invariant broke');

// subtraction: non-negative result within cap
let subOk = true;
for (let i = 0; i < 400; i++) {
  const q = pickArithmetic('sub', 20, null);
  if (q.a > 20 || q.b > q.a || q.answer !== q.a - q.b || q.answer < 0 || q.op !== 'sub') { subOk = false; break; }
}
assert('sub non-negative within cap, answer correct', subOk, 'sub generation invariant broke');

// generic choices include the correct value and are distinct
const gc = choicesForAnswer(17, 8, 9);
eq('choicesForAnswer length 4', gc.length, 4);
eq('choicesForAnswer distinct', new Set(gc).size, 4);
assert('choicesForAnswer includes correct', gc.includes(17), JSON.stringify(gc));
assert('choicesForAnswer non-negative', gc.every(c => c >= 0), JSON.stringify(gc));

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
