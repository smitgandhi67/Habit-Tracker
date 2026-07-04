// HTTP-layer tests for the programs router: auth matrix (kid / admin / stranger),
// enrollment side-effects (tagged habit), duplicate 409, week bounds, measure
// upsert + kid metric whitelist, status transitions archiving the habit.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.ADMIN_EMAIL = 'admin.e2e@example.com';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const q = result => {
  const o = { select: () => o, sort: () => o, limit: () => o, lean: () => Promise.resolve(result) };
  return o;
};
const oid = () => new mongoose.Types.ObjectId().toString();

const TrainingProgram = require('../models/TrainingProgram');
const WeeklyMeasure = require('../models/WeeklyMeasure');
const Habit = require('../models/Habit');
const ParentingLink = require('../models/ParentingLink');

// --- in-memory stores ---------------------------------------------------------
const programStore = new Map();
const habitStore = new Map();
const measureStore = new Map(); // key `${programId}:${week}`

function progDoc(fields) {
  const doc = {
    _id: oid(), status: 'active', currentWeek: 1, startedAt: new Date(), completedAt: null,
    createdAt: new Date(), ...fields,
    save: async function () { programStore.set(String(this._id), this); return this; },
  };
  return doc;
}

TrainingProgram.create = async fields => {
  const doc = progDoc(fields);
  programStore.set(String(doc._id), doc);
  return doc;
};
TrainingProgram.findById = id => {
  const doc = programStore.get(String(id)) || null;
  const p = Promise.resolve(doc);
  p.lean = () => Promise.resolve(doc);
  return p;
};
TrainingProgram.findOne = filter => q(
  [...programStore.values()].find(p =>
    String(p.userId) === String(filter.userId) && p.packKey === filter.packKey &&
    (filter.status?.$in ? filter.status.$in.includes(p.status) : true)) || null
);
TrainingProgram.find = filter => q([...programStore.values()].filter(p => String(p.userId) === String(filter.userId)));

Habit.create = async fields => {
  const doc = { _id: oid(), archivedAt: null, ...fields };
  habitStore.set(String(doc._id), doc);
  return doc;
};
Habit.find = () => q([...habitStore.values()]);
Habit.findById = id => q(habitStore.get(String(id)) || null);
Habit.updateOne = async (filter, update) => {
  const h = habitStore.get(String(filter._id));
  if (h) Object.assign(h, update);
  return { matchedCount: h ? 1 : 0 };
};

WeeklyMeasure.findOne = async filter => measureStore.get(`${filter.programId}:${filter.week}`) || null;
WeeklyMeasure.findOneAndUpdate = (filter, update) => {
  const key = `${filter.programId}:${filter.week}`;
  const existing = measureStore.get(key) || { programId: filter.programId, week: filter.week, metrics: {}, note: '' };
  const saved = { ...existing, ...update.$set };
  measureStore.set(key, saved);
  return q(saved);
};
WeeklyMeasure.find = filter => q(
  [...measureStore.values()].filter(m => String(m.programId) === String(filter.programId)).sort((a, b) => a.week - b.week)
);

ParentingLink.findOne = async () => null; // no linked parents in these tests

const requireAuth = require('../middleware/auth');
const router = require('./capabilityPrograms');

let server, base;
before(async () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/capabilities/programs', requireAuth, router);
  app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(r => server.close(r)));
beforeEach(() => { programStore.clear(); habitStore.clear(); measureStore.clear(); });

