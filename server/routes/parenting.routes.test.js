// HTTP-layer integration tests for the parenting router. The mongoose models are
// stubbed (methods replaced) so these run with no DB connection — mongoose.model()
// only registers a schema; we never connect. Covers status codes, authz, input
// validation, and subject determination. Scoring correctness is covered by
// parenting/instruments.test.js + parenting/scoring.test.js.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ADMIN_EMAIL = 'admin.e2e@example.com';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Stub model methods BEFORE requiring the router.
const ParentingAttempt = require('../models/ParentingAttempt');
const ParentingConfig = require('../models/ParentingConfig');
const store = new Map();
ParentingConfig.findOne = async () => ({ active: [] });
ParentingConfig.create = async d => d;
ParentingAttempt.create = async doc => {
  const _id = new mongoose.Types.ObjectId().toString();
  const saved = { ...doc, _id, completedAt: new Date() };
  store.set(_id, saved);
  return saved;
};
ParentingAttempt.findById = async id => store.get(String(id)) || null;

const requireAuth = require('../middleware/auth');
const router = require('./parenting');
const style = require('../parenting/instruments/style');

let server, base;
before(async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/parenting', requireAuth, router);
  app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(r => server.close(r)));

function cookie(id, email) {
  return `token=${jwt.sign({ _id: id, email, name: email }, process.env.JWT_SECRET)}`;
}
const userA = new mongoose.Types.ObjectId().toString();
const userB = new mongoose.Types.ObjectId().toString();
const ckA = cookie(userA, 'a.e2e@example.com');
const ckB = cookie(userB, 'b.e2e@example.com');
const ckAdmin = cookie(new mongoose.Types.ObjectId().toString(), 'admin.e2e@example.com');

function authoritativeResponses() {
  return style.items.map(it => ({
    itemId: it.id,
    value: ['connection', 'regulation', 'autonomy'].includes(it.subscale) ? 5 : 1,
  }));
}

test('GET /instruments requires auth', async () => {
  const res = await fetch(`${base}/api/parenting/instruments`);
  assert.equal(res.status, 401);
});

test('GET /instruments lists style for an authed user', async () => {
  const res = await fetch(`${base}/api/parenting/instruments`, { headers: { Cookie: ckA } });
  const list = await res.json();
  assert.equal(res.status, 200);
  assert.ok(list.some(i => i.key === 'style'));
});

test('GET /instruments/style returns 32 items and leaks no scoring keys', async () => {
  const res = await fetch(`${base}/api/parenting/instruments/style`, { headers: { Cookie: ckA } });
  const form = await res.json();
  assert.equal(form.items.length, 32);
  assert.ok(form.items.every(it => it.subscale === undefined && it.reverse === undefined));
});

test('POST /attempts scores server-side and returns 201', async () => {
  const res = await fetch(`${base}/api/parenting/attempts`, {
    method: 'POST', headers: { Cookie: ckA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrumentKey: 'style', responses: authoritativeResponses() }),
  });
  const result = await res.json();
  assert.equal(res.status, 201);
  assert.equal(result.interpretation.styleKey, 'authoritative');
  assert.equal(result.subscales.length, 7);
  assert.ok(result.subscales[0].label);
  assert.equal(String(result.subjectUserId), userA); // self-report subject = taker
});

test('GET /attempts/:id — owner 200, other user 403, admin 200', async () => {
  const created = await (await fetch(`${base}/api/parenting/attempts`, {
    method: 'POST', headers: { Cookie: ckA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrumentKey: 'style', responses: authoritativeResponses() }),
  })).json();
  const owner = await fetch(`${base}/api/parenting/attempts/${created._id}`, { headers: { Cookie: ckA } });
  assert.equal(owner.status, 200);
  const other = await fetch(`${base}/api/parenting/attempts/${created._id}`, { headers: { Cookie: ckB } });
  assert.equal(other.status, 403);
  const admin = await fetch(`${base}/api/parenting/attempts/${created._id}`, { headers: { Cookie: ckAdmin } });
  assert.equal(admin.status, 200);
});

test('POST /attempts rejects incomplete submission with 400', async () => {
  const res = await fetch(`${base}/api/parenting/attempts`, {
    method: 'POST', headers: { Cookie: ckA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrumentKey: 'style', responses: authoritativeResponses().slice(0, 10) }),
  });
  assert.equal(res.status, 400);
});

test('POST /attempts rejects unknown instrument with 404', async () => {
  const res = await fetch(`${base}/api/parenting/attempts`, {
    method: 'POST', headers: { Cookie: ckA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrumentKey: 'nope', responses: [] }),
  });
  assert.equal(res.status, 404);
});

test('GET /attempts/:id with bad id is 404', async () => {
  const res = await fetch(`${base}/api/parenting/attempts/not-an-id`, { headers: { Cookie: ckA } });
  assert.equal(res.status, 404);
});
