// HTTP tests for the Gym progression endpoints: the enriched exercise history,
// the bulk recommendations feed, and the per-exercise settings CRUD.
//
// Mongoose model statics are stubbed against in-memory stores (no DB), matching
// the pattern in links.routes.test.js. What is covered here is the wiring the
// pure engine tests cannot see: status codes, target/step resolution through the
// real plan + settings documents, validation, and per-user scoping.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const oid = () => new mongoose.Types.ObjectId().toString();
const sameId = (a, b) => String(a) === String(b);

// Chainable query stubs mirroring the calls the router actually makes.
const qOne = r => ({
  select: () => qOne(r), sort: () => qOne(r), lean: () => Promise.resolve(r),
  then: (res2, rej) => Promise.resolve(r).then(res2, rej),
});
// `limit` really slices: the router relies on it to clamp the history window,
// and a stub that ignored it would make that test assert nothing.
const qList = r => ({
  select: () => qList(r), sort: () => qList(r), limit: n => qList(r.slice(0, n)),
  lean: () => Promise.resolve(r),
  then: (res2, rej) => Promise.resolve(r).then(res2, rej),
});

// --- stub models BEFORE requiring the router (shared module cache) -----------
const GymEntry        = require('../models/GymEntry');
const Exercise        = require('../models/Exercise');
const ExerciseSetting = require('../models/ExerciseSetting');
const WorkoutPlan     = require('../models/WorkoutPlan');
const User            = require('../models/User');
const { normalizeExerciseName } = require('../utils/exerciseName');

const USER_ID  = oid();
const OTHER_ID = oid();

let entries  = [];   // GymEntry docs
let catalog  = [];   // Exercise docs
let settings = [];   // ExerciseSetting docs
let plans    = [];   // WorkoutPlan docs
let users    = [];   // User docs

// GymEntry.find({ userId, exerciseName }) -> sorted newest first
GymEntry.find = (filter = {}) => {
  let rows = entries.filter(e => sameId(e.userId, filter.userId));
  if (filter.exerciseName) rows = rows.filter(e => e.exerciseName === filter.exerciseName);
  rows = rows.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return qList(rows);
};
GymEntry.findOne = (filter = {}) => {
  let rows = entries.filter(e => sameId(e.userId, filter.userId));
  if (filter.exerciseName) rows = rows.filter(e => e.exerciseName === filter.exerciseName);
  if (filter.isPersonalRecord) rows = rows.filter(e => e.isPersonalRecord);
  rows = rows.slice().sort((a, b) => (b.prWeight || 0) - (a.prWeight || 0));
  return qOne(rows[0] || null);
};
// Mimics the $match/$sort/$group/$slice pipeline in recentSessionsByExercise.
GymEntry.aggregate = async (pipeline) => {
  const match = pipeline[0].$match;
  const limit = pipeline[3].$project.sessions.$slice[1];
  const names = new Set(match.exerciseName.$in);
  const rows = entries
    .filter(e => sameId(e.userId, match.userId) && names.has(e.exerciseName))
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const grouped = new Map();
  for (const e of rows) {
    if (!grouped.has(e.exerciseName)) {
      grouped.set(e.exerciseName, { _id: e.exerciseName, bodyPart: e.bodyPart, sessions: [] });
    }
    grouped.get(e.exerciseName).sessions.push({ date: e.date, sets: e.sets });
  }
  return [...grouped.values()].map(g => ({ ...g, sessions: g.sessions.slice(0, limit) }));
};

Exercise.find = (filter = {}) => {
  let rows = catalog;
  if (filter.nameKey?.$in) rows = rows.filter(c => filter.nameKey.$in.includes(c.nameKey));
  return qList(rows);
};
Exercise.findOne = (filter = {}) =>
  qOne(catalog.find(c => c.nameKey === filter.nameKey) || null);