const cookie = (id, email) => `token=${jwt.sign({ _id: id, email, name: email }, process.env.JWT_SECRET)}`;
const kidId = oid();
const strangerId = oid();
const ckKid = cookie(kidId, 'kid.e2e@example.com');
const ckStranger = cookie(strangerId, 'stranger.e2e@example.com');
const ckAdmin = cookie(oid(), 'admin.e2e@example.com');
const send = (method, ck, body) => ({ method, headers: { Cookie: ck, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('GET /packs requires auth; lists both packs for any user', async () => {
  assert.equal((await fetch(`${base}/api/capabilities/programs/packs`)).status, 401);
  const res = await fetch(`${base}/api/capabilities/programs/packs`, { headers: { Cookie: ckKid } });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual(body.packs.map(p => p.key).sort(), ['communication_precision', 'learning_to_learn']);
  // day-level content is not in the summary
  assert.equal(body.packs[0].weekThemes.length, 12);
  assert.equal(body.packs[0].weeks, undefined);
});

test('POST /: kid cannot enroll (403); admin enrolls and habit is tagged + pointed', async () => {
  assert.equal((await fetch(`${base}/api/capabilities/programs`,
    send('POST', ckKid, { childId: kidId, packKey: 'learning_to_learn' }))).status, 403);

  const res = await fetch(`${base}/api/capabilities/programs`,
    send('POST', ckAdmin, { childId: kidId, packKey: 'learning_to_learn', points: 150 }));
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.currentWeek, 1);
  assert.equal(body.week.days.length, 5);
  const habit = habitStore.get(String(body.habitId));
  assert.equal(habit.points, 150);
  assert.deepEqual(habit.domainKeys, ['metacognition', 'cognitive']);
  assert.equal(habit.frequency, 'daily');
});

test('POST /: unknown pack 400; duplicate active enrollment 409', async () => {
  assert.equal((await fetch(`${base}/api/capabilities/programs`,
    send('POST', ckAdmin, { childId: kidId, packKey: 'nope' }))).status, 400);
  await fetch(`${base}/api/capabilities/programs`, send('POST', ckAdmin, { childId: kidId, packKey: 'learning_to_learn' }));
  assert.equal((await fetch(`${base}/api/capabilities/programs`,
    send('POST', ckAdmin, { childId: kidId, packKey: 'learning_to_learn' }))).status, 409);
});

test('GET /: kid sees own programs; stranger blocked from kid via 403', async () => {
  await fetch(`${base}/api/capabilities/programs`, send('POST', ckAdmin, { childId: kidId, packKey: 'learning_to_learn' }));
  const mine = await (await fetch(`${base}/api/capabilities/programs`, { headers: { Cookie: ckKid } })).json();
  assert.equal(mine.programs.length, 1);
  assert.equal(mine.programs[0].packKey, 'learning_to_learn');
  assert.equal((await fetch(`${base}/api/capabilities/programs?childId=${kidId}`, { headers: { Cookie: ckStranger } })).status, 403);
});

test('PATCH /:id: admin-only; week bounds; done/pause archive habit, resume restores', async () => {
  const created = await (await fetch(`${base}/api/capabilities/programs`,
    send('POST', ckAdmin, { childId: kidId, packKey: 'learning_to_learn' }))).json();

  assert.equal((await fetch(`${base}/api/capabilities/programs/${created._id}`,
    send('PATCH', ckKid, { currentWeek: 2 }))).status, 403);
  assert.equal((await fetch(`${base}/api/capabilities/programs/${created._id}`,
    send('PATCH', ckAdmin, { currentWeek: 13 }))).status, 400);
  assert.equal((await fetch(`${base}/api/capabilities/programs/${created._id}`,
    send('PATCH', ckAdmin, { currentWeek: 0 }))).status, 400);

  const bumped = await (await fetch(`${base}/api/capabilities/programs/${created._id}`,
    send('PATCH', ckAdmin, { currentWeek: 2 }))).json();
  assert.equal(bumped.currentWeek, 2);

  await fetch(`${base}/api/capabilities/programs/${created._id}`, send('PATCH', ckAdmin, { status: 'paused' }));
  assert.ok(habitStore.get(String(created.habitId)).archivedAt);
  await fetch(`${base}/api/capabilities/programs/${created._id}`, send('PATCH', ckAdmin, { status: 'active' }));
  assert.equal(habitStore.get(String(created.habitId)).archivedAt, null);

  const done = await (await fetch(`${base}/api/capabilities/programs/${created._id}`,
    send('PATCH', ckAdmin, { status: 'done' }))).json();
  assert.ok(done.completedAt);
  assert.ok(habitStore.get(String(created.habitId)).archivedAt);
});

test('measures: kid limited to scoreMetric keys + no note; parent free; clamped; upsert merges', async () => {
  const created = await (await fetch(`${base}/api/capabilities/programs`,
    send('POST', ckAdmin, { childId: kidId, packKey: 'learning_to_learn' }))).json();
  const url = w => `${base}/api/capabilities/programs/${created._id}/measures/${w}`;

  // kid: ml_level is a dose scoreMetric → allowed (and clamped to max 10)
  const kidRes = await fetch(url(1), send('PUT', ckKid, { metrics: { ml_level: 22 } }));
  const kidBody = await kidRes.json();
  assert.equal(kidRes.status, 200);
  assert.equal(kidBody.measure.metrics.ml_level, 10);

  // kid: wrapper_days is parent-entered only → 400; note from kid → 400
  assert.equal((await fetch(url(1), send('PUT', ckKid, { metrics: { wrapper_days: 3 } }))).status, 400);
  assert.equal((await fetch(url(1), send('PUT', ckKid, { metrics: {}, note: 'hi' }))).status, 400);

  // stranger: 403
  assert.equal((await fetch(url(1), send('PUT', ckStranger, { metrics: { ml_level: 2 } }))).status, 403);

  // future week: 400 (currentWeek is 1)
  assert.equal((await fetch(url(2), send('PUT', ckAdmin, { metrics: { ml_level: 2 } }))).status, 400);

  // parent upsert merges with kid's earlier value
  const parentRes = await fetch(url(1), send('PUT', ckAdmin, { metrics: { wrapper_days: 4 }, note: 'good week' }));
  const parentBody = await parentRes.json();
  assert.equal(parentBody.measure.metrics.ml_level, 10);
  assert.equal(parentBody.measure.metrics.wrapper_days, 4);
  assert.equal(parentBody.measure.note, 'good week');

  // non-numeric → 400; unknown key → 400
  assert.equal((await fetch(url(1), send('PUT', ckAdmin, { metrics: { ml_level: 'x' } }))).status, 400);
  assert.equal((await fetch(url(1), send('PUT', ckAdmin, { metrics: { nope: 1 } }))).status, 400);

  // GET measures ascending
  const list = await (await fetch(`${base}/api/capabilities/programs/${created._id}/measures`, { headers: { Cookie: ckKid } })).json();
  assert.equal(list.measures.length, 1);
  assert.equal(list.measures[0].week, 1);
});
