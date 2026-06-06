// Snap a logged or planned exercise to the catalog's canonical form so that
// every layer (catalog → logs → plans → progress) agrees on one name string.
//
// `match` is the catalog Exercise doc found by nameKey, or null/undefined:
//   - match found → adopt the catalog's `name` AND `bodyPart` (catalog wins)
//   - no match    → keep the typed name (trimmed); leave bodyPart as given,
//                   so users can still log exercises not yet in the catalog
//
// Pure: takes the already-resolved catalog doc, does no I/O. Callers look up
// `match` via Exercise.findOne({ nameKey }) or a prebuilt nameKey→doc map.
function canonicalizeExercise({ name, bodyPart }, match) {
  if (match) return { name: match.name, bodyPart: match.bodyPart };
  return { name: typeof name === 'string' ? name.trim() : name, bodyPart };
}

module.exports = { canonicalizeExercise };
