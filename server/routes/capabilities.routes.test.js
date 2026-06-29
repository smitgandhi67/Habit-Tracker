// HTTP-layer integration tests for the capabilities ("Skills") router. Mongoose model
// methods are stubbed (no DB connection) — we cover status codes, authorization
// (authorizeChild: self / admin / linked-parent), input validation, and the
// parentView gating that strips parent-only data from a kid's own view. Aggregation
// math is covered separately by rollup.test.js / dashboard.test.js.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ADMIN_EMAIL = 'admin.e2e@example.com';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// chainable query stub: supports .select().sort().limit().lean()
const q = result => {
  const o = { select: () => o, sort: () => o, limit: () => o, lean: () => Promise.resolve(result) };
  return o;
};
const oid = () => new mongoose.Types.ObjectId().toString();

// --- stub every model the router + rollup + dashboard touch ------------------
const CapabilityActivity = require('../models/CapabilityActivity');
const CapabilityActivityLog = require('../models/CapabilityActivityLog');
const CapabilityAttempt = require('../models/CapabilityAttempt');
const ParentingLink = require('../models/ParentingLink');
const User = require('../models/User');
const MathDailyStat = require('../models/MathDailyStat');
const ProblemEntry = require('../models/ProblemEntry');
const BuildProject = require('../models/BuildProject');
const GymEntry = require('../models/GymEntry');
const Habit = require('../models/Habit');
const HabitLog = require('../models/HabitLog');
const Achievement = require('../models/Achievement');
const Milestone = require('../models/Milestone');

// Catalog: one 'do' activity, one 'skip', everything else unknown.
CapabilityActivity.find = () => q([]);
CapabilityActivity.findOne = filter => {
  const slug = filter && filter.slug;
  if (slug === 'sleep-protection') return q({ slug, title: 'Protect sleep', domainKeys: ['physical', 'executive_function'], kind: 'do', archivedAt: null });
  if (slug === 'brain-training-apps') return q({ slug, title: 'Brain-training apps', domainKeys: ['cognitive'], kind: 'skip', archivedAt: null });
  return q(null);
};

const logStore = new Map();
CapabilityActivityLog.create = async doc => {
  const _id = oid();
  const saved = { ...doc, _id, createdAt: new Date(), deleteOne: async () => { logStore.delete(_id); } };
  logStore.set(_id, saved);
  return saved;
};
CapabilityActivityLog.findById = async id => logStore.get(String(id)) || null;
CapabilityActivityLog.find = () => q([]);
CapabilityActivityLog.countDocuments = async () => 0;

CapabilityAttempt.findOne = () => q(null);
MathDailyStat.find = () => q([]);
ProblemEntry.countDocuments = async () => 0;
BuildProject.countDocuments = async () => 0;
BuildProject.find = () => q([]);
GymEntry.countDocuments = async () => 0;
Habit.find = () => q([]);
HabitLog.countDocuments = async () => 0;
Achievement.countDocuments = async () => 0;
Milestone.find = () => q([]);
User.findById = () => q({ _id: oid(), name: 'Kid', email: 'kid@example.com' });

// Linked-parent graph for authorizeChild + /children.
const linkStore = new Map();
ParentingLink.findOne = async filter => {
  for (const l of linkStore.values()) {
    if (String(l.parentUserId) === String(filter.parentUserId) && String(l.childUserId) === String(filter.childUserId)) return l;
  }
  return null;
};
ParentingLink.find = filter => q([...linkStore.values()].filter(l => String(l.parentUserId) === String(filter.parentUserId)));
User.find = () => q([]);

const requireAuth = require('../middleware/auth');
const router = require('./capabilities');

let server, base;
before(async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/capabilities', requireAuth, router);
  app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(r => server.close(r)));

