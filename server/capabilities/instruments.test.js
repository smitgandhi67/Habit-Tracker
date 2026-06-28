const { test } = require('node:test');
const assert = require('node:assert/strict');

const { scoreInstrument, gapReport } = require('../parenting/scoring');
const { DOMAIN_KEYS } = require('./domains');
const parentBaseline = require('./instruments/parent_baseline');
const kidBaseline = require('./instruments/kid_baseline');

const allAt = (inst, v) => inst.items.map(it => ({ itemId: it.id, value: v }));

// --- shapes -----------------------------------------------------------------

test('parent_baseline: 20 items (2/domain), Likert 1–5, rates a child', () => {
  assert.equal(parentBaseline.items.length, 20);
  assert.equal(parentBaseline.audience, 'parent');
  assert.equal(parentBaseline.subjectMode, 'rated-child');
  assert.deepEqual(parentBaseline.responseScale, { min: 1, max: 5 });
  assert.equal(new Set(parentBaseline.items.map(i => i.id)).size, 20, 'duplicate ids');
  for (const key of DOMAIN_KEYS) {
    assert.equal(parentBaseline.items.filter(i => i.subscale === key).length, 2, `domain ${key} needs 2 items`);
  }
  // baseline is higher-better: no reverse-keyed items.
  assert.ok(parentBaseline.items.every(i => !i.reverse));
});

test('kid_baseline: 10 items (1/domain), 3-point faces, self-report', () => {
  assert.equal(kidBaseline.items.length, 10);
  assert.equal(kidBaseline.audience, 'child');
  assert.equal(kidBaseline.subjectMode, 'self');
  assert.equal(kidBaseline.format, 'faces');
  assert.deepEqual(kidBaseline.responseScale, { min: 1, max: 3 });
  for (const key of DOMAIN_KEYS) {
    assert.equal(kidBaseline.items.filter(i => i.subscale === key).length, 1, `domain ${key} needs 1 item`);
  }
});

test('baseline instruments share the 10 domain keys as dimensions (gap-compatible)', () => {
  const pDims = new Set(parentBaseline.dimensions.map(d => d.key));
  const kDims = new Set(kidBaseline.dimensions.map(d => d.key));
  for (const key of DOMAIN_KEYS) {
    assert.ok(pDims.has(key) && kDims.has(key), `shared domain ${key} missing`);
  }
  assert.equal(pDims.size, 10);
  assert.equal(kDims.size, 10);
});

// --- scoring ----------------------------------------------------------------

test('parent_baseline: all-5 => every domain 1.0; all-1 => 0.0', () => {
  const hi = scoreInstrument(parentBaseline, allAt(parentBaseline, 5));
  for (const d of hi.dimensions) assert.equal(d.score, 1, `${d.key} should be 1`);
  const lo = scoreInstrument(parentBaseline, allAt(parentBaseline, 1));
  for (const d of lo.dimensions) assert.equal(d.score, 0, `${d.key} should be 0`);
});

test('parent_baseline: a single domain mid-scale normalizes correctly', () => {
  // Everything 1 except emotional items at 3 => emotional (3-1)/4 = 0.5.
  const responses = parentBaseline.items.map(it => ({
    itemId: it.id,
    value: it.subscale === 'emotional' ? 3 : 1,
  }));
  const res = scoreInstrument(parentBaseline, responses);
  const emo = res.dimensions.find(d => d.key === 'emotional');
  assert.equal(emo.score, 0.5);
});

test('kid_baseline: all-3 => 1.0; all-1 => 0.0', () => {
  const hi = scoreInstrument(kidBaseline, allAt(kidBaseline, 3));
  for (const d of hi.dimensions) assert.equal(d.score, 1, `${d.key} should be 1`);
  const lo = scoreInstrument(kidBaseline, allAt(kidBaseline, 1));
  for (const d of lo.dimensions) assert.equal(d.score, 0, `${d.key} should be 0`);
});

test('scoring rejects an incomplete submission', () => {
  const partial = parentBaseline.items.slice(0, 5).map(it => ({ itemId: it.id, value: 3 }));
  assert.throws(() => scoreInstrument(parentBaseline, partial), /missing items/i);
});

test('scoring rejects an out-of-range response', () => {
  const bad = allAt(kidBaseline, 1);
  bad[0].value = 9;
  assert.throws(() => scoreInstrument(kidBaseline, bad), /out of range/i);
});

// --- baseline gap math ------------------------------------------------------

test('baseline gap: parent high vs kid low => +1 delta, large-gap, all 10 domains', () => {
  const parentDims = scoreInstrument(parentBaseline, allAt(parentBaseline, 5)).dimensions;
  const kidDims = scoreInstrument(kidBaseline, allAt(kidBaseline, 1)).dimensions;
  const gap = gapReport(parentDims, kidDims);
  assert.equal(gap.length, 10);
  for (const g of gap) {
    assert.equal(g.delta, 1);
    assert.equal(g.alignment, 'large-gap');
  }
});

test('baseline gap: a domain where the kid rates higher than the parent is negative', () => {
  // Parent rates emotional low (1), kid rates emotional high (3); rest aligned-ish.
  const pResp = parentBaseline.items.map(it => ({ itemId: it.id, value: it.subscale === 'emotional' ? 1 : 5 }));
  const kResp = kidBaseline.items.map(it => ({ itemId: it.id, value: 3 }));
  const parentDims = scoreInstrument(parentBaseline, pResp).dimensions;
  const kidDims = scoreInstrument(kidBaseline, kResp).dimensions;
  const gap = gapReport(parentDims, kidDims);
  const emo = gap.find(g => g.key === 'emotional');
  assert.equal(emo.parent, 0);
  assert.equal(emo.child, 1);
  assert.equal(emo.delta, -1);
});
