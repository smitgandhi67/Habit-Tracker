const { test } = require('node:test');
const assert = require('node:assert/strict');

const { computeTargets } = require('./targets');
const { DOMAINS } = require('./domains');

// All domains at 1.0 unless overridden.
function dims(overrides = {}) {
  return DOMAINS.map(d => ({ key: d.key, score: overrides[d.key] ?? 1 }));
}
const keys = t => t.map(x => x.key);

test('targets: everything solid => no manufactured targets', () => {
  assert.deepEqual(computeTargets(dims()), []);
});

test('targets: one weak foundation is surfaced', () => {
  assert.deepEqual(keys(computeTargets(dims({ emotional: 0.2 }))), ['emotional']);
});

test('targets: weak foundations ranked weakest-first, capped at 3', () => {
  const t = computeTargets(dims({ emotional: 0.1, executive_function: 0.3, metacognition: 0.5 }));
  assert.deepEqual(keys(t), ['emotional', 'executive_function', 'metacognition']);
});

test('targets: a weak non-foundation never outranks a weak foundation', () => {
  // cognitive (non-foundational) is the lowest, but foundations come first.
  const t = computeTargets(dims({ cognitive: 0.05, emotional: 0.1, executive_function: 0.2 }));
  assert.deepEqual(keys(t), ['emotional', 'executive_function']);
  assert.ok(!keys(t).includes('cognitive'));
});

test('targets: falls through to lowest non-foundations when foundations are solid', () => {
  const t = computeTargets(dims({ cognitive: 0.2, physical: 0.4 }));
  assert.deepEqual(keys(t), ['cognitive', 'physical']);
});

test('targets: threshold is strict (0.6 is not "low")', () => {
  assert.deepEqual(computeTargets(dims({ emotional: 0.6 })), []);
  assert.deepEqual(keys(computeTargets(dims({ emotional: 0.59 }))), ['emotional']);
});

test('targets: rows carry foundational flag and name for the UI', () => {
  const [t] = computeTargets(dims({ emotional: 0.2 }));
  assert.equal(t.foundational, true);
  assert.equal(t.name, 'Emotional / intrapersonal');
});
