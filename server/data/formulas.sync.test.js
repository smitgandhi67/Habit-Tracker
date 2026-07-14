// Guards the client<->server formulas mirror (same discipline as roots.sync.test.js).
// server/data/formulas.json is the grading-authority copy the Lambda bundles; the client
// renders from src/data/formulas.json. They MUST stay identical. If this fails: copy
// src/data/formulas.json -> server/data/formulas.json.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const server = require('./formulas.json');
const client = require(path.join(__dirname, '..', '..', 'src', 'data', 'formulas.json'));

test('server formulas.json mirrors the client src/data/formulas.json exactly', () => {
  assert.deepEqual(server, client, 'server/data/formulas.json is out of sync — recopy it');
});

test('formula cards have unique ids + required fields, and enough per-topic distractors', () => {
  const ids = new Set(server.map(c => c.id));
  assert.equal(ids.size, server.length, 'duplicate formula ids');
  for (const c of server) assert.ok(c.id && c.topic && c.prompt && c.answer, `card ${c.id} missing a field`);
  const byTopic = {};
  for (const c of server) (byTopic[c.topic] = byTopic[c.topic] || new Set()).add(c.answer);
  for (const [t, answers] of Object.entries(byTopic)) {
    assert.ok(answers.size >= 4, `topic ${t} needs >=4 distinct answers for MC distractors`);
  }
});
