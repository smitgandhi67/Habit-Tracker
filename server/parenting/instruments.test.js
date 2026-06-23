const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scoreInstrument } = require('./scoring');
const style = require('./instruments/style');

// Build a full response set by assigning each item a value based on its facet.
function responsesByFacet(inst, facetValues, fallback) {
  return inst.items.map(it => ({
    itemId: it.id,
    value: facetValues[it.subscale] ?? fallback,
  }));
}

test('style: warm + reasoning + autonomy high, harsh/indulgent low => authoritative', () => {
  const res = scoreInstrument(style, responsesByFacet(style, {
    connection: 5, regulation: 5, autonomy: 5,
  }, 1));
  assert.equal(res.interpretation.styleKey, 'authoritative');
  assert.equal(res.interpretation.bands.scales.authoritative, 5);
  assert.equal(res.interpretation.bands.scales.authoritarian, 1);
});

test('style: harsh facets high => authoritarian', () => {
  const res = scoreInstrument(style, responsesByFacet(style, {
    physical_coercion: 5, verbal_hostility: 5, non_reasoning: 5,
  }, 1));
  assert.equal(res.interpretation.styleKey, 'authoritarian');
  assert.equal(res.interpretation.bands.scales.authoritarian, 5);
});

test('style: indulgent high, others low => permissive', () => {
  const res = scoreInstrument(style, responsesByFacet(style, {
    indulgent: 5,
  }, 1));
  assert.equal(res.interpretation.styleKey, 'permissive');
});

test('style: everything low => uninvolved', () => {
  const res = scoreInstrument(style, responsesByFacet(style, {}, 1));
  assert.equal(res.interpretation.styleKey, 'uninvolved');
});

test('style: shared gap dimensions (warmth, consistency) present and normalized', () => {
  const res = scoreInstrument(style, responsesByFacet(style, {
    connection: 5, regulation: 5, autonomy: 5,
  }, 1));
  const warmth = res.dimensions.find(d => d.key === 'warmth');
  const consistency = res.dimensions.find(d => d.key === 'consistency');
  assert.equal(warmth.score, 1);      // connection mean 5 => (5-1)/4 = 1
  assert.equal(consistency.score, 1); // regulation 5 (norm 1) + indulgent 1 inverted to 5 (norm 1) => 1
});

test('style: instrument shape is valid (32 items, 7 facets, no duplicate ids)', () => {
  assert.equal(style.items.length, 32);
  assert.equal(style.subscales.length, 7);
  const ids = new Set(style.items.map(i => i.id));
  assert.equal(ids.size, 32);
  const facets = new Set(style.subscales.map(s => s.key));
  for (const it of style.items) assert.ok(facets.has(it.subscale), `item ${it.id} bad facet ${it.subscale}`);
});
