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
