// Fact generation + question picking for the practice page, across all four ops.
// Facts are op-local canonical: commutative ops (mul/add) dedupe orientation
// (7×8 == 8×7 → "7x8"); ordered ops (sub/div) keep operand order. Operands now
// include 0 and 1 (trivial facts) — see isTrivialFact in mathSchedule.js.

import { initialLevelFor } from './mathSchedule.js';

export const MIN_OPERAND = 2;
export const MAX_OPERAND = 20;

// Canonical multiplication key, min first — matches server utils/math.canonicalKey.
export function canonicalKey(a, b) {
  return `${Math.min(a, b)}x${Math.max(a, b)}`;
}

// Per-operation canonical fact key. Mirrors server utils/math.factKeyFor.
export function factKeyFor(op, a, b) {
  if (op === 'add') return `${Math.min(a, b)}+${Math.max(a, b)}`;
  if (op === 'sub') return `${a}-${b}`;
  if (op === 'div') return `${a}/${b}`;
  return canonicalKey(a, b); // mul
}

// ---- finite fact universes (grade-capped via `max`) -----------------------
// Each returns canonical facts { a, b, key } (a<=b for commutative ops). Operands
// include 0/1 so the trivial facts exist in the pool (deprioritized, not shown often).

function genMul(max) {
  const cap = Math.min(max, MAX_OPERAND);
  const facts = [];
  for (let a = 0; a <= cap; a++) {
    for (let b = a; b <= cap; b++) facts.push({ a, b, key: canonicalKey(a, b) });
  }
  return facts;
}

function genAdd(max) {
  const facts = [];
  for (let a = 0; a <= max; a++) {
    for (let b = a; a + b <= max; b++) facts.push({ a, b, key: factKeyFor('add', a, b) });
  }
  return facts;
}

function genSub(max) {
  const facts = [];
  for (let a = 0; a <= max; a++) {
    for (let b = 0; b <= a; b++) facts.push({ a, b, key: factKeyFor('sub', a, b) });
  }
  return facts;
}

function genDiv(max) {
  const facts = [];
  for (let b = 1; b <= max; b++) {
    for (let q = 1; b * q <= max; q++) {
      const a = b * q;
      facts.push({ a, b, key: factKeyFor('div', a, b) });
    }
  }
  return facts;
}

// Dispatcher: all canonical facts for an op within `max`.
export function generateFacts(op, max) {
  if (op === 'add') return genAdd(max);
  if (op === 'sub') return genSub(max);
  if (op === 'div') return genDiv(max);
  return genMul(max);
}

export function factCount(op, max) {
  return generateFacts(op, max).length;
}

// Back-compat (mul) helpers kept for callers/tests.
export function generateAllFacts(max = MAX_OPERAND) {
  return genMul(Math.min(max, MAX_OPERAND));
}
export function factCountForMax(max = MAX_OPERAND) {
  return genMul(Math.min(max, MAX_OPERAND)).length;
}

// ---- question rendering + due-based selection -----------------------------

const ANSWER = {
  mul: (a, b) => a * b,
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  div: (a, b) => a / b,
};

// Turn a canonical fact into a displayed question. Commutative ops get a random
// orientation; ordered ops (sub/div) keep operand order.
function renderFact(op, f) {
  let { a, b } = f;
  if ((op === 'mul' || op === 'add') && a !== b && Math.random() < 0.5) {
    [a, b] = [b, a];
  }
  const answer = ANSWER[op](a, b);
  const q = { a, b, key: f.key, op, answer };
  if (op === 'mul') q.product = answer;
  return q;
}

// Pick the next question for `op`: from the universe, drop suppressed (resting)
// facts and an immediate `lastKey` repeat, then favor the lowest mastery level so
// new/weak facts come before mature ones (trivial 0/1 facts, seeded high, fall to
// the back). `levelByKey` maps factKey → level; facts with no row use their
// trivial-aware initial level. Returns a question or null when nothing is due.
export function pickDueQuestion(op, max, suppressed = [], lastKey = null, levelByKey = {}) {
  const sup = suppressed instanceof Set ? suppressed : new Set(suppressed);
  let pool = generateFacts(op, max).filter(f => !sup.has(f.key));
  if (pool.length === 0) return null;
  if (pool.length > 1 && lastKey) {
    const trimmed = pool.filter(f => f.key !== lastKey);
    if (trimmed.length) pool = trimmed;
  }
  const levelOf = f => (f.key in levelByKey ? levelByKey[f.key] : initialLevelFor(op, f.a, f.b));
  const minLevel = Math.min(...pool.map(levelOf));
  const lowest = pool.filter(f => levelOf(f) === minLevel);
  const fact = lowest[Math.floor(Math.random() * lowest.length)];
  return renderFact(op, fact);
}

// Four shuffled answer choices: the correct value + 3 plausible near-miss distractors.
// Works for any operation (operands a,b inform the nudges).
export function choicesForAnswer(correct, a = 1, b = 1) {
  const candidates = new Set([correct]);
  const nudges = [correct + a, correct - a, correct + b, correct - b, correct + 1, correct - 1, correct + 2, correct - 2, correct + 10];
  for (const n of nudges) {
    if (candidates.size >= 4) break;
    if (n >= 0 && n !== correct) candidates.add(n);
  }
  let pad = correct + 3;
  while (candidates.size < 4) { if (pad >= 0) candidates.add(pad); pad += 1; }
  const arr = [...candidates].slice(0, 4);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Multiplication choices (kept for callers/tests); delegates to the generic helper.
export function answerChoices(a, b) {
  return choicesForAnswer(a * b, a, b);
}

export const TOTAL_FACTS = genMul(MAX_OPERAND).length;
