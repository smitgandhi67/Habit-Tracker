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
const cfgDoc = { active: [], save: async () => {} };
ParentingConfig.findOne = async () => cfgDoc;
ParentingConfig.create = async d => d;
ParentingAttempt.create = async doc => {
  const _id = new mongoose.Types.ObjectId().toString();
  const saved = { ...doc, _id, completedAt: new Date() };
  store.set(_id, saved);
  return saved;
};
ParentingAttempt.findById = async id => store.get(String(id)) || null;
function matchAttempts(filter) {
  let arr = [...store.values()];
  if (filter.userId) arr = arr.filter(d => String(d.userId) === String(filter.userId));
  if (filter.subjectUserId) arr = arr.filter(d => String(d.subjectUserId) === String(filter.subjectUserId));
  if (filter.instrumentKey) arr = arr.filter(d => d.instrumentKey === filter.instrumentKey);
  if (filter.completedAt?.$lt) arr = arr.filter(d => d.completedAt < filter.completedAt.$lt);
  return arr;
}
ParentingAttempt.find = filter => {
  const q = {
    _arr: matchAttempts(filter),
    sort() { this._arr.sort((a, b) => b.completedAt - a.completedAt); return this; },
    limit(n) { this._n = n; return this; },
    lean() { return Promise.resolve(this._n ? this._arr.slice(0, this._n) : this._arr); },
  };
  return q;
};
ParentingAttempt.findOne = filter => {
  const q = {
    _arr: matchAttempts(filter),
    sort() { this._arr.sort((a, b) => b.completedAt - a.completedAt); return this; },
    lean() { return Promise.resolve(this._arr[0] || null); },
  };
  return q;
};

// Stub User + ParentingLink for the admin/child endpoints.
const User = require('../models/User');
const ParentingLink = require('../models/ParentingLink');
const adminUserId = new mongoose.Types.ObjectId().toString();
const leanOf = val => ({ select: () => ({ lean: async () => val }), lean: async () => val });
User.findOne = () => leanOf({ _id: adminUserId });          // admin lookup (child subject default)
User.findById = id => leanOf({ _id: String(id) });           // link target exists
User.find = () => leanOf([{ _id: adminUserId, name: 'Admin', email: 'admin.e2e@example.com' }]);
const linkStore = new Map();
ParentingLink.find = q => ({ lean: async () => [...linkStore.values()].filter(l => String(l.parentUserId) === String(q.parentUserId)) });
ParentingLink.create = async doc => {
  if ([...linkStore.values()].some(l => String(l.parentUserId) === String(doc.parentUserId) && String(l.childUserId) === String(doc.childUserId))) {
    const e = new Error('dup'); e.code = 11000; throw e;
  }
  const _id = new mongoose.Types.ObjectId().toString();
  const saved = { ...doc, _id }; linkStore.set(_id, saved); return saved;
};
ParentingLink.findOne = async q => {
  for (const l of linkStore.values()) {
    if (String(l.parentUserId) === String(q.parentUserId) && String(l.childUserId) === String(q.childUserId)) return l;
  }
  return null;
};
ParentingLink.findOneAndDelete = async q => {
  for (const [k, l] of linkStore) {
    if (String(l._id) === String(q._id) && String(l.parentUserId) === String(q.parentUserId)) { linkStore.delete(k); return l; }
  }
  return null;
};

const requireAuth = require('../middleware/auth');
const router = require('./parenting');
const style = require('../parenting/instruments/style');
const childView = require('../parenting/instruments/child_view');

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

test('GET /attempts returns caller history with cursor pagination', async () => {
  const u = new mongoose.Types.ObjectId().toString();
  const ck = cookie(u, 'hist.e2e@example.com');
  // two attempts
  for (let i = 0; i < 2; i++) {
    await fetch(`${base}/api/parenting/attempts`, {
      method: 'POST', headers: { Cookie: ck, 'Content-Type': 'application/json' },
      body: JSON.stringify({ instrumentKey: 'style', responses: authoritativeResponses() }),
    });
  }
  const all = await (await fetch(`${base}/api/parenting/attempts?instrumentKey=style`, { headers: { Cookie: ck } })).json();
  assert.equal(all.items.length, 2);
  assert.equal(all.nextCursor, null);
  assert.ok(all.items[0].completedAt);

  const firstPage = await (await fetch(`${base}/api/parenting/attempts?instrumentKey=style&limit=1`, { headers: { Cookie: ck } })).json();
  assert.equal(firstPage.items.length, 1);
  assert.ok(firstPage.nextCursor);
});

test('GET /attempts rejects an invalid cursor with 400', async () => {
  const res = await fetch(`${base}/api/parenting/attempts?cursor=notadate`, { headers: { Cookie: ckA } });
  assert.equal(res.status, 400);
});

