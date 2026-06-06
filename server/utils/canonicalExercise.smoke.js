// Smoke test for canonicalizeExercise. Run with:
//   node server/utils/canonicalExercise.smoke.js
// Exits 0 if all assertions pass, 1 otherwise.

const { canonicalizeExercise } = require('./canonicalExercise');

let failures = 0;
function expectEq(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${ok ? '' : `→ expected ${e}, got ${a}`}`);
  if (!ok) failures++;
}

// Catalog match → snap BOTH name and bodyPart to catalog, regardless of input casing/part.
expectEq('match snaps casing',
  canonicalizeExercise({ name: 'leg extensions', bodyPart: 'legs' }, { name: 'Leg Extensions', bodyPart: 'legs' }),
  { name: 'Leg Extensions', bodyPart: 'legs' });

expectEq('match snaps bodyPart too',
  canonicalizeExercise({ name: 'Shoulder press', bodyPart: 'arms' }, { name: 'Shoulder Press', bodyPart: 'shoulders' }),
  { name: 'Shoulder Press', bodyPart: 'shoulders' });

// No catalog match → keep typed name (trimmed), bodyPart unchanged.
expectEq('no match trims, keeps part',
  canonicalizeExercise({ name: '  Farmer Carry  ', bodyPart: 'full_body' }, null),
  { name: 'Farmer Carry', bodyPart: 'full_body' });

expectEq('no match undefined catalog',
  canonicalizeExercise({ name: 'Novel Move', bodyPart: 'core' }, undefined),
  { name: 'Novel Move', bodyPart: 'core' });

// Non-string name with no match → passed through (route validation handles emptiness).
expectEq('no match non-string name',
  canonicalizeExercise({ name: null, bodyPart: 'legs' }, null),
  { name: null, bodyPart: 'legs' });

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
