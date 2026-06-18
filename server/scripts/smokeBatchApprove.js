#!/usr/bin/env node
// End-to-end smoke for habit-award approval against the running server (port 3003).
// Seeds throwaway pending awards, calls the real HTTP endpoints with a minted admin
// JWT, verifies credit + idempotency + single approve, then cleans everything up.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Habit = require('../models/Habit');
const HabitPointAward = require('../models/HabitPointAward');
const MathReward = require('../models/MathReward');
const MathPointAdjustment = require('../models/MathPointAdjustment');
const { ADMIN_EMAIL } = require('../utils/auth');

const BASE = 'http://localhost:3003';
const REASON_TAG = 'Habit award SMOKE-TEST';
let ok = true;
const check = (label, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) ok = false; };

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.findOne({ email: ADMIN_EMAIL });
  const kid = await User.findOne({ email: 'p3kid@example.com' });
  if (!admin || !kid) throw new Error('need admin + p3kid users');

  const token = jwt.sign({ _id: admin._id, email: admin.email, name: admin.name }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const cookie = `token=${token}`;
  const post = (path, body) => fetch(`${BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body),
  });

  // Throwaway habit + 3 pending awards (points 7,5,3) on far-future dates to avoid clashing real data.
  const habit = await Habit.create({ userId: kid._id, name: 'SMOKE habit', frequency: 'daily', points: 7 });
  const mk = (date, points) => HabitPointAward.create({ userId: kid._id, habitId: habit._id, date, points, status: 'pending' });
  const a1 = await mk('2099-01-01', 7);
  const a2 = await mk('2099-01-02', 5);
  const a3 = await mk('2099-01-03', 3);

  const before = (await MathReward.findOne({ userId: kid._id }))?.pointsEarned || 0;

  // --- batch approve a1 + a2 (+ a bogus id, should be skipped) ---
  let r = await post('/api/math/admin/habit-awards/approve-batch', { ids: [String(a1._id), String(a2._id), '0'.repeat(24)] });
  let j = await r.json();
  check('batch: HTTP 200', r.status === 200);
  check('batch: approved 2', j.approved === 2);
  const afterBatch = (await MathReward.findOne({ userId: kid._id }))?.pointsEarned || 0;
  check('batch: pool credited +12', afterBatch - before === 12);
  check('batch: a1 approved in DB', (await HabitPointAward.findById(a1._id)).status === 'approved');

  // --- idempotency: re-send same ids, nothing should change ---
  r = await post('/api/math/admin/habit-awards/approve-batch', { ids: [String(a1._id), String(a2._id)] });
  j = await r.json();
  check('batch idempotent: approved 0', j.approved === 0);
  const afterReplay = (await MathReward.findOne({ userId: kid._id }))?.pointsEarned || 0;
  check('batch idempotent: no extra credit', afterReplay === afterBatch);

  // --- empty + oversized validation ---
  check('validation: empty 400', (await post('/api/math/admin/habit-awards/approve-batch', { ids: [] })).status === 400);
  check('validation: >200 cap 400', (await post('/api/math/admin/habit-awards/approve-batch', { ids: Array(201).fill('0'.repeat(24)) })).status === 400);

  // --- single approve a3 ---
  r = await post(`/api/math/admin/habit-awards/${a3._id}/approve`, {});
  check('single: HTTP 200', r.status === 200);
  const afterSingle = (await MathReward.findOne({ userId: kid._id }))?.pointsEarned || 0;
  check('single: pool credited +3', afterSingle - afterReplay === 3);
  // single idempotent
  await post(`/api/math/admin/habit-awards/${a3._id}/approve`, {});
  check('single idempotent: no extra credit', ((await MathReward.findOne({ userId: kid._id }))?.pointsEarned || 0) === afterSingle);

  // --- CLEANUP: undo all credit + audit + seed docs so real data is untouched ---
  const credited = afterSingle - before; // 15
  await MathReward.updateOne({ userId: kid._id }, { $inc: { pointsEarned: -credited } });
  await MathPointAdjustment.deleteMany({ userId: kid._id, reason: { $in: ['Habit award 2099-01-01', 'Habit award 2099-01-02', 'Habit award 2099-01-03'] } });
  await HabitPointAward.deleteMany({ _id: { $in: [a1._id, a2._id, a3._id] } });
  await Habit.deleteOne({ _id: habit._id });
  const restored = (await MathReward.findOne({ userId: kid._id }))?.pointsEarned || 0;
  check('cleanup: pool restored to original', restored === before);

  await mongoose.disconnect();
  console.log(ok ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(ok ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
