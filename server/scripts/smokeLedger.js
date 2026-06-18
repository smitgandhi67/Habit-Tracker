#!/usr/bin/env node
// End-to-end smoke for the points ledger against the running server (port 3003).
// Seeds a deterministic mix of events for p3kid, pages the admin + kid ledgers,
// asserts ordering / kind / delta / cursor, then deletes everything it created.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Habit = require('../models/Habit');
const HabitPointAward = require('../models/HabitPointAward');
const MathPointAdjustment = require('../models/MathPointAdjustment');
const MathDailyStat = require('../models/MathDailyStat');
const { ADMIN_EMAIL } = require('../utils/auth');

const BASE = 'http://localhost:3003';
const TAG = 'LEDGER-SMOKE';
const EARN_DATE = '2000-01-02';
let ok = true;
const check = (label, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) ok = false; };

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.findOne({ email: ADMIN_EMAIL });
  const kid = await User.findOne({ email: 'p3kid@example.com' });
  const tok = (u) => jwt.sign({ _id: u._id, email: u.email, name: u.name }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const get = (path, who) => fetch(`${BASE}${path}`, { headers: { Cookie: `token=${tok(who)}` } }).then(r => r.json());

  const base = Date.now();
  const at = (ms) => new Date(base - ms);
  // Newest -> oldest by timestamp.
  await MathPointAdjustment.create({ userId: kid._id, type: 'redeem', amount: 8, rewardKey: 'tv', reason: `${TAG} redeem`, createdAt: at(1000) });
  await MathPointAdjustment.create({ userId: kid._id, type: 'deduct', amount: 3, reason: `${TAG} deduct`, adminEmail: admin.email, createdAt: at(2000) });
  await MathPointAdjustment.create({ userId: kid._id, type: 'add', amount: 5, reason: `${TAG} bonus`, adminEmail: admin.email, createdAt: at(3000) });
  await MathPointAdjustment.create({ userId: kid._id, type: 'add', amount: 10, reason: `Habit award 2099-12-31 ${TAG}`, adminEmail: admin.email, createdAt: at(4000) });
  const habit = await Habit.create({ userId: kid._id, name: 'SMOKE ledger habit', frequency: 'daily', points: 7 });
  await HabitPointAward.create({ userId: kid._id, habitId: habit._id, date: '2099-12-31', points: 7, status: 'rejected', reviewedBy: admin.email, reviewedAt: at(5000) });
  await MathPointAdjustment.create({ userId: kid._id, type: 'reset', amount: 20, reason: `${TAG} reset`, adminEmail: admin.email, createdAt: at(6000) });
  await MathDailyStat.updateOne({ userId: kid._id, date: EARN_DATE }, { $set: { attempted: 5, correct: 4 } }, { upsert: true });

  // --- page 1 (limit 3): three newest adjustments ---
  const p1 = await get(`/api/math/admin/ledger?userId=${kid._id}&limit=3`, admin);
  const k1 = p1.events.map(e => `${e.kind}:${e.delta}`);
  check('page1 order [redeem -8, deduct -3, add +5]', JSON.stringify(k1) === JSON.stringify(['redeem:-8', 'deduct:-3', 'add:5']));
  check('page1 nextCursor present', !!p1.nextCursor);

  // --- page 2 via cursor: approve, decline, reset ---
  const p2 = await get(`/api/math/admin/ledger?userId=${kid._id}&limit=3&cursor=${encodeURIComponent(p1.nextCursor)}`, admin);
  const k2 = p2.events.map(e => `${e.kind}:${e.delta}`);
  check('page2 order [approve +10, decline 0, reset -20]', JSON.stringify(k2) === JSON.stringify(['approve:10', 'decline:0', 'reset:-20']));
  check('page2 approve label is habit award', /^Habit award/.test(p2.events[0].label));
  check('page2 decline shows would-be 7', p2.events[1].meta?.wouldBe === 7);

  // --- earn row via wide limit (avoids the daily-stat window) ---
  const wide = await get(`/api/math/admin/ledger?userId=${kid._id}&limit=200`, admin);
  const earn = wide.events.find(e => e.kind === 'earn' && e.localDate === EARN_DATE);
  check('earn row present (+4 on 2000-01-02)', !!earn && earn.delta === 4);

  // --- validation + kid self endpoint ---
  check('admin: bad userId 400', (await fetch(`${BASE}/api/math/admin/ledger?userId=nope`, { headers: { Cookie: `token=${tok(admin)}` } })).status === 400);
  check('admin: bad cursor 400', (await fetch(`${BASE}/api/math/admin/ledger?userId=${kid._id}&cursor=notadate`, { headers: { Cookie: `token=${tok(admin)}` } })).status === 400);
  const kidView = await get('/api/math/ledger?limit=3', kid);
  check('kid self ledger matches page1', JSON.stringify(kidView.events.map(e => `${e.kind}:${e.delta}`)) === JSON.stringify(['redeem:-8', 'deduct:-3', 'add:5']));
  check('kid cannot hit admin ledger (403)', (await fetch(`${BASE}/api/math/admin/ledger?userId=${kid._id}`, { headers: { Cookie: `token=${tok(kid)}` } })).status === 403);

  // --- CLEANUP ---
  await MathPointAdjustment.deleteMany({ userId: kid._id, reason: { $regex: TAG } });
  await HabitPointAward.deleteMany({ habitId: habit._id });
  await Habit.deleteOne({ _id: habit._id });
  await MathDailyStat.deleteOne({ userId: kid._id, date: EARN_DATE });
  const leftovers = await MathPointAdjustment.countDocuments({ userId: kid._id, reason: { $regex: TAG } });
  check('cleanup: seed rows removed', leftovers === 0);

  await mongoose.disconnect();
  console.log(ok ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(ok ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