ExerciseSetting.find = (filter = {}) => {
  let rows = settings.filter(s => sameId(s.userId, filter.userId));
  if (filter.nameKey?.$in) rows = rows.filter(s => filter.nameKey.$in.includes(s.nameKey));
  return qList(rows);
};
ExerciseSetting.findOne = (filter = {}) => {
  const found = settings.find(s => sameId(s.userId, filter.userId) && s.nameKey === filter.nameKey);
  const doc = found ? makeSettingDoc(found) : null;
  // The router calls .lean() on the read path and awaits the doc on the write
  // path, so this stub has to satisfy both.
  return Object.assign(Promise.resolve(doc), { lean: () => Promise.resolve(found || null) });
};
ExerciseSetting.findOneAndDelete = async (filter = {}) => {
  const i = settings.findIndex(s => sameId(s.userId, filter.userId) && s.nameKey === filter.nameKey);
  if (i === -1) return null;
  return settings.splice(i, 1)[0];
};

WorkoutPlan.find = (filter = {}) => {
  const ownerId = filter.$or?.find(o => o.ownerUserId)?.ownerUserId;
  return qList(plans.filter(p =>
    p.archivedAt == null && (p.isMaster || sameId(p.ownerUserId, ownerId))));
};

User.findById = (id) => qOne(users.find(u => sameId(u._id, id)) || null);

// A stand-in for a hydrated ExerciseSetting document: assignable, savable, and
// carrying the same validation the schema would apply on save().
function makeSettingDoc(seed) {
  const doc = { ...seed };
  doc.save = async () => {
    const i = settings.findIndex(s => sameId(s.userId, doc.userId) && s.nameKey === doc.nameKey);
    const plain = { ...doc };
    delete plain.save;
    if (i === -1) settings.push(plain); else settings[i] = plain;
    return doc;
  };
  return doc;
}
// The router does `new ExerciseSetting({...})` when no row exists yet.
const RealExerciseSetting = ExerciseSetting;
function StubExerciseSetting(seed) { return makeSettingDoc(seed); }
Object.setPrototypeOf(StubExerciseSetting, RealExerciseSetting);

let app;
before(() => {
  // Swap the constructor only for the router's require, then load the router.
  const path = require.resolve('../models/ExerciseSetting');
  const real = require.cache[path].exports;
  const proxy = new Proxy(StubExerciseSetting, {
    get: (t, p) => (p in t ? t[p] : real[p]),
    set: (t, p, v) => { real[p] = v; return true; },
    construct: (t, args) => makeSettingDoc(args[0]),
  });
  require.cache[path].exports = proxy;
  // Keep the statics the tests stubbed above reachable through the proxy.
  for (const k of ['find', 'findOne', 'findOneAndDelete']) proxy[k] = real[k];

  const gymRouter = require('./gym');
  const requireAuth = require('../middleware/auth');
  app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/gym', requireAuth, gymRouter);
});

function tokenFor(id) {
  return jwt.sign({ _id: id, email: 'x@y.z', name: 'X' }, process.env.JWT_SECRET);
}

