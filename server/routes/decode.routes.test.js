// HTTP tests for the Word Decoder router. Model statics are stubbed with in-memory maps
// (no DB) and Datamuse is mocked, so we cover the /state due-queue + cap, server-side
// grading of each interaction, two-axis promotion, and — the crux — ready-roots-only
// graduation on a novel decode (the target root AND any other already-ready root in the
// word graduate together).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

// --- stub model statics BEFORE requiring the router (shared module cache) ---
const RootMastery = require('../models/RootMastery');
const DecodeDailyStat = require('../models/DecodeDailyStat');
const MathReward = require('../models/MathReward');

const rm = new Map();      // `${uid}|${rootId}` -> mastery doc
const dds = new Map();     // `${uid}|${date}` -> daily stat
const rewards = new Map(); // `${uid}` -> reward doc
const key = (u, r) => `${u}|${r}`;
const clone = (o) => JSON.parse(JSON.stringify(o));
const newMastery = (u, r) => ({ userId: u, rootId: r, exposed: false, stage: 'learning', level: 0, streakCount: 0, lastCorrectDate: null, dueDate: null, lapses: 0, decodedWords: [] });

RootMastery.find = (f) => ({ lean: async () => [...rm.values()].filter(d => String(d.userId) === String(f.userId)).map(clone) });
RootMastery.findOne = (f) => ({ lean: async () => { const d = rm.get(key(f.userId, f.rootId)); return d ? clone(d) : null; } });
RootMastery.updateOne = async (f, upd, opts) => {
  const k = key(f.userId, f.rootId);
  let d = rm.get(k);
  if (!d) { if (!opts || !opts.upsert) return { acknowledged: true }; d = newMastery(f.userId, f.rootId); rm.set(k, d); }
  Object.assign(d, upd.$set || {});
  return { acknowledged: true };
};

DecodeDailyStat.findOne = (f) => ({ lean: async () => { const d = dds.get(key(f.userId, f.date)); return d ? clone(d) : null; } });
DecodeDailyStat.findOneAndUpdate = async (f, upd) => {
  const k = key(f.userId, f.date);
  let d = dds.get(k) || { userId: f.userId, date: f.date, attempted: 0, correct: 0, points: 0, newRoots: 0 };
  for (const [kk, v] of Object.entries(upd.$inc || {})) d[kk] = (d[kk] || 0) + v;
  dds.set(k, d); return d;
};

MathReward.findOne = async (f) => rewards.get(String(f.userId)) || null;
MathReward.create = async (doc) => { const d = { pointsEarned: 0, pointsSpent: 0, ...doc }; rewards.set(String(doc.userId), d); return d; };
MathReward.findOneAndUpdate = async (f, upd) => {
  let d = rewards.get(String(f.userId)) || { userId: f.userId, pointsEarned: 0, pointsSpent: 0 };
  for (const [k, v] of Object.entries(upd.$inc || {})) d[k] = (d[k] || 0) + v;
  rewards.set(String(f.userId), d); return d;
};

const decodeRouter = require('./decode');

// mock ONLY Datamuse (only these words are "real"); every other fetch — incl. the test's
// own HTTP calls to the local server — passes through to the real implementation.
const REAL = new Set(['biology', 'biography', 'antibiotic', 'geography', 'geology']);
const realFetch = global.fetch;
before(() => {
  global.fetch = async (url, opts) => {
    if (String(url).includes('api.datamuse.com')) {
      const w = new URL(url).searchParams.get('sp');
      const real = REAL.has(String(w).toLowerCase());
      return { ok: true, json: async () => (real ? [{ word: w }] : []) };
    }
    return realFetch(url, opts);
  };
});

