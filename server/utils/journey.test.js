const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validGrade, groupByGrade, MIN_GRADE, MAX_GRADE } = require('./journey');

test('validGrade accepts null/undefined and 5..12, rejects the rest', () => {
  assert.equal(validGrade(null), true);
  assert.equal(validGrade(undefined), true);
  for (let g = MIN_GRADE; g <= MAX_GRADE; g++) assert.equal(validGrade(g), true);
  assert.equal(validGrade(4), false);
  assert.equal(validGrade(13), false);
  assert.equal(validGrade(5.5), false);
  assert.equal(validGrade('5'), false);
});

test('groupByGrade orders grades ascending with ungraded last', () => {
  const grouped = groupByGrade([
    { _id: 'a', grade: 7 },
    { _id: 'b', grade: 5 },
    { _id: 'c', grade: null },
    { _id: 'd', grade: 5 },
  ]);
  assert.deepEqual(grouped.map(x => x.grade), [5, 7, null]);
  assert.equal(grouped[0].items.length, 2); // both grade-5 items bucketed together
  assert.equal(grouped.at(-1).grade, null);
});

test('groupByGrade handles empty input', () => {
  assert.deepEqual(groupByGrade([]), []);
  assert.deepEqual(groupByGrade(undefined), []);
});
