#!/usr/bin/env node
// End-to-end smoke for the parent-managed reward catalog against the running server.
// Backs up the real config, exercises add / key-dedup / redeem, then restores everything.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const MathRewardConfig = require('../models/MathRewardConfig');
const MathReward = require('../models/MathReward');
const MathPointAdjustment = require('../models/MathPointAdjustment');
const { ADMIN_EMAIL } = require('../utils/auth');

const BASE = 'http://localhost:3003';
let ok = true;
const check = (label, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) ok = false; };

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.findOne({ email: ADMIN_EMAIL });
  const kid = await User.findOne({ email: 'p3kid@example.com' });
  const tok = (u) => jwt.sign({ _id: u._id, email: u.email, name: u.name }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const req = (path, opts, who) => fetch(`${BASE}${path}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Cookie: `token=${tok(who)}`, ...(opts?.headers || {}) },
  });

  // Backup the real catalog so we can restore byte-for-byte.
  const backup = (await MathRewardConfig.findOne({ singleton: 'config' })).rewards.map(r => ({ key: r.key, label: r.label, costPoints: r.costPoints, unit: r.unit }));

  // --- add two same-named new rewards (no key) → server slugs + dedups ---
  let r = await req('/api/math/admin/config', { method: 'PUT', body: JSON.stringify({ rewards: [
    ...backup,
    { label: 'Ice Cream', costPoints: 5, unit: 'event' },
    { label: 'Ice Cream', costPoints: 9, unit: 'event' },
  ] }) }, admin);
  let j = await r.json();
  check('config: HTTP 200', r.status === 200);
  const keys = j.rewards.map(x => x.key);
  check('config: ice-cream key generated', keys.includes('ice-cream'));
  check('config: duplicate deduped to ice-cream-2', keys.includes('ice-cream-2'));

  // --- validation: blank label rejected ---
  check('config: blank label 400', (await req('/api/math/admin/config', { method: 'PUT', body: JSON.stringify({ rewards: [{ label: '  ', costPoints: 3 }] }) }, admin)).status === 400);
  check('config: cost<1 400', (await req('/api/math/admin/config', { method: 'PUT', body: JSON.stringify({ rewards: [{ label: 'X', costPoints: 0 }] }) }, admin)).status === 400);

  // --- kid redeems the new reward; needs balance, so credit temporarily ---
  const before = (await MathReward.findOne({ userId: kid._id }))?.pointsEarned || 0;
  await MathReward.updateOne({ userId: kid._id }, { $inc: { pointsEarned: 50 }, $setOnInsert: { pointsSpent: 0 } }, { upsert: true });
  const spentBefore = (await MathReward.findOne({ userId: kid._id }))?.pointsSpent || 0;
  r = await req('/api/math/redeem', { method: 'POST', body: JSON.stringify({ rewardKey: 'ice-cream', qty: 2 }) }, kid);
  check('redeem: HTTP 200', r.status === 200);
  const spentAfter = (await MathReward.findOne({ userId: kid._id }))?.pointsSpent || 0;
  check('redeem: spent +10 (2 x 5pts)', spentAfter - spentBefore === 10);
  check('redeem: unknown key 404', (await req('/api/math/redeem', { method: 'POST', body: JSON.stringify({ rewardKey: 'nope', qty: 1 }) }, kid)).status === 404);

  // --- CLEANUP: restore catalog, undo temp credit + redeem audit/spent ---
  await MathRewardConfig.updateOne({ singleton: 'config' }, { rewards: backup });
  await MathReward.updateOne({ userId: kid._id }, { $inc: { pointsEarned: -50, pointsSpent: -(spentAfter - spentBefore) } });
  await MathPointAdjustment.deleteMany({ userId: kid._id, type: 'redeem', rewardKey: 'ice-cream' });
  const restored = (await MathReward.findOne({ userId: kid._id }));
  check('cleanup: pool restored', (restored?.pointsEarned || 0) === before && (restored?.pointsSpent || 0) === spentBefore);
  const cfgNow = (await MathRewardConfig.findOne({ singleton: 'config' })).rewards;
  check('cleanup: catalog restored', cfgNow.length === backup.length && cfgNow.every((r2, i) => r2.key === backup[i].key));

  await mongoose.disconnect();
  console.log(ok ? '\nALL PASS' : '\nFAILURES PRESENT');
  process.exit(ok ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
