const { test } = require('node:test');
const assert = require('node:assert/strict');
const { effectivePoints, PROMO_END_MS } = require('./mathBonus');

const DURING = PROMO_END_MS - 1;   // last instant the promo is live
const AFTER = PROMO_END_MS;        // expiry instant (inclusive cutoff)

const smit = { email: 'smit@example.com' };
const mit = { email: 'mit@example.com' };
const other = { email: 'amitgandhi23@gmail.com' };

test('1-point questions pay the per-kid promo during the window', () => {
  assert.equal(effectivePoints(1, smit, DURING), 5);
  assert.equal(effectivePoints(1, mit, DURING), 3);
});

test('email match is case-insensitive and prefix-based', () => {
  assert.equal(effectivePoints(1, { email: 'Smit.Gandhi@x.com' }, DURING), 5);
  assert.equal(effectivePoints(1, { email: 'MIT.kid@x.com' }, DURING), 3);
});

test("'smit' is not mistaken for the 'mit' rule", () => {
  assert.equal(effectivePoints(1, smit, DURING), 5);
});

test('higher-weight question types are never boosted', () => {
  for (const base of [2, 3, 4, 5]) {
    assert.equal(effectivePoints(base, smit, DURING), base);
    assert.equal(effectivePoints(base, mit, DURING), base);
  }
});

test('unknown / missing users keep the base weight', () => {
  assert.equal(effectivePoints(1, other, DURING), 1);
  assert.equal(effectivePoints(1, null, DURING), 1);
  assert.equal(effectivePoints(1, { email: '' }, DURING), 1);
});

test('promo is inert at and after the UTC cutoff', () => {
  assert.equal(effectivePoints(1, smit, AFTER), 1);
  assert.equal(effectivePoints(1, mit, AFTER), 1);
  assert.equal(effectivePoints(1, smit, AFTER + 86_400_000), 1);
});

test('cutoff is end-of-day Sun 2026-06-28 UTC (expires midnight Jun 29 UTC)', () => {
  assert.equal(PROMO_END_MS, Date.UTC(2026, 5, 29, 0, 0, 0));
  assert.equal(new Date(PROMO_END_MS).toISOString(), '2026-06-29T00:00:00.000Z');
});
