const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scoreInstrument, gapReport } = require('./scoring');

// Generic fixture instrument — exercises reverse-scoring, subscale means,
// dimension derivation (with invert + normalization), and interpret().
function fixture() {
  return {
    key: 'test',
    version: 1,
    responseScale: { min: 1, max: 5 },
    items: [
      { id: 'a1', subscale: 'warm' },
      { id: 'a2', subscale: 'warm' },
      { id: 'b1', subscale: 'control', reverse: true },
      { id: 'b2', subscale: 'control' },
    ],
    subscales: [
      { key: 'warm', label: 'Warmth' },
      { key: 'control', label: 'Control' },
    ],
    dimensions: [
      { key: 'responsiveness', from: [{ subscale: 'warm' }], combine: 'mean' },
      // structure pulls from control but inverted (low control => high structure gap)
      { key: 'structure', from: [{ subscale: 'control', invert: true }], combine: 'mean' },
    ],
    interpret(means) {
      const styleKey = means.warm >= means.control ? 'warm_style' : 'control_style';
      return { styleKey, bands: { warm: means.warm } };
    },
  };
}

test('computes subscale raw/mean/n with no reverse items', () => {
  const cfg = fixture();
  const res = scoreInstrument(cfg, [
    { itemId: 'a1', value: 5 },
    { itemId: 'a2', value: 3 },
    { itemId: 'b1', value: 5 },
    { itemId: 'b2', value: 5 },
  ]);
  const warm = res.subscales.find(s => s.key === 'warm');
  assert.equal(warm.raw, 8);
  assert.equal(warm.n, 2);
  assert.equal(warm.mean, 4);
});

test('reverse-scores items (min+max-value) before aggregating', () => {
  const cfg = fixture();
  const res = scoreInstrument(cfg, [
    { itemId: 'a1', value: 4 },
    { itemId: 'a2', value: 4 },
    { itemId: 'b1', value: 2 }, // reverse => 1+5-2 = 4
    { itemId: 'b2', value: 4 },
  ]);
  const control = res.subscales.find(s => s.key === 'control');
  assert.equal(control.raw, 8); // 4 + 4
  assert.equal(control.mean, 4);
});

test('derives dimensions normalized to 0..1, applying invert', () => {
  const cfg = fixture();
  const res = scoreInstrument(cfg, [
    { itemId: 'a1', value: 4 },
    { itemId: 'a2', value: 4 }, // warm mean 4 => norm (4-1)/4 = 0.75
    { itemId: 'b1', value: 5 }, // reverse => 1
    { itemId: 'b2', value: 1 }, // control means [1,1] => 1; inverted => 5; norm 1.0
  ]);
  const resp = res.dimensions.find(d => d.key === 'responsiveness');
  const struct = res.dimensions.find(d => d.key === 'structure');
  assert.equal(resp.score, 0.75);
  assert.equal(struct.score, 1); // control mean 1, inverted to 5, normalized 1.0
});

test('interpret receives subscale means and returns styleKey', () => {
  const cfg = fixture();
  const res = scoreInstrument(cfg, [
    { itemId: 'a1', value: 5 },
    { itemId: 'a2', value: 5 },
    { itemId: 'b1', value: 5 }, // reverse => 1
    { itemId: 'b2', value: 1 },
  ]);
  assert.equal(res.interpretation.styleKey, 'warm_style');
  assert.equal(res.interpretation.bands.warm, 5);
});

test('rejects unknown itemId', () => {
  const cfg = fixture();
  assert.throws(() => scoreInstrument(cfg, [
    { itemId: 'a1', value: 3 }, { itemId: 'a2', value: 3 },
    { itemId: 'b1', value: 3 }, { itemId: 'zz', value: 3 },
  ]), /unknown item/i);
});

test('rejects out-of-range value', () => {
  const cfg = fixture();
  assert.throws(() => scoreInstrument(cfg, [
    { itemId: 'a1', value: 9 }, { itemId: 'a2', value: 3 },
    { itemId: 'b1', value: 3 }, { itemId: 'b2', value: 3 },
  ]), /out of range/i);
});

test('rejects missing items (incomplete submission)', () => {
  const cfg = fixture();
  assert.throws(() => scoreInstrument(cfg, [
    { itemId: 'a1', value: 3 }, { itemId: 'a2', value: 3 },
  ]), /missing|incomplete/i);
});

test('rejects duplicate item responses', () => {
  const cfg = fixture();
  assert.throws(() => scoreInstrument(cfg, [
    { itemId: 'a1', value: 3 }, { itemId: 'a1', value: 4 },
    { itemId: 'b1', value: 3 }, { itemId: 'b2', value: 3 },
  ]), /duplicate/i);
});

test('gapReport aligns shared dimensions with delta + alignment label', () => {
  const parent = [
    { key: 'warmth', score: 0.80 },
    { key: 'consistency', score: 0.60 },
    { key: 'parent_only', score: 0.5 },
  ];
  const child = [
    { key: 'warmth', score: 0.50 }, // delta 0.30 => large-ish
    { key: 'consistency', score: 0.55 }, // delta 0.05 => aligned
    { key: 'child_only', score: 0.5 },
  ];
  const gap = gapReport(parent, child);
  assert.equal(gap.length, 2); // only shared keys
  const warmth = gap.find(g => g.key === 'warmth');
  assert.equal(warmth.parent, 0.80);
  assert.equal(warmth.child, 0.50);
  assert.equal(Math.round(warmth.delta * 100) / 100, 0.30);
  assert.equal(warmth.alignment, 'some-gap');
  const cons = gap.find(g => g.key === 'consistency');
  assert.equal(cons.alignment, 'aligned');
});
