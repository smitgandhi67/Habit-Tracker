// Multiplication fact generation + question picking for the practice page.
// Facts are commutative-deduped: 7×8 and 8×7 are the same fact (canonical key "7x8").

export const MIN_OPERAND = 2;
export const MAX_OPERAND = 20;

// Canonical key, min first — matches the server's utils/math.canonicalKey.
export function canonicalKey(a, b) {
  return `${Math.min(a, b)}x${Math.max(a, b)}`;
}

// All 190 unique facts as { a, b, key } with a <= b.
export function generateAllFacts() {
  const facts = [];
  for (let a = MIN_OPERAND; a <= MAX_OPERAND; a++) {
    for (let b = a; b <= MAX_OPERAND; b++) {
      facts.push({ a, b, key: canonicalKey(a, b) });
    }
  }
  return facts;
}

const ALL_FACTS = generateAllFacts();

// Pick the next question from the live pool (all facts minus retired keys),
// in a random orientation, avoiding an immediate repeat of `lastKey`.
// Returns { a, b, key, product } or null when the pool is empty.
export function pickQuestion(retiredKeys = [], lastKey = null) {
  const retired = retiredKeys instanceof Set ? retiredKeys : new Set(retiredKeys);
  let pool = ALL_FACTS.filter(f => !retired.has(f.key));
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
  return { a, b, key: fact.key, product: a * b };
}

// Four answer choices (the correct product + 3 plausible near-miss distractors),
// shuffled. Used for the multiple-choice hint after a wrong typed answer.
export function answerChoices(a, b) {
  const correct = a * b;
  const candidates = new Set([correct]);
  const nudges = [correct + a, correct - a, correct + b, correct - b, correct + 1, correct - 1, correct + 10, correct - 10];
  for (const n of nudges) {
    if (candidates.size >= 4) break;
    if (n > 0 && n !== correct) candidates.add(n);
  }
  // Pad with random nearby values if we still need more (tiny products).
  let pad = correct + 2;
  while (candidates.size < 4) { if (pad > 0) candidates.add(pad); pad += 1; }
  const arr = [...candidates].slice(0, 4);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const TOTAL_FACTS = ALL_FACTS.length; // 190
