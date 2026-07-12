// HTTP + authz tests for the account-linking router and the parent-of helpers.
// Mongoose model statics are stubbed against in-memory stores (no DB) so we cover
// status codes, the consent flow (request -> approve/reject/revoke), and that
// assertParentOf / linkedChildIds reflect only APPROVED links.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ADMIN_EMAIL = 'admin.e2e@example.com';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId().toString();
// chainable query stubs
const qOne  = r => ({ select: () => qOne(r), lean: () => Promise.resolve(r) });
const qList = r => ({ select: () => qList(r), sort: () => qList(r), limit: () => qList(r), lean: () => Promise.resolve(r) });

// --- stub models BEFORE requiring the router / utils/auth (shared module cache) ---
const AccountLink = require('../models/AccountLink');
const User = require('../models/User');

const links = new Map(); // _id -> live record (mutated in place; save() is a no-op persist)
function makeLink(doc) {
  const _id = doc._id || oid();
  const rec = { respondedAt: null, createdAt: new Date(), ...doc, _id };
  rec.save = async () => { links.set(String(_id), rec); return rec; };
  links.set(String(_id), rec);
  return rec;
}
const sameId = (a, b) => String(a) === String(b);
AccountLink.create = async (doc) => makeLink({ ...doc, _id: oid() });
AccountLink.findOne = async (filter) => {
  for (const l of links.values()) {
    if (sameId(l.parentId, filter.parentId) && sameId(l.childId, filter.childId)) return l;
  }
  return null;
};
AccountLink.findById = async (id) => links.get(String(id)) || null;
AccountLink.findOneAndUpdate = async (filter, update) => {
  for (const l of links.values()) {
    if (filter._id && !sameId(l._id, filter._id)) continue;
    if (filter.childId && !sameId(l.childId, filter.childId)) continue;
    if (filter.parentId && !sameId(l.parentId, filter.parentId)) continue;
    if (filter.status && l.status !== filter.status) continue;
    Object.assign(l, update.$set || {});
    return l;
  }
  return null;
};
const matchList = (l, filter) =>
  (!filter.parentId || sameId(l.parentId, filter.parentId)) &&
  (!filter.childId || sameId(l.childId, filter.childId)) &&
  (!filter.status || l.status === filter.status);
AccountLink.find = (filter) => qList([...links.values()].filter(l => matchList(l, filter)));
AccountLink.exists = async (filter) => {
  for (const l of links.values()) if (matchList(l, filter)) return { _id: l._id };
  return null;
};
AccountLink.countDocuments = async (filter) => [...links.values()].filter(l => matchList(l, filter)).length;

const users = new Map();
const addUser = (u) => { users.set(String(u._id), u); return u; };
User.findOne = (filter) => {
  const rx = filter?.email; // a RegExp in the links router
  const found = [...users.values()].find(u => (rx instanceof RegExp ? rx.test(u.email) : u.email === rx)) || null;
  return qOne(found);
};
User.findById = (id) => qOne(users.get(String(id)) || null);
User.find = (filter) => {
  const ids = filter?._id?.$in?.map(String);
  const list = ids ? ids.map(id => users.get(id)).filter(Boolean) : [...users.values()];
  return qList(list);
};

const requireAuth = require('../middleware/auth');
const linksRouter = require('./links');
const { assertParentOf, linkedChildIds } = require('../utils/auth');

// Actors
const parentId = oid(), childId = oid(), strangerId = oid();
addUser({ _id: parentId,   name: 'Parent',   email: 'parent@example.com',   photo: null });
addUser({ _id: childId,    name: 'Child',    email: 'child@example.com',    photo: null });
addUser({ _id: strangerId, name: 'Stranger', email: 'stranger@example.com', photo: null });

const cookie = (id, email) => `token=${jwt.sign({ _id: id, email, name: email }, process.env.JWT_SECRET)}`;
const ckParent = cookie(parentId, 'parent@example.com');
const ckChild = cookie(childId, 'child@example.com');
const post = (ck, body) => ({ method: 'POST', headers: { Cookie: ck, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });

let server, base;
before(async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/links', requireAuth, linksRouter);
  app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(r => server.close(r)));

test('requires auth (401 without cookie)', async () => {
  assert.equal((await fetch(`${base}/api/links`)).status, 401);
});

test('POST /links: missing email -> 400', async () => {
  assert.equal((await fetch(`${base}/api/links`, post(ckParent, {}))).status, 400);
});

test('POST /links: unknown email -> 404', async () => {
  assert.equal((await fetch(`${base}/api/links`, post(ckParent, { childEmail: 'nobody@example.com' }))).status, 404);
});

test('POST /links: linking your own account -> 400', async () => {
  assert.equal((await fetch(`${base}/api/links`, post(ckParent, { childEmail: 'parent@example.com' }))).status, 400);
});

test('parent-of is false before any approved link', async () => {
  assert.equal(await assertParentOf({ user: { _id: parentId, email: 'parent@example.com' } }, childId), false);
});

let linkId;
test('POST /links: valid child email -> 201 pending', async () => {
  const res = await fetch(`${base}/api/links`, post(ckParent, { childEmail: 'child@example.com' }));
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.status, 'pending');
  assert.equal(body.account.email, 'child@example.com');
  linkId = body._id;
});

test('POST /links: repeat request -> 200 already pending', async () => {
  const res = await fetch(`${base}/api/links`, post(ckParent, { childEmail: 'CHILD@example.com' })); // case-insensitive
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.already, 'pending');
});

test('child sees the incoming pending request', async () => {
  const res = await fetch(`${base}/api/links?direction=incoming`, { headers: { Cookie: ckChild } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.length, 1);
  assert.equal(body[0].status, 'pending');
  assert.equal(body[0].account.email, 'parent@example.com');
});

test('non-child cannot approve (parent approving own request -> 404)', async () => {
  assert.equal((await fetch(`${base}/api/links/${linkId}/approve`, post(ckParent))).status, 404);
});

test('child approves -> 200 approved, and parent-of becomes true', async () => {
  const res = await fetch(`${base}/api/links/${linkId}/approve`, post(ckChild));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'approved');
  assert.equal(await assertParentOf({ user: { _id: parentId, email: 'parent@example.com' } }, childId), true);
  assert.deepEqual(await linkedChildIds(parentId), [String(childId)]);
});

test('a stranger is NOT a parent of the child', async () => {
  assert.equal(await assertParentOf({ user: { _id: strangerId, email: 'stranger@example.com' } }, childId), false);
});

test('superuser is parent of anyone (break-glass)', async () => {
  assert.equal(await assertParentOf({ user: { _id: oid(), email: process.env.ADMIN_EMAIL } }, childId), true);
});

test('parent sees the child as approved in outgoing', async () => {
  const res = await fetch(`${base}/api/links?direction=outgoing`, { headers: { Cookie: ckParent } });
  const body = await res.json();
  assert.equal(body.length, 1);
  assert.equal(body[0].status, 'approved');
});

test('revoke removes access; re-request re-opens as pending', async () => {
  const del = await fetch(`${base}/api/links/${linkId}`, { method: 'DELETE', headers: { Cookie: ckParent } });
  assert.equal(del.status, 200);
  assert.equal(await assertParentOf({ user: { _id: parentId, email: 'parent@example.com' } }, childId), false);

  const re = await fetch(`${base}/api/links`, post(ckParent, { childEmail: 'child@example.com' }));
  const body = await re.json();
  assert.equal(re.status, 200);
  assert.equal(body.status, 'pending');
});
