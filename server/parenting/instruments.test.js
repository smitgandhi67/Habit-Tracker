const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scoreInstrument } = require('./scoring');
const style = require('./instruments/style');
const scale = require('./instruments/scale');
const childView = require('./instruments/child_view');

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

// --- Parenting Scale ---------------------------------------------------------
// Ideal answer = score 1 after reverse adjustment: value 1 for left-anchor items,
// value 7 for reverse (right-anchor) items. Worst = the opposite.
const idealScale = () => scale.items.map(it => ({ itemId: it.id, value: it.reverse ? 7 : 1 }));
const worstScale = () => scale.items.map(it => ({ itemId: it.id, value: it.reverse ? 1 : 7 }));

test('scale: shape is 30 items with 14 reverse (right-anchor) items', () => {
  assert.equal(scale.items.length, 30);
  assert.equal(scale.items.filter(i => i.reverse).length, 14);
  assert.ok(scale.items.every(i => i.anchorLow && i.anchorHigh));
});

test('scale: ideal answers => all factor means 1, total 1, no flags', () => {
  const res = scoreInstrument(scale, idealScale());
  const b = res.interpretation.bands;
  assert.equal(b.factors.laxness, 1);
  assert.equal(b.factors.overreactivity, 1);
  assert.equal(b.factors.hostility, 1);
  assert.equal(b.total, 1);
  assert.equal(b.flags.laxness || b.flags.overreactivity || b.flags.hostility || b.flags.total, false);
});

test('scale: worst answers => factor means 7, total 7, all flags elevated', () => {
  const res = scoreInstrument(scale, worstScale());
  const b = res.interpretation.bands;
  assert.equal(b.factors.laxness, 7);
  assert.equal(b.factors.hostility, 7);
  assert.equal(b.total, 7);
  assert.ok(b.flags.laxness && b.flags.overreactivity && b.flags.hostility && b.flags.total);
});

test('scale: consistency dimension is high for ideal, low for worst (gap-compatible)', () => {
  const ideal = scoreInstrument(scale, idealScale());
  const worst = scoreInstrument(scale, worstScale());
  const c = r => r.dimensions.find(d => d.key === 'consistency').score;
  assert.equal(c(ideal), 1); // laxness 1 -> inverted 7 -> normalized 1
  assert.equal(c(worst), 0); // laxness 7 -> inverted 1 -> normalized 0
});

// --- Child's-View ------------------------------------------------------------
const childAll = v => childView.items.map(it => ({ itemId: it.id, value: v }));

test('child_view: shape — 14 items, 3-point scale, no corporal-punishment items', () => {
  assert.equal(childView.items.length, 14);
  assert.deepEqual(childView.responseScale, { min: 1, max: 3 });
  const text = childView.items.map(i => i.text.toLowerCase()).join(' ');
  for (const banned of ['hit', 'spank', 'slap', 'hits you', 'beat']) {
    assert.ok(!text.includes(banned), `child item should not mention "${banned}"`);
  }
});

test('child_view: warm + consistent answers => high warmth & consistency', () => {
  // Warmth items high (3), inconsistency items low (1) => warm + consistent.
  const responses = childView.items.map(it => ({
    itemId: it.id,
    value: it.subscale === 'inconsistent' ? 1 : 3,
  }));
  const res = scoreInstrument(childView, responses);
  const warmth = res.dimensions.find(d => d.key === 'warmth').score;
  const consistency = res.dimensions.find(d => d.key === 'consistency').score;
  assert.equal(warmth, 1);       // involvement+positive mean 3 -> normalized 1
  assert.equal(consistency, 1);  // inconsistent mean 1 -> inverted 3 -> normalized 1
});

test('child_view: gap dimension keys match the parent instruments', () => {
  const childDims = new Set(childView.dimensions.map(d => d.key));
  const styleDims = new Set(style.dimensions.map(d => d.key));
  for (const k of ['warmth', 'consistency']) {
    assert.ok(childDims.has(k) && styleDims.has(k), `shared dimension ${k} missing`);
  }
});

test('child_view: interpretation has no clinical styleKey and is gentle', () => {
  const res = scoreInstrument(childView, childAll(2));
  assert.equal(res.interpretation.styleKey, undefined);
  assert.match(res.interpretation.kidSummary, /thanks/i);
});