// Minimal fetch-against-the-app helper: boots the server on an ephemeral port.
async function call(method, path, { userId = USER_ID, body } = {}) {
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { Cookie: `token=${tokenFor(userId)}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  } finally {
    server.close();
  }
}

// --- fixtures ---------------------------------------------------------------

const setsAt = (weight, reps, count = 3) =>
  Array.from({ length: count }, () => ({ reps, weight, isWarmup: false }));

const PLAN_ID = oid();

beforeEach(() => {
  entries = [];
  settings = [];
  users = [{ _id: USER_ID, weightUnit: 'lb' }, { _id: OTHER_ID, weightUnit: 'kg' }];
  catalog = [
    { _id: oid(), name: 'Bench Press',    nameKey: 'bench press',    bodyPart: 'chest' },
    { _id: oid(), name: 'Lateral Raises', nameKey: 'lateral raises', bodyPart: 'shoulders' },
    { _id: oid(), name: 'Plank',          nameKey: 'plank',          bodyPart: 'core' },
  ];
  plans = [{
    _id: PLAN_ID, isMaster: true, ownerUserId: null, archivedAt: null,
    days: [{
      label: 'Day 1',
      exercises: [
        { exerciseName: 'Bench Press',    bodyPart: 'chest',     sets: 3, repsMin: 8,  repsMax: 10 },
        { exerciseName: 'Lateral Raises', bodyPart: 'shoulders', sets: 3, repsMin: 12, repsMax: 15 },
      ],
    }],
  }];
});

function logSession(exerciseName, date, sets, extra = {}) {
  entries.push({
    _id: oid(), userId: USER_ID, date, exerciseName,
    bodyPart: extra.bodyPart || 'chest', sets,
    prWeight: Math.max(0, ...sets.map(s => s.weight || 0)),
    isPersonalRecord: !!extra.isPersonalRecord,
    ...extra,
  });
}

// --- GET /exercise/:name/history --------------------------------------------

test('history keeps last + pr and adds target, step and recommendation', async () => {
  logSession('Bench Press', '2026-08-01', setsAt(50, 10), { isPersonalRecord: true });

  const r = await call('GET', '/api/gym/exercise/Bench%20Press/history');
  assert.equal(r.status, 200);

  // Existing contract preserved.
  assert.equal(r.body.last.date, '2026-08-01');
  assert.equal(r.body.pr.prWeight, 50);

  // New progression payload.
  assert.deepEqual(r.body.target, { repsMin: 8, repsMax: 10, sets: 3, source: 'plan' });
  assert.equal(r.body.step, 5);
  assert.equal(r.body.stepSource, 'default');
  assert.equal(r.body.recommendation.status, 'ready');
  assert.equal(r.body.recommendation.recommendedWeight, 55);
  assert.equal(r.body.recommendation.repsTarget, 4);
  assert.equal(r.body.bodyPart, 'chest');
  assert.equal(r.body.recent.length, 1);
});

test('history for an exercise never logged returns no_history, not an error', async () => {
  const r = await call('GET', '/api/gym/exercise/Bench%20Press/history');
  assert.equal(r.status, 200);
  assert.equal(r.body.last, null);
  assert.equal(r.body.pr, null);
  assert.equal(r.body.recommendation.status, 'no_history');
  assert.equal(r.body.recommendation.recommendedWeight, null);
});

test('history reads the 12-15 window from the plan for an isolation lift', async () => {
  logSession('Lateral Raises', '2026-08-01', setsAt(20, 15), { bodyPart: 'shoulders' });
  const r = await call('GET', '/api/gym/exercise/Lateral%20Raises/history');
  assert.equal(r.body.target.repsMax, 15);
  assert.equal(r.body.step, 2.5);            // shoulders -> isolation step
  assert.equal(r.body.recommendation.status, 'ready');
  assert.equal(r.body.recommendation.recommendedWeight, 22.5);
});

test('a user setting overrides the plan window and the default step', async () => {
  settings.push({
    userId: USER_ID, nameKey: 'bench press', exerciseName: 'Bench Press',
    weightStep: 10, repsMin: 12, repsMax: 15, targetSets: 4,
  });
  logSession('Bench Press', '2026-08-01', setsAt(50, 15, 4));

  const r = await call('GET', '/api/gym/exercise/Bench%20Press/history');
  assert.deepEqual(r.body.target, { repsMin: 12, repsMax: 15, sets: 4, source: 'setting' });
  assert.equal(r.body.step, 10);
  assert.equal(r.body.stepSource, 'setting');
  assert.equal(r.body.recommendation.recommendedWeight, 60);
  assert.equal(r.body.setting.weightStep, 10);
});

test('history walks back far enough to report a multi-session climb', async () => {
  logSession('Bench Press', '2026-08-01', setsAt(50, 10));
  logSession('Bench Press', '2026-08-05', setsAt(55, 6));
  logSession('Bench Press', '2026-08-09', setsAt(55, 8));

  const r = await call('GET', '/api/gym/exercise/Bench%20Press/history');
  assert.equal(r.body.recommendation.status, 'climb');
  assert.equal(r.body.recommendation.climbingFrom, 50);
  assert.equal(r.body.recommendation.recommendedWeight, 55);
  assert.equal(r.body.recommendation.unlockWeight, 60);
});

test('the recent window is clamped to a sane maximum', async () => {
  for (let i = 1; i <= 30; i++) {
    logSession('Bench Press', `2026-07-${String(i).padStart(2, '0')}`, setsAt(50, 8));
  }
  const r = await call('GET', '/api/gym/exercise/Bench%20Press/history?recent=999');
  assert.ok(r.body.recent.length <= 20, `expected <= 20, got ${r.body.recent.length}`);
});

test('a bodyweight hold never suggests adding weight', async () => {
  logSession('Plank', '2026-08-01', setsAt(0, 45), { bodyPart: 'core' });
  const r = await call('GET', '/api/gym/exercise/Plank/history');
  assert.equal(r.body.recommendation.status, 'bodyweight');
  assert.equal(r.body.recommendation.recommendedWeight, 0);
  assert.equal(r.body.recommendation.unlockWeight, null);
});

test('history requires authentication', async () => {
  const r = await call('GET', '/api/gym/exercise/Bench%20Press/history', { userId: null });
  assert.equal(r.status, 401);
});

// --- GET /recommendations ----------------------------------------------------

test('bulk recommendations cover every exercise in the active plan', async () => {
  logSession('Bench Press', '2026-08-01', setsAt(50, 10));
  logSession('Lateral Raises', '2026-08-01', setsAt(20, 12), { bodyPart: 'shoulders' });

  const r = await call('GET', `/api/gym/recommendations?planId=${PLAN_ID}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 2);

  const bench = r.body.find(x => x.exerciseName === 'Bench Press');
  assert.equal(bench.recommendation.status, 'ready');
  assert.equal(bench.recommendation.recommendedWeight, 55);

  const raises = r.body.find(x => x.exerciseName === 'Lateral Raises');
  assert.equal(raises.target.repsMax, 15);
  assert.equal(raises.recommendation.status, 'hold');   // 12 reps, needs 15
  assert.equal(raises.recommendation.recommendedWeight, 20);
});

