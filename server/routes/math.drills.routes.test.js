// HTTP tests for the timed-drill endpoints on the math router (zigzag addition,
// zigzag subtraction, step multiplication). Model statics are stubbed with in-memory
// maps (no DB), so we cover server-side re-grading, operand validation, the per-drill
// tier-1 → tier-2 rollover, and the fact that each drill counts against its own daily
// budget rather than a shared one.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

// --- stub model statics BEFORE requiring the router (shared module cache) ---
const MathDailyStat = require('../models/MathDailyStat');
const MathReward = require('../models/MathReward');
const MathRewardConfig = require('../models/MathRewardConfig');

const stats = new Map();   // `${uid}|${date}` -> daily stat
const rewards = new Map(); // `${uid}` -> reward doc
const key = (u, d) => `${u}|${d}`;
const clone = (o) => JSON.parse(JSON.stringify(o));

MathDailyStat.findOne = (f) => {
  const chain = {
    select: () => chain,
    lean: async () => { const d = stats.get(key(f.userId, f.date)); return d ? clone(d) : null; },
  };
  return chain;
};
MathDailyStat.findOneAndUpdate = async (f, upd) => {
  const k = key(f.userId, f.date);
  const d = stats.get(k) || { userId: f.userId, date: f.date, attempted: 0, correct: 0, points: 0, zigzag: 0, zigzagsub: 0, stepmul: 0 };
  for (const [kk, v] of Object.entries(upd.$inc || {})) d[kk] = (d[kk] || 0) + v;
  stats.set(k, d);
  return d;
};

MathReward.findOne = async (f) => rewards.get(String(f.userId)) || null;
MathReward.create = async (doc) => { const d = { pointsEarned: 0, pointsSpent: 0, ...doc }; rewards.set(String(doc.userId), d); return d; };
MathReward.findOneAndUpdate = async (f, upd) => {
  const d = rewards.get(String(f.userId)) || { userId: f.userId, pointsEarned: 0, pointsSpent: 0 };
  for (const [k, v] of Object.entries(upd.$inc || {})) d[k] = (d[k] || 0) + v;
  rewards.set(String(f.userId), d);
  return d;
};
MathRewardConfig.findOne = () => ({ lean: async () => null });

const mathRouter = require('./math');

const UID = 'u1';
const DATE = '2026-08-02';

function app() {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => { req.user = { _id: UID, email: 'kid@example.com' }; next(); });
  a.use('/api/math', mathRouter);
  return a;
}

const req = (method, path, body) => {
  const { createServer } = require('node:http');
  return new Promise((resolve, reject) => {
    const server = createServer(app()).listen(0, async () => {
      try {
        const port = server.address().port;
        const res = await fetch(`http://127.0.0.1:${port}${path}`, {
          method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        server.close(); resolve({ status: res.status, json });
      } catch (e) { server.close(); reject(e); }
    });
  });
};

const postSub = (body) => req('POST', '/api/math/zigzagsub/answer', body);
const today = () => stats.get(key(UID, DATE));

beforeEach(() => { stats.clear(); rewards.clear(); });

// ---- zigzag subtraction ----------------------------------------------------

test('subtraction: a correct three-operand chain earns the tier-1 rate', async () => {
  const r = await postSub({ a: 842, b: 317, c: 156, answer: 369, date: DATE });
  assert.equal(r.status, 200);
  assert.equal(r.json.correct, true);
  assert.equal(r.json.awarded, 15);
  assert.equal(r.json.reward.balance, 15);
  assert.equal(today().zigzagsub, 1);
  assert.equal(today().correct, 1);
});

test('subtraction: the server re-grades and pays nothing for a wrong answer', async () => {
  const r = await postSub({ a: 842, b: 317, c: 156, answer: 370, date: DATE });
  assert.equal(r.json.correct, false);
  assert.equal(r.json.awarded, 0);
  assert.equal(r.json.reward.balance, 0);
  assert.equal(today().attempted, 1);
  assert.equal(today().zigzagsub, 0);   // only corrects advance the tier
});

test('subtraction: a timeout (answer -1) logs the attempt and never grades correct', async () => {
  const r = await postSub({ a: 73, b: 21, c: 18, answer: -1, date: DATE });
  assert.equal(r.json.correct, false);
  assert.equal(r.json.awarded, 0);
  assert.equal(today().attempted, 1);
  assert.equal(today().correct, 0);
});

test('subtraction: the 2-digit (grade 2-3) form is accepted', async () => {
  const r = await postSub({ a: 73, b: 21, c: 18, answer: 34, date: DATE });
  assert.equal(r.json.correct, true);
  assert.equal(r.json.awarded, 15);
});

test('subtraction: a chain that goes negative is rejected outright', async () => {
  const r = await postSub({ a: 120, b: 300, c: 400, answer: -580, date: DATE });
  assert.equal(r.status, 400);
  assert.equal(stats.size, 0);           // nothing logged, nothing paid
});

test('subtraction: a zero result is rejected (no free points off a trivial chain)', async () => {
  const r = await postSub({ a: 300, b: 200, c: 100, answer: 0, date: DATE });
  assert.equal(r.status, 400);
  assert.equal(stats.size, 0);
});

test('subtraction: out-of-range operands and bad dates are rejected', async () => {
  assert.equal((await postSub({ a: 9, b: 3, c: 2, answer: 4, date: DATE })).status, 400);        // 1-digit
  assert.equal((await postSub({ a: 1842, b: 317, c: 156, answer: 1369, date: DATE })).status, 400); // 4-digit
  assert.equal((await postSub({ a: 842, b: 317, c: 156, answer: 369, date: '08-02-2026' })).status, 400);
  assert.equal((await postSub({ a: 842, b: 317, c: 156, date: DATE })).status, 400);             // no answer
  assert.equal(stats.size, 0);
});

test('subtraction: rate drops to tier 2 after 20 correct answers in a day', async () => {
  stats.set(key(UID, DATE), { userId: UID, date: DATE, attempted: 20, correct: 20, points: 300, zigzag: 0, zigzagsub: 20, stepmul: 0 });
  const r = await postSub({ a: 842, b: 317, c: 156, answer: 369, date: DATE });
  assert.equal(r.json.correct, true);
  assert.equal(r.json.awarded, 1);       // DRILL_TIER2_POINTS
  assert.equal(today().zigzagsub, 21);
});

// ---- per-drill budgets -----------------------------------------------------

test('a maxed-out addition tier does not push subtraction into tier 2', async () => {
  stats.set(key(UID, DATE), { userId: UID, date: DATE, attempted: 20, correct: 20, points: 300, zigzag: 20, zigzagsub: 0, stepmul: 0 });
  const r = await postSub({ a: 842, b: 317, c: 156, answer: 369, date: DATE });
  assert.equal(r.json.awarded, 15);      // own counter, own budget
});

test('addition still grades a + b + c and uses the zigzag counter', async () => {
  const r = await req('POST', '/api/math/zigzag/answer', { a: 122, b: 212, c: 334, answer: 668, date: DATE });
  assert.equal(r.json.correct, true);
  assert.equal(r.json.awarded, 15);
  assert.equal(today().zigzag, 1);
  assert.equal(today().zigzagsub, 0);
});

test('step multiplication is unaffected and keeps its own 10-point tier', async () => {
  const r = await req('POST', '/api/math/stepmul/answer', { a: 42, b: 7, answer: 294, date: DATE });
  assert.equal(r.json.correct, true);
  assert.equal(r.json.awarded, 10);
  assert.equal(today().stepmul, 1);
});
