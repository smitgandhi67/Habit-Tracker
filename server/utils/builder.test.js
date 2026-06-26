const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  POINTS, DAILY_PROBLEM_CAP, problemAward, canShip, topFluency, fluencyRank,
} = require('./builder');

test('problemAward pays up to the daily cap, then zero', () => {
  for (let n = 0; n < DAILY_PROBLEM_CAP; n++) assert.equal(problemAward(n), POINTS.problem);
  assert.equal(problemAward(DAILY_PROBLEM_CAP), 0);
  assert.equal(problemAward(DAILY_PROBLEM_CAP + 5), 0);
});

test('canShip enforces the explain-every-line gate', () => {
  const p = { title: 'Swim timer', shippedAt: null };
  assert.equal(canShip(p, true).ok, true);
  assert.equal(canShip(p, false).ok, false);     // must attest
  assert.equal(canShip(p, 'yes').ok, false);      // strictly true only
});

test('canShip blocks missing title, already-shipped, and missing project', () => {
  assert.equal(canShip({ title: '   ', shippedAt: null }, true).ok, false);
  assert.equal(canShip({ title: 'x', shippedAt: new Date() }, true).ok, false);
  assert.equal(canShip(null, true).ok, false);
});

test('fluencyRank orders the ladder, unknown → 0', () => {
  assert.equal(fluencyRank('helper'), 0);
  assert.equal(fluencyRank('tool'), 1);
  assert.equal(fluencyRank('partner'), 2);
  assert.equal(fluencyRank('multiplier'), 3);
  assert.equal(fluencyRank('bogus'), 0);
});

test('topFluency = highest aiLevel across shipped projects', () => {
  assert.deepEqual(topFluency([]), { level: 0, label: 'helper', shipped: 0 });
  assert.deepEqual(
    topFluency([{ aiLevel: 'tool' }, { aiLevel: 'partner' }, { aiLevel: 'helper' }]),
    { level: 2, label: 'partner', shipped: 3 },
  );
  assert.deepEqual(
    topFluency([{ aiLevel: 'multiplier' }]),
    { level: 3, label: 'multiplier', shipped: 1 },
  );
});