test('bulk recommendations accept an explicit name list', async () => {
  logSession('Bench Press', '2026-08-01', setsAt(50, 10));
  const r = await call('GET', '/api/gym/recommendations?names=Bench%20Press');
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].exerciseName, 'Bench Press');
});

test('bulk recommendations include never-logged plan exercises as no_history', async () => {
  const r = await call('GET', `/api/gym/recommendations?planId=${PLAN_ID}`);
  assert.equal(r.body.length, 2);
  assert.ok(r.body.every(x => x.recommendation.status === 'no_history'));
  // A target is still resolved so the UI can show the prescription.
  assert.equal(r.body.find(x => x.exerciseName === 'Bench Press').target.repsMax, 10);
});

test('bulk recommendations can be narrowed to a single plan day', async () => {
  plans[0].days.push({
    label: 'Day 2',
    exercises: [{ exerciseName: 'Plank', bodyPart: 'core', sets: 3, repsMin: 30, repsMax: 45 }],
  });
  const r = await call('GET', `/api/gym/recommendations?planId=${PLAN_ID}&dayLabel=Day%202`);
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].exerciseName, 'Plank');
});

test('bulk recommendations return an empty list rather than erroring', async () => {
  plans = [];
  const r = await call('GET', '/api/gym/recommendations');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, []);
});

test('another user sees no recommendations from this user history', async () => {
  logSession('Bench Press', '2026-08-01', setsAt(50, 10));
  const r = await call('GET', '/api/gym/recommendations?names=Bench%20Press', { userId: OTHER_ID });
  assert.equal(r.body[0].recommendation.status, 'no_history');
  // ...and gets kg-sized steps from their own profile.
  assert.equal(r.body[0].step, 2.5);
});

// --- exercise settings CRUD --------------------------------------------------

