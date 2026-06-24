// Question generation + due-based picking for the practice page. All per-type rules
// (fact universes, canonical keys, answers, triviality) live in the question-type
// registry (./questionTypes); this module is the scheduling/selection layer on top.

import { getType, factKeyFor as registryFactKey } from './questionTypes.js';
import { initialLevelFor } from './mathSchedule.js';

export const MIN_OPERAND = 2;
export const MAX_OPERAND = 20;

// Canonical multiplication key, min first (kept for callers/tests).
export function canonicalKey(a, b) {
  return `${Math.min(a, b)}x${Math.max(a, b)}`;
}

// Per-operation canonical fact key — delegates to the registry.
export function factKeyFor(op, a, b) {
  return registryFactKey(op, a, b);
}

// All canonical facts for an op within `max` (registry-owned universe).
export function generateFacts(op, max) {
  return getType(op).generate(max);
}

export function factCount(op, max) {
  return generateFacts(op, max).length;
}

// Back-compat (mul) helpers kept for callers/tests.
export function generateAllFacts(max = MAX_OPERAND) {
  return getType('mul').generate(Math.min(max, MAX_OPERAND));
}
export function factCountForMax(max = MAX_OPERAND) {
  return generateAllFacts(max).length;
}

// Turn a canonical fact into a displayed question. Commutative types get a random
// orientation; the registry's display() + answer() produce the prompt and key value.
function renderFact(op, f) {
  const t = getType(op);
  let { a, b } = f;
  if (t.commutative && a !== b && Math.random() < 0.5) [a, b] = [b, a];
  return { a, b, key: f.key, op, answer: t.answer(a, b), display: t.display(a, b) };
}

// Pick the next question for `op`: from the universe, drop suppressed (resting) facts
// and an immediate `lastKey` repeat, then favor the lowest mastery level so new/weak
// facts come before mature ones (trivial facts, seeded high, fall to the back).
// Returns a question or null when nothing is due.
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
  return renderFact(op, lowest[Math.floor(Math.random() * lowest.length)]);
}

// Four shuffled answer choices: the correct value + 3 plausible near-miss distractors.
// NOTE: assumes a non-negative integer answer — future fraction/decimal/negative types
// should supply their own distractor logic (see choicesForQuestion).
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

// Distractors for a rendered question. Square roots use neighbors of the small root
// (not the large radicand); everything else nudges by its operands.
export function choicesForQuestion(q) {
  if (!q) return [];
  if (q.op === 'sqrt') return choicesForAnswer(q.answer, 1, 2);
  return choicesForAnswer(q.answer, q.a, q.b);
}

// Multiplication choices (kept for callers/tests); delegates to the generic helper.
export function answerChoices(a, b) {
  return choicesForAnswer(a * b, a, b);
}

export const TOTAL_FACTS = getType('mul').generate(MAX_OPERAND).length;
