// Smoke test for normalizeExerciseName. Run with:
//   node server/utils/exerciseName.smoke.js
// Exits 0 if all assertions pass, 1 otherwise.

const { normalizeExerciseName } = require('./exerciseName');

let failures = 0;
function expect(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${ok ? '' : `→ expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
  if (!ok) failures++;
}

expect('plain lowercase',        normalizeExerciseName('bench press'),        'bench press');
expect('mixed case',             normalizeExerciseName('Bench Press'),        'bench press');
expect('upper case',             normalizeExerciseName('BENCH PRESS'),        'bench press');
expect('leading/trailing space', normalizeExerciseName('  Bench Press  '),    'bench press');
expect('collapsed inner spaces', normalizeExerciseName('Bench    Press'),     'bench press');
expect('tab + newline',          normalizeExerciseName('Bench\t\nPress'),     'bench press');
expect('single word',            normalizeExerciseName(' Squat '),            'squat');
expect('empty string',           normalizeExerciseName(''),                   '');
expect('whitespace only',        normalizeExerciseName('   '),                '');
expect('null',                   normalizeExerciseName(null),                 '');
expect('undefined',              normalizeExerciseName(undefined),            '');
expect('non-string number',      normalizeExerciseName(42),                   '');

console.log(failures === 0 ? '\nAll smoke checks passed.' : `\n${failures} failures.`);
process.exit(failures === 0 ? 0 : 1);