const cookie = (id, email) => `token=${jwt.sign({ _id: id, email, name: email }, process.env.JWT_SECRET)}`;
const kidA = oid();
const kidB = oid();
const ckA = cookie(kidA, 'a.e2e@example.com');
const ckB = cookie(kidB, 'b.e2e@example.com');
const adminId = oid();
const ckAdmin = cookie(adminId, 'admin.e2e@example.com');
const json = (ck, body) => ({ method: 'POST', headers: { Cookie: ck, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('registries require auth (401 without cookie)', async () => {
  assert.equal((await fetch(`${base}/api/capabilities/domains`)).status, 401);
});

test('GET /domains returns the 10 domains + foundational set', async () => {
  const res = await fetch(`${base}/api/capabilities/domains`, { headers: { Cookie: ckA } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.domains.length, 10);
  assert.ok(body.foundational.includes('executive_function'));
});

test('POST /activities/log: missing slug -> 400', async () => {
  const res = await fetch(`${base}/api/capabilities/activities/log`, json(ckA, {}));
  assert.equal(res.status, 400);
});

test('POST /activities/log: unknown activity -> 404', async () => {
  const res = await fetch(`${base}/api/capabilities/activities/log`, json(ckA, { activitySlug: 'nope' }));
  assert.equal(res.status, 404);
});

test('POST /activities/log: skip-list activity cannot be logged -> 400', async () => {
  const res = await fetch(`${base}/api/capabilities/activities/log`, json(ckA, { activitySlug: 'brain-training-apps' }));
  assert.equal(res.status, 400);
});

test('POST /activities/log: self log snapshots domains -> 201', async () => {
  const res = await fetch(`${base}/api/capabilities/activities/log`, json(ckA, { activitySlug: 'sleep-protection', date: '2026-06-20', note: 'x' }));
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.deepEqual(body.domainKeys, ['physical', 'executive_function']);
  assert.equal(String(body.subjectUserId), kidA);
  assert.equal(body.date, '2026-06-20');
});

test('POST /activities/log: bad date falls back to today (valid YMD)', async () => {
  const res = await fetch(`${base}/api/capabilities/activities/log`, json(ckA, { activitySlug: 'sleep-protection', date: 'garbage' }));
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.match(body.date, /^\d{4}-\d{2}-\d{2}$/);
});

test('POST /activities/log: logging for an unlinked child -> 403', async () => {
  const res = await fetch(`${base}/api/capabilities/activities/log`, json(ckA, { activitySlug: 'sleep-protection', subjectUserId: kidB }));
  assert.equal(res.status, 403);
});

test('POST /activities/log: admin may log for any child -> 201', async () => {
  const res = await fetch(`${base}/api/capabilities/activities/log`, json(ckAdmin, { activitySlug: 'sleep-protection', subjectUserId: kidB }));
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(String(body.subjectUserId), kidB);
});

test('DELETE /activities/log/:id: bad id 404, owner 200, non-owner 403', async () => {
  assert.equal((await fetch(`${base}/api/capabilities/activities/log/not-an-id`, { method: 'DELETE', headers: { Cookie: ckA } })).status, 404);
  const created = await (await fetch(`${base}/api/capabilities/activities/log`, json(ckA, { activitySlug: 'sleep-protection' }))).json();
  const other = await fetch(`${base}/api/capabilities/activities/log/${created._id}`, { method: 'DELETE', headers: { Cookie: ckB } });
  assert.equal(other.status, 403);
  const owner = await fetch(`${base}/api/capabilities/activities/log/${created._id}`, { method: 'DELETE', headers: { Cookie: ckA } });
  assert.equal(owner.status, 200);
});

test('GET /rollup: self 200 with all 10 domains', async () => {
  const res = await fetch(`${base}/api/capabilities/rollup`, { headers: { Cookie: ckA } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.domains.length, 10);
  assert.equal(body.totalReps, 0);
  assert.equal(body.baseline.needsReassessment, true); // no baseline stubbed
});

test('GET /rollup: unlinked child -> 403, admin -> 200', async () => {
  assert.equal((await fetch(`${base}/api/capabilities/rollup?childUserId=${kidB}`, { headers: { Cookie: ckA } })).status, 403);
  assert.equal((await fetch(`${base}/api/capabilities/rollup?childUserId=${kidB}`, { headers: { Cookie: ckAdmin } })).status, 200);
});

test('GET /rollup: invalid childUserId -> 400', async () => {
  const res = await fetch(`${base}/api/capabilities/rollup?childUserId=xyz`, { headers: { Cookie: ckAdmin } });
  assert.equal(res.status, 400);
});

test('GET /dashboard: admin gets parentView with targets/milestones keys', async () => {
  const res = await fetch(`${base}/api/capabilities/dashboard?childUserId=${kidB}`, { headers: { Cookie: ckAdmin } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.parentView, true);
  assert.ok('targets' in body.baseline);            // parent-only key present
  assert.notEqual(body.tracks.journey.milestones, null);
});

test('GET /dashboard: kid self-view strips parent-only data', async () => {
  const res = await fetch(`${base}/api/capabilities/dashboard`, { headers: { Cookie: ckA } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.parentView, false);
  assert.equal(body.baseline.targets, undefined);   // no focus areas for the kid
  assert.equal(body.baseline.parent.hasData, false); // parent ratings hidden
  assert.equal(body.tracks.journey.milestones, null);
});

test('GET /children requires admin (kid -> 403)', async () => {
  assert.equal((await fetch(`${base}/api/capabilities/children`, { headers: { Cookie: ckA } })).status, 403);
  assert.equal((await fetch(`${base}/api/capabilities/children`, { headers: { Cookie: ckAdmin } })).status, 200);
});