const UID = 'u1';
function app() {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => { req.user = { _id: UID }; next(); });
  a.use('/api/decode', decodeRouter);
  return a;
}
const req = (a, method, path, body) => {
  const { createServer } = require('node:http');
  return new Promise((resolve, reject) => {
    const server = createServer(a).listen(0, async () => {
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

beforeEach(() => { rm.clear(); dds.clear(); rewards.clear(); });

test('GET /state returns a capped queue of new roots for a fresh user', async () => {
  const { status, json } = await req(app(), 'GET', '/api/decode/state?date=2026-07-13');
  assert.equal(status, 200);
  assert.equal(json.queue.length, 2);                 // NEW_ROOTS_PER_DAY cap
  assert.ok(json.queue.every(q => q.interaction === 'first_exposure'));
  assert.equal(json.summary.new, json.summary.total); // nothing learned yet
  assert.equal(json.cap.newLeft, 2);
});

test('first exposure marks the root exposed and credits the shared wallet', async () => {
  const r = await req(app(), 'POST', '/api/decode/answer', { rootId: 'bio', interaction: 'first_exposure', date: '2026-07-13', firstTry: true });
  assert.equal(r.status, 200);
  assert.equal(r.json.correct, true);
  assert.equal(r.json.awarded, 2);
  assert.equal(r.json.reward.balance, 2);
  assert.equal(rm.get('u1|bio').exposed, true);
  assert.equal(rm.get('u1|bio').stage, 'learning');
});

test('free generation needs 3 real words and promotes over two distinct days', async () => {
  rm.set('u1|bio', { ...newMastery(UID, 'bio'), exposed: true, stage: 'learning' });
  const words = ['biology', 'biography', 'antibiotic'];
  const d1 = await req(app(), 'POST', '/api/decode/answer', { rootId: 'bio', interaction: 'free_gen', date: '2026-07-13', firstTry: true, words });
  assert.equal(d1.json.correct, true);
  assert.equal(rm.get('u1|bio').streakCount, 1);
  assert.equal(rm.get('u1|bio').stage, 'learning');
  const d2 = await req(app(), 'POST', '/api/decode/answer', { rootId: 'bio', interaction: 'free_gen', date: '2026-07-14', firstTry: true, words });
  assert.equal(d2.json.correct, true);
  assert.equal(rm.get('u1|bio').stage, 'decoding');   // promoted
});

test('free generation rejects a made-up word (Datamuse says no)', async () => {
  rm.set('u1|bio', { ...newMastery(UID, 'bio'), exposed: true, stage: 'learning' });
  const r = await req(app(), 'POST', '/api/decode/answer', { rootId: 'bio', interaction: 'free_gen', date: '2026-07-13', firstTry: true, words: ['biology', 'biography', 'bioxyzzq'] });
  assert.equal(r.json.correct, false);                // only 2 of 3 are real
  const bad = r.json.perWord.find(p => p.word === 'bioxyzzq');
  assert.equal(bad.valid, false);
});

test('keyword recall grades the chosen meaning', async () => {
  rm.set('u1|derm', { ...newMastery(UID, 'derm'), exposed: true, stage: 'learning' });
  const right = await req(app(), 'POST', '/api/decode/answer', { rootId: 'derm', interaction: 'keyword_recall', date: '2026-07-13', firstTry: true, choice: 'skin' });
  assert.equal(right.json.correct, true);
  rm.set('u1|derm', { ...newMastery(UID, 'derm'), exposed: true, stage: 'learning' });
  const wrong = await req(app(), 'POST', '/api/decode/answer', { rootId: 'derm', interaction: 'keyword_recall', date: '2026-07-13', firstTry: true, choice: 'blood' });
  assert.equal(wrong.json.correct, false);
});

test('decoding a NOVEL word graduates the target AND ready co-roots only', async () => {
  // geo + therm are both ready (decoding); "geothermal" contains both taught roots
  rm.set('u1|geo', { ...newMastery(UID, 'geo'), exposed: true, stage: 'decoding' });
  rm.set('u1|therm', { ...newMastery(UID, 'therm'), exposed: true, stage: 'decoding' });
  const r = await req(app(), 'POST', '/api/decode/answer', {
    rootId: 'geo', interaction: 'decode_challenge', date: '2026-07-13', firstTry: true,
    word: 'geothermal', glossChoice: 'heat coming from inside the earth',
  });
  assert.equal(r.json.correct, true);
  assert.equal(r.json.awarded, 5);
  assert.deepEqual([...r.json.graduated].sort(), ['geo', 'therm']);
  assert.equal(rm.get('u1|geo').stage, 'mastered');
  assert.equal(rm.get('u1|therm').stage, 'mastered'); // ready co-root graduated too
});

test('a wrong gloss does not graduate', async () => {
  rm.set('u1|geo', { ...newMastery(UID, 'geo'), exposed: true, stage: 'decoding' });
  const r = await req(app(), 'POST', '/api/decode/answer', {
    rootId: 'geo', interaction: 'decode_challenge', date: '2026-07-13', firstTry: true,
    word: 'geothermal', glossChoice: 'a fear of water',
  });
  assert.equal(r.json.correct, false);
  assert.deepEqual(r.json.graduated, []);
  assert.equal(rm.get('u1|geo').stage, 'decoding');
});

test('a not-yet-ready root in the word does NOT graduate (ready-roots-only)', async () => {
  rm.set('u1|geo', { ...newMastery(UID, 'geo'), exposed: true, stage: 'decoding' });
  rm.set('u1|therm', { ...newMastery(UID, 'therm'), exposed: true, stage: 'learning' }); // still learning
  const r = await req(app(), 'POST', '/api/decode/answer', {
    rootId: 'geo', interaction: 'decode_challenge', date: '2026-07-13', firstTry: true,
    word: 'geothermal', glossChoice: 'heat coming from inside the earth',
  });
  assert.deepEqual(r.json.graduated, ['geo']);        // therm NOT graduated (not ready)
  assert.equal(rm.get('u1|therm').stage, 'learning');
});
