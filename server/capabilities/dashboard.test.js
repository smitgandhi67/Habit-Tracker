const { test } = require('node:test');
const assert = require('node:assert/strict');

const { foldMathStats, summarizeMilestones } = require('./dashboard');

test('foldMathStats: sums correct + points, counts active days (correct>0)', () => {
  const out = foldMathStats([
    { correct: 5, points: 7 },
    { correct: 0, points: 0 },   // not an active day
    { correct: 3, points: 9 },
  ]);
  assert.deepEqual(out, { correct: 8, points: 16, activeDays: 2 });
});

test('foldMathStats: empty + missing fields are zero', () => {
  assert.deepEqual(foldMathStats(), { correct: 0, points: 0, activeDays: 0 });
  assert.deepEqual(foldMathStats([{}]), { correct: 0, points: 0, activeDays: 0 });
});

test('summarizeMilestones: total + done count', () => {
  const out = summarizeMilestones([
    { status: 'done' }, { status: 'upcoming' }, { status: 'in_progress' }, { status: 'done' },
  ]);
  assert.deepEqual(out, { total: 4, done: 2 });
});

test('summarizeMilestones: empty', () => {
  assert.deepEqual(summarizeMilestones([]), { total: 0, done: 0 });
});
