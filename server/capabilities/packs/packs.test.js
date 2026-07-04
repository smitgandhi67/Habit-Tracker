// Integrity tests for the Depth Pack templates: every pack must be a complete,
// well-formed 12-week × 5-day curriculum whose references (domains, metrics) resolve.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { listPacks, getPack, kidWritableMetricKeys } = require('./index');
const { DOMAINS } = require('../domains');

const DOMAIN_KEYS = new Set(DOMAINS.map(d => d.key));

test('registry lists both pilot packs and getPack resolves them', () => {
  const keys = listPacks().map(p => p.key).sort();
  assert.deepEqual(keys, ['communication_precision', 'learning_to_learn']);
  assert.equal(getPack('learning_to_learn').title, 'Learning-to-learn & Memory');
  assert.equal(getPack('nope'), null);
});

for (const pack of listPacks()) {
  test(`${pack.key}: 12 weeks × 5 days, sequential numbering`, () => {
    assert.equal(pack.weeks.length, 12);
    pack.weeks.forEach((w, i) => {
      assert.equal(w.week, i + 1);
      assert.ok(w.theme.length > 0);
      assert.equal(w.days.length, 5);
      w.days.forEach((d, j) => assert.equal(d.day, j + 1));
    });
  });

  test(`${pack.key}: ladder is exactly L0–L5 with milestones`, () => {
    assert.equal(pack.ladder.length, 6);
    pack.ladder.forEach((l, i) => {
      assert.equal(l.level, i);
      assert.ok(l.milestone.length > 10);
    });
  });

  test(`${pack.key}: domainKeys valid, habitDefaults complete`, () => {
    assert.ok(pack.domainKeys.length >= 1);
    for (const k of pack.domainKeys) assert.ok(DOMAIN_KEYS.has(k), `bad domain ${k}`);
    assert.ok(pack.habitDefaults.name && pack.habitDefaults.emoji && pack.habitDefaults.frequency);
  });

  test(`${pack.key}: metrics well-formed, unique keys, sane bounds`, () => {
    const keys = pack.metrics.map(m => m.key);
    assert.equal(new Set(keys).size, keys.length);
    for (const m of pack.metrics) {
      assert.ok(m.label.length > 0);
      assert.ok(Number.isFinite(m.min) && Number.isFinite(m.max) && m.min < m.max);
    }
  });

  test(`${pack.key}: every day has steps + timer; scoreMetric refs resolve`, () => {
    const metricKeys = new Set(pack.metrics.map(m => m.key));
    for (const w of pack.weeks) for (const d of w.days) {
      assert.ok(d.title.length > 0, `${w.week}/${d.day} title`);
      assert.ok(Array.isArray(d.steps) && d.steps.length >= 1, `${w.week}/${d.day} steps`);
      for (const s of d.steps) assert.ok(typeof s === 'string' && s.length > 0);
      assert.ok(d.timerMin >= 5 && d.timerMin <= 20, `${w.week}/${d.day} timer`);
      if (d.scoreMetric) assert.ok(metricKeys.has(d.scoreMetric), `${w.week}/${d.day} scoreMetric ${d.scoreMetric}`);
    }
    assert.ok(kidWritableMetricKeys(pack).size >= 1, 'at least one kid-scorable metric');
  });
}
