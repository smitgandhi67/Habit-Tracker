// Word Decoder content registry — the "universe" of Greek/Latin roots the module
// teaches, loaded from the authored data file. This is the vocabulary analogue of the
// math module's questionTypes registry: the data file owns the content, this module is
// the load/index/select layer on top. Later stages add SRS scheduling + interaction
// selection here; Stage 1 only needs loading, indexing, and type sampling.

import data from '../data/roots.json';

export const CONCEPT_INTRO = data.conceptIntro;
export const ROOTS = data.roots;

// id → root descriptor, for O(1) lookups (decode-word parts reference roots by id).
export const ROOT_BY_ID = new Map(ROOTS.map(r => [r.id, r]));

export const ROOT_TYPES = ['word_family', 'keyword_mnemonic'];

export function getRoot(id) {
  return ROOT_BY_ID.get(id) || null;
}

export function rootsOfType(type) {
  return ROOTS.filter(r => r.type === type);
}

// One representative root of each type (Stage-1 preview: a word_family card + a
// keyword_mnemonic card). Deterministic (first of each) so the demo is stable.
export function oneOfEachType() {
  return ROOT_TYPES
    .map(type => rootsOfType(type)[0])
    .filter(Boolean);
}

// Counts for the header / progress summary.
export function rootCounts() {
  const byType = { word_family: 0, keyword_mnemonic: 0 };
  for (const r of ROOTS) byType[r.type] = (byType[r.type] || 0) + 1;
  return { total: ROOTS.length, ...byType };
}

// Is a decode-word part one of the roots we actually teach? (Parts with a null id are
// affixes/morphemes shown for context but not tracked for mastery.) Used by the decode
// challenge's "ready-roots-only" graduation in a later stage.
export function isTaughtPart(part) {
  return !!part.id && ROOT_BY_ID.has(part.id);
}

// --- interaction helpers (client mirrors of the server's rootsEngine spelling logic) ---

// Spelling variants of a root ("scop / scope" -> ["scop","scope"]), lowercased.
export function stemsOf(root) {
  return String(root.root).split('/').map(s => s.trim().toLowerCase()).filter(Boolean);
}

// Does `word` contain the root (any spelling variant)?
export function containsRoot(root, word) {
  const w = String(word).toLowerCase();
  return stemsOf(root).some(s => w.includes(s));
}

// The substring [start,end) where the root appears in a word (for highlighting), or null.
export function rootSpan(root, word) {
  const w = String(word).toLowerCase();
  for (const s of stemsOf(root)) {
    const at = w.indexOf(s);
    if (at >= 0) return [at, at + s.length];
  }
  return null;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pool of every seed example across all roots (for building distractors), cached.
let _seedPool = null;
function seedPool() {
  if (!_seedPool) _seedPool = ROOTS.flatMap(r => r.seed_examples.map(w => ({ word: w, root: r })));
  return _seedPool;
}

// Four recognition options: one real word that CONTAINS this root + three that do NOT.
// Used by the first-exposure "which word has the root hiding in it?" step.
export function recognitionOptions(root) {
  const correct = root.seed_examples.find(w => containsRoot(root, w)) || root.seed_examples[0];
  const distractors = [];
  const seen = new Set([correct.toLowerCase()]);
  for (const { word } of shuffle(seedPool())) {
    const lw = word.toLowerCase();
    if (seen.has(lw) || containsRoot(root, word)) continue; // must NOT contain this root
    seen.add(lw);
    distractors.push(word);
    if (distractors.length >= 3) break;
  }
  return shuffle([{ word: correct, correct: true }, ...distractors.map(word => ({ word, correct: false }))]);
}

// Meaning multiple-choice: the root's true meaning + three other roots' meanings (distinct).
export function meaningOptions(root, n = 4) {
  const correct = root.meaning;
  const pool = shuffle(ROOTS.filter(r => r.meaning !== correct));
  const opts = [correct];
  for (const r of pool) {
    if (opts.length >= n) break;
    if (!opts.includes(r.meaning)) opts.push(r.meaning);
  }
  return shuffle(opts).map(m => ({ text: m, correct: m === correct }));
}
