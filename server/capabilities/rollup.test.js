const { test } = require('node:test');
const assert = require('node:assert/strict');

const { rollupFromContributions, ymdDaysAgo, SOURCES } = require('./rollup');
const { DOMAIN_KEYS } = require('./domains');

test('rollup: returns all 10 domains in registry (num) order, zeroed by default', () => {
  const { domains, totalReps } = rollupFromContributions([]);
  assert.equal(domains.length, 10);
  assert.deepEqual(domains.map(d => d.num), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(domains.map(d => d.key), DOMAIN_KEYS);
  assert.equal(totalReps, 0);
  for (const d of domains) {
    assert.equal(d.reps, 0);
    assert.deepEqual(Object.keys(d.sources).sort(), [...SOURCES].sort());
  }
});

test('rollup: sums reps per domain and per source', () => {
  const { domains, totalReps } = rollupFromContributions([
    { source: 'math', domains: ['cognitive'], reps: 12 },
    { source: 'builder', domains: ['cognitive', 'agency'], reps: 3 },
    { source: 'gym', domains: ['physical'], reps: 4 },
    { source: 'activities', domains: ['emotional'], reps: 1 },
    { source: 'habits', domains: ['emotional'], reps: 2 },
  ]);
  const byKey = Object.fromEntries(domains.map(d => [d.key, d]));

  assert.equal(byKey.cognitive.reps, 15);          // 12 math + 3 builder
  assert.equal(byKey.cognitive.sources.math, 12);
  assert.equal(byKey.cognitive.sources.builder, 3);
  assert.equal(byKey.agency.reps, 3);
  assert.equal(byKey.agency.sources.builder, 3);
  assert.equal(byKey.physical.reps, 4);
  assert.equal(byKey.emotional.reps, 3);            // 1 activity + 2 habits
  assert.equal(byKey.emotional.sources.activities, 1);
  assert.equal(byKey.emotional.sources.habits, 2);

  // total counts each domain hit once (cognitive+agency double-count is intended:
  // a builder rep practices both problem-solving and agency).
  assert.equal(totalReps, 15 + 3 + 4 + 3);
});

test('rollup: ignores unknown domain keys', () => {
  const { domains, totalReps } = rollupFromContributions([
    { source: 'math', domains: ['cognitive', 'not_a_domain'], reps: 5 },
  ]);
  const byKey = Object.fromEntries(domains.map(d => [d.key, d]));
  assert.equal(byKey.cognitive.reps, 5);
  assert.equal(totalReps, 5); // the bogus key added nothing
});

test('rollup: ignores non-positive or non-numeric reps', () => {
  const { totalReps } = rollupFromContributions([
    { source: 'math', domains: ['cognitive'], reps: 0 },
    { source: 'gym', domains: ['physical'], reps: -3 },
    { source: 'habits', domains: ['emotional'], reps: 'oops' },
  ]);
  assert.equal(totalReps, 0);
});

test('rollup: counts reps for an unknown source but attributes them to no source bucket', () => {
  const { domains } = rollupFromContributions([
    { source: 'mystery', domains: ['cognitive'], reps: 7 },
  ]);
  const cog = domains.find(d => d.key === 'cognitive');
  assert.equal(cog.reps, 7);
  for (const s of SOURCES) assert.equal(cog.sources[s], 0);
});

test('ymdDaysAgo: returns a YYYY-MM-DD `days` before the reference date', () => {
  const now = new Date('2026-06-29T12:00:00.000Z');
  assert.equal(ymdDaysAgo(0, now), '2026-06-29');
  assert.equal(ymdDaysAgo(90, now), '2026-03-31');
  assert.match(ymdDaysAgo(1, now), /^\d{4}-\d{2}-\d{2}$/);
});
