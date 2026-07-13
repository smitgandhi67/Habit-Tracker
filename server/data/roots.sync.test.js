// Guards the client<->server roots content mirror. server/data/roots.json is the
// grading-authority copy the Lambda bundles (it can't reach up into src/); the client
// renders from src/data/roots.json. They MUST stay byte-for-byte identical — this test
// fails loudly if one is edited without the other (same discipline as the questionTypes
// registry mirror). If it fails: copy src/data/roots.json -> server/data/roots.json.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const serverData = require('./roots.json');
const clientData = require(path.join(__dirname, '..', '..', 'src', 'data', 'roots.json'));

test('server roots.json mirrors the client src/data/roots.json exactly', () => {
  assert.deepEqual(serverData, clientData, 'server/data/roots.json is out of sync with src/data/roots.json — recopy it');
});

test('roots data has unique ids and no dangling decode-part references', () => {
  const roots = serverData.roots;
  const ids = new Set(roots.map(r => r.id));
  assert.equal(ids.size, roots.length, 'duplicate root ids');
  for (const r of roots) {
    for (const dw of r.decode_words || []) {
      for (const p of dw.parts) {
        if (p.id) assert.ok(ids.has(p.id), `decode word ${dw.word} references unknown root id ${p.id}`);
      }
    }
  }
});

test('every keyword_mnemonic root ships a mnemonic image', () => {
  for (const r of serverData.roots.filter(r => r.type === 'keyword_mnemonic')) {
    assert.ok(r.mnemonic && r.mnemonic.keyword && r.mnemonic.image_text, `root ${r.id} missing mnemonic`);
  }
});
