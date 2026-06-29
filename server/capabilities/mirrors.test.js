const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const url = require('node:url');

// The capability domain + citation registries are intentionally duplicated: a CJS
// copy here (server) and an ESM mirror under src/lib/capabilities (client). They MUST
// stay byte-for-byte equal in their data. These tests load both and diff them so any
// future edit to one mirror without the other fails CI instead of shipping drift.

const serverDomains = require('./domains');
const serverCitations = require('./citations');

const clientUrl = name =>
  url.pathToFileURL(path.join(__dirname, '..', '..', 'src', 'lib', 'capabilities', name)).href;

test('domains mirror: client matches server', async () => {
  const client = await import(clientUrl('domains.js'));
  assert.deepEqual(client.CITATIONS, undefined);
  assert.equal(client.DOMAINS.length, serverDomains.DOMAINS.length);
  assert.deepEqual(client.DOMAINS, serverDomains.DOMAINS, 'DOMAINS data drifted between server and client');
});

test('citations mirror: client matches server', async () => {
  const client = await import(clientUrl('citations.js'));
  assert.equal(client.CITATIONS.length, serverCitations.CITATIONS.length);
  assert.deepEqual(client.CITATIONS, serverCitations.CITATIONS, 'CITATIONS data drifted between server and client');
});