test('POST child_view without subjectUserId defaults subject to the parent (admin)', async () => {
  const responses = childView.items.map(it => ({ itemId: it.id, value: 3 }));
  const res = await fetch(`${base}/api/parenting/attempts`, {
    method: 'POST', headers: { Cookie: ckB, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrumentKey: 'child_view', responses }),
  });
  const result = await res.json();
  assert.equal(res.status, 201);
  assert.equal(String(result.subjectUserId), adminUserId); // rated parent, not the child
});

test('gap: parent vs linked child shows shared dimensions; unlinked caller 403; admin/gap works', async () => {
  const parentId = new mongoose.Types.ObjectId().toString();
  const childId = new mongoose.Types.ObjectId().toString();
  const pCk = cookie(parentId, 'admin.e2e@example.com'); // family parent is the admin
  const cCk = cookie(childId, 'kid.gap@example.com');

  // parent self-report (style)
  await fetch(`${base}/api/parenting/attempts`, {
    method: 'POST', headers: { Cookie: pCk, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrumentKey: 'style', responses: authoritativeResponses() }),
  });
  // child rates this parent explicitly
  const childWarm = childView.items.map(it => ({ itemId: it.id, value: it.subscale === 'inconsistent' ? 1 : 3 }));
  await fetch(`${base}/api/parenting/attempts`, {
    method: 'POST', headers: { Cookie: cCk, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrumentKey: 'child_view', responses: childWarm, subjectUserId: parentId }),
  });
  // link
  await fetch(`${base}/api/parenting/admin/links`, {
    method: 'POST', headers: { Cookie: pCk, 'Content-Type': 'application/json' },
    body: JSON.stringify({ childUserId: childId }),
  });

  const gapRes = await fetch(`${base}/api/parenting/gap?childUserId=${childId}`, { headers: { Cookie: pCk } });
  assert.equal(gapRes.status, 200);
  const gap = await gapRes.json();
  assert.ok(gap.parent.hasData && gap.child.hasData);
  const keys = gap.gap.map(g => g.key);
  assert.ok(keys.includes('warmth') && keys.includes('consistency'));
  for (const g of gap.gap) assert.ok(['aligned', 'some-gap', 'large-gap'].includes(g.alignment));

  // a different (unlinked) user is blocked
  const blocked = await fetch(`${base}/api/parenting/gap?childUserId=${childId}`, { headers: { Cookie: ckA } });
  assert.equal(blocked.status, 403);

  // admin can view any pair
  const adminGap = await fetch(`${base}/api/parenting/admin/gap?parentUserId=${parentId}&childUserId=${childId}`, { headers: { Cookie: ckAdmin } });
  assert.equal(adminGap.status, 200);
});

test('admin config: lists active versions and updates them', async () => {
  const list = await (await fetch(`${base}/api/parenting/admin/config`, { headers: { Cookie: ckAdmin } })).json();
  assert.ok(list.some(c => c.instrumentKey === 'style' && c.activeVersion === 1));
  const ok = await fetch(`${base}/api/parenting/admin/config`, {
    method: 'PUT', headers: { Cookie: ckAdmin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrumentKey: 'style', version: 1 }),
  });
  assert.equal(ok.status, 200);
  const bad = await fetch(`${base}/api/parenting/admin/config`, {
    method: 'PUT', headers: { Cookie: ckAdmin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ instrumentKey: 'style', version: 99 }),
  });
  assert.equal(bad.status, 400);
});

test('admin links: non-admin forbidden, admin can create/list/delete, duplicate 409', async () => {
  const childId = new mongoose.Types.ObjectId().toString();
  // non-admin blocked
  const forbidden = await fetch(`${base}/api/parenting/admin/links`, {
    method: 'POST', headers: { Cookie: ckA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ childUserId: childId }),
  });
  assert.equal(forbidden.status, 403);
  // admin creates
  const created = await fetch(`${base}/api/parenting/admin/links`, {
    method: 'POST', headers: { Cookie: ckAdmin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ childUserId: childId, label: 'Kid' }),
  });
  assert.equal(created.status, 201);
  const link = await created.json();
  // duplicate -> 409
  const dup = await fetch(`${base}/api/parenting/admin/links`, {
    method: 'POST', headers: { Cookie: ckAdmin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ childUserId: childId }),
  });
  assert.equal(dup.status, 409);
  // list shows it
  const list = await (await fetch(`${base}/api/parenting/admin/links`, { headers: { Cookie: ckAdmin } })).json();
  assert.ok(list.some(l => String(l._id) === String(link._id)));
  // delete
  const del = await fetch(`${base}/api/parenting/admin/links/${link._id}`, { method: 'DELETE', headers: { Cookie: ckAdmin } });
  assert.equal(del.status, 200);
});
