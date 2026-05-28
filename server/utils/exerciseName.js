// Normalize an exercise name for global uniqueness checks.
// Lowercases, trims, and collapses internal whitespace.
function normalizeExerciseName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

module.exports = { normalizeExerciseName };
