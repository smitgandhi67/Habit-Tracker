const { test } = require('node:test');
const assert = require('node:assert/strict');

const { DOMAINS, DOMAIN_KEYS, FOUNDATIONAL_KEYS, getDomain, isDomainKey } = require('./domains');
const { CITATIONS, getCitation, citationsForDomain } = require('./citations');

// --- domain registry --------------------------------------------------------

test('domains: exactly 10, unique keys, nums 1..10 in order', () => {
  assert.equal(DOMAINS.length, 10);
  assert.equal(new Set(DOMAIN_KEYS).size, 10);
  assert.deepEqual(DOMAINS.map(d => d.num), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('domains: every domain has a name and description', () => {
  for (const d of DOMAINS) {
    assert.ok(d.name && typeof d.name === 'string', `${d.key} missing name`);
    assert.ok(d.description && d.description.length > 10, `${d.key} weak description`);
  }
});

test('domains: exactly the three foundations are EF, metacognition, emotional', () => {
  assert.deepEqual(
    [...FOUNDATIONAL_KEYS].sort(),
    ['emotional', 'executive_function', 'metacognition'].sort()
  );
  assert.equal(DOMAINS.filter(d => d.foundational).length, 3);
});

test('domains: getDomain / isDomainKey resolve known and reject unknown', () => {
  assert.equal(getDomain('emotional').num, 4);
  assert.equal(getDomain('nope'), null);
  assert.ok(isDomainKey('agency'));
  assert.ok(!isDomainKey('agency_x'));
});

// --- citation registry ------------------------------------------------------

test('citations: unique keys, every domainKey resolves to a real domain', () => {
  const keys = CITATIONS.map(c => c.key);
  assert.equal(new Set(keys).size, keys.length, 'duplicate citation keys');
  for (const c of CITATIONS) {
    assert.ok(Array.isArray(c.domainKeys) && c.domainKeys.length > 0, `${c.key} has no domainKeys`);
    for (const dk of c.domainKeys) {
      assert.ok(isDomainKey(dk), `${c.key} references unknown domain ${dk}`);
    }
  }
});

test('citations: strength enum and KNOWN<=>needsReverify invariant', () => {
  for (const c of CITATIONS) {
    assert.ok(['VERIFIED', 'MIXED', 'KNOWN'].includes(c.strength), `${c.key} bad strength ${c.strength}`);
    // needsReverify is true for, and only for, un-source-checked KNOWN entries.
    assert.equal(c.needsReverify, c.strength === 'KNOWN', `${c.key} needsReverify must track KNOWN`);
  }
});

test('citations: Day 6 re-verification complete — every entry source-checked', () => {
  for (const c of CITATIONS) {
    // Nothing may still be awaiting re-verification (handover §10.5 / R6).
    assert.equal(c.needsReverify, false, `${c.key} still needs re-verification`);
    assert.ok(typeof c.verifyNote === 'string' && c.verifyNote.length > 10, `${c.key} missing verifyNote`);
  }
});

test('citations: every domain has at least one anchor', () => {
  for (const key of DOMAIN_KEYS) {
    assert.ok(citationsForDomain(key).length >= 1, `domain ${key} has no citation`);
  }
});

test('citations: getCitation resolves known and rejects unknown', () => {
  assert.equal(getCitation('moffitt2011').strength, 'VERIFIED');
  assert.equal(getCitation('nope'), null);
});
