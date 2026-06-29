const { test } = require('node:test');
const assert = require('node:assert/strict');

const { ACTIVITIES } = require('./activitiesSeed');
const { isDomainKey, FOUNDATIONAL_KEYS } = require('./domains');
const { getCitation } = require('./citations');

test('activities: unique slugs', () => {
  const slugs = ACTIVITIES.map(a => a.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate slug');
});

test('activities: every domainKey resolves to a real domain', () => {
  for (const a of ACTIVITIES) {
    assert.ok(a.domainKeys.length > 0, `${a.slug} has no domains`);
    for (const k of a.domainKeys) assert.ok(isDomainKey(k), `${a.slug} bad domain ${k}`);
  }
});

test('activities: citationKey (when set) resolves to a real citation', () => {
  for (const a of ACTIVITIES) {
    if (a.citationKey != null) {
      assert.ok(getCitation(a.citationKey), `${a.slug} bad citationKey ${a.citationKey}`);
    }
  }
});

test('activities: kind + tier invariants', () => {
  for (const a of ACTIVITIES) {
    assert.ok(['do', 'skip'].includes(a.kind), `${a.slug} bad kind`);
    if (a.kind === 'do') {
      assert.ok([1, 2, 3].includes(a.tier), `${a.slug} do-item needs tier 1-3`);
      assert.ok(a.approachRule && a.approachRule.length > 10, `${a.slug} needs an approach rule`);
    } else {
      assert.equal(a.tier, null, `${a.slug} skip-item should have null tier`);
      assert.ok(a.skipReason && a.skipReason.length > 10, `${a.slug} skip needs a reason`);
    }
  }
});

test('activities: age bounds are sane when set', () => {
  for (const a of ACTIVITIES) {
    if (a.minAge != null && a.maxAge != null) {
      assert.ok(a.minAge <= a.maxAge, `${a.slug} minAge > maxAge`);
    }
  }
});

test('activities: every foundational domain has a Tier-1 anchor', () => {
  const tier1 = ACTIVITIES.filter(a => a.kind === 'do' && a.tier === 1);
  for (const f of FOUNDATIONAL_KEYS) {
    assert.ok(tier1.some(a => a.domainKeys.includes(f)), `no Tier-1 activity builds ${f}`);
  }
});

test('activities: at least one item per tier and a skip list', () => {
  for (const t of [1, 2, 3]) {
    assert.ok(ACTIVITIES.some(a => a.tier === t && a.kind === 'do'), `no Tier-${t} activity`);
  }
  assert.ok(ACTIVITIES.some(a => a.kind === 'skip'), 'no skip list');
});