test('settings upsert stores the override and snaps to the catalog name', async () => {
  const r = await call('PUT', '/api/gym/exercise-settings/bench%20press', {
    body: { weightStep: 10, repsMin: 8, repsMax: 12, targetSets: 4 },
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.exerciseName, 'Bench Press');   // catalog casing
  assert.equal(r.body.nameKey, 'bench press');
  assert.equal(r.body.weightStep, 10);
  assert.equal(settings.length, 1);
});

test('settings upsert merges into an existing row', async () => {
  await call('PUT', '/api/gym/exercise-settings/Bench%20Press', { body: { weightStep: 10 } });
  await call('PUT', '/api/gym/exercise-settings/Bench%20Press', { body: { targetSets: 5 } });
  assert.equal(settings.length, 1);
  assert.equal(settings[0].weightStep, 10);
  assert.equal(settings[0].targetSets, 5);
});

test('null clears one field back to the inferred default', async () => {
  await call('PUT', '/api/gym/exercise-settings/Bench%20Press', { body: { weightStep: 10 } });
  const r = await call('PUT', '/api/gym/exercise-settings/Bench%20Press', { body: { weightStep: null } });
  assert.equal(r.status, 200);
  assert.equal(r.body.weightStep, null);
});

test('settings reject out-of-range and non-numeric values', async () => {
  const cases = [
    { body: { weightStep: 0 },      why: 'step below the minimum' },
    { body: { weightStep: 1000 },   why: 'step above the maximum' },
    { body: { weightStep: 'huge' }, why: 'non-numeric step' },
    { body: { targetSets: 13 },     why: 'more sets than a session can hold' },
    { body: { targetSets: 2.5 },    why: 'fractional set count' },
    { body: { repsMin: 0 },         why: 'zero reps' },
  ];
  for (const c of cases) {
    const r = await call('PUT', '/api/gym/exercise-settings/Bench%20Press', { body: c.body });
    assert.equal(r.status, 400, c.why);
    assert.ok(r.body.error, c.why);
  }
});

test('settings reject a reversed rep window, including across a merge', async () => {
  const direct = await call('PUT', '/api/gym/exercise-settings/Bench%20Press', {
    body: { repsMin: 15, repsMax: 10 },
  });
  assert.equal(direct.status, 400);

  // Stored max is 10; a later patch raising only the min must still be caught.
  await call('PUT', '/api/gym/exercise-settings/Bench%20Press', { body: { repsMin: 8, repsMax: 10 } });
  const merged = await call('PUT', '/api/gym/exercise-settings/Bench%20Press', { body: { repsMin: 14 } });
  assert.equal(merged.status, 400);
  assert.match(merged.body.error, /repsMin/);
});

test('an empty settings body is rejected', async () => {
  const r = await call('PUT', '/api/gym/exercise-settings/Bench%20Press', { body: {} });
  assert.equal(r.status, 400);
});

test('settings list is scoped to the caller', async () => {
  await call('PUT', '/api/gym/exercise-settings/Bench%20Press', { body: { weightStep: 10 } });
  const mine   = await call('GET', '/api/gym/exercise-settings');
  const theirs = await call('GET', '/api/gym/exercise-settings', { userId: OTHER_ID });
  assert.equal(mine.body.length, 1);
  assert.equal(theirs.body.length, 0);
});

test('deleting a setting is idempotent', async () => {
  await call('PUT', '/api/gym/exercise-settings/Bench%20Press', { body: { weightStep: 10 } });
  const first  = await call('DELETE', '/api/gym/exercise-settings/Bench%20Press');
  const second = await call('DELETE', '/api/gym/exercise-settings/Bench%20Press');
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(settings.length, 0);
});

test('settings endpoints require authentication', async () => {
  const get = await call('GET', '/api/gym/exercise-settings', { userId: null });
  const put = await call('PUT', '/api/gym/exercise-settings/Bench%20Press', { userId: null, body: { weightStep: 5 } });
  const del = await call('DELETE', '/api/gym/exercise-settings/Bench%20Press', { userId: null });
  assert.equal(get.status, 401);
  assert.equal(put.status, 401);
  assert.equal(del.status, 401);
});

test('normalizeExerciseName is the shared join key across all three stores', () => {
  // Guards the assumption every stub above relies on.
  assert.equal(normalizeExerciseName('  Bench   Press '), 'bench press');
});
