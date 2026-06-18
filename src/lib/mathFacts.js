// Multiplication fact generation + question picking for the practice page.
// Facts are commutative-deduped: 7×8 and 8×7 are the same fact (canonical key "7x8").

export const MIN_OPERAND = 2;
export const MAX_OPERAND = 20;

// Canonical key, min first — matches the server's utils/math.canonicalKey.
export function canonicalKey(a, b) {
  return `${Math.min(a, b)}x${Math.max(a, b)}`;
}

// All unique facts as { a, b, key } with a <= b, both operands in [2, max].
// max defaults to the full range (20) → 190 facts; a grade cap shrinks the set.
export function generateAllFacts(max = MAX_OPERAND) {
  const cap = Math.min(max, MAX_OPERAND);
  const facts = [];
  for (let a = MIN_OPERAND; a <= cap; a++) {
    for (let b = a; b <= cap; b++) {
      facts.push({ a, b, key: canonicalKey(a, b) });
    }
  }
  return facts;
}

const ALL_FACTS = generateAllFacts();

// Number of unique facts available at a given operand cap (for "facts left" display).
export function factCountForMax(max = MAX_OPERAND) {
  return generateAllFacts(max).length;
}

// Pick the next question from the live pool (facts within `max`, minus retired keys),
// in a random orientation, avoiding an immediate repeat of `lastKey`.
// Returns { a, b, key, product } or null when the pool is empty.
export function pickQuestion(retiredKeys = [], lastKey = null, max = MAX_OPERAND) {
  const retired = retiredKeys instanceof Set ? retiredKeys : new Set(retiredKeys);
  let pool = generateAllFacts(max).filter(f => !retired.has(f.key));
  if (pool.length === 0) return null;
  if (pool.length > 1 && lastKey) {
    const trimmed = pool.filter(f => f.key !== lastKey);
    if (trimmed.length) pool = trimmed;
  }
  const fact = pool[Math.floor(Math.random() * pool.length)];
  // Random orientation so the kid sees both 7×8 and 8×7.
  const flip = fact.a !== fact.b && Math.random() < 0.5;
  const a = flip ? fact.b : fact.a;
  const b = flip ? fact.a : fact.b;
  return { a, b, key: fact.key, op: 'mul', product: a * b, answer: a * b };
}

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Generate an addition/subtraction question within `max` (operands + result capped).
// Subtraction stays non-negative. Returns the unified question shape with op + answer.
// Avoids an immediate repeat of `lastKey`.
export function pickArithmetic(op, max = 20, lastKey = null) {
  for (let tries = 0; tries < 25; tries++) {
    let a, b;
    if (op === 'add') {
      a = randInt(1, Math.max(1, max - 1));
      b = randInt(1, Math.max(1, max - a)); // a + b <= max
    } else { // sub — result a - b >= 0
      a = randInt(1, max);
      b = randInt(0, a);
    }
    const key = `${op}:${a}:${b}`;
    if (key === lastKey) continue;
    return { a, b, key, op, answer: op === 'add' ? a + b : a - b };
  }
  // Fallback (extremely unlikely to loop out): accept a repeat.
  const a = op === 'add' ? randInt(1, Math.max(1, max - 1)) : randInt(1, max);
  const b = op === 'add' ? randInt(1, Math.max(1, max - a)) : randInt(0, a);
  return { a, b, key: `${op}:${a}:${b}`, op, answer: op === 'add' ? a + b : a - b };
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

export const TOTAL_FACTS = ALL_FACTS.length; // 190
