const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ageFromBirthdate } = require('./age');

const NOW = new Date('2026-06-28T12:00:00Z');

test('age: null / undefined / invalid => null', () => {
  assert.equal(ageFromBirthdate(null, NOW), null);
  assert.equal(ageFromBirthdate(undefined, NOW), null);
  assert.equal(ageFromBirthdate('not-a-date', NOW), null);
});

test('age: birthday already passed this year', () => {
  // Born 2016-01-10 → turned 10 in Jan 2026.
  assert.equal(ageFromBirthdate('2016-01-10', NOW), 10);
});

test('age: birthday not yet reached this year counts one less', () => {
  // Born 2016-12-31 → still 9 on 2026-06-28.
  assert.equal(ageFromBirthdate('2016-12-31', NOW), 9);
});

test('age: birthday is today counts as reached', () => {
  // Born 2019-06-28 → exactly 7 today.
  assert.equal(ageFromBirthdate('2019-06-28', NOW), 7);
});

test('age: future birthdate => null', () => {
  assert.equal(ageFromBirthdate('2030-01-01', NOW), null);
});
