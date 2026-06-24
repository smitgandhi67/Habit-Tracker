#!/usr/bin/env node
// One-off launch migration for the Leitner spaced-repetition system (MathFactMastery).
//
// Seeds two things so kids don't re-drill what they already know on day one:
//   1. This-week mastered multiplication facts — read each user's current ISO-week
//      retired facts from the legacy MathFactProgress and create mastery rows at
//      level 1 (rest 1 week). They won't reappear until next week.
//   2. Trivial 0/1 facts across all ops (×0/×1, +0, −0, ÷1, n−n, n÷n) — seed at a
//      high level (long rest) so the newly-included easy facts start deprioritized
//      instead of flooding the pool.
//
// Idempotent: uses upsert + $setOnInsert keyed on { userId, op, factKey }, so a fact
// the kid has already progressed is never overwritten. Safe to re-run.
//
// Usage:
//   node server/scripts/seedFactMastery.js [--dry-run]

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// c-ares on Windows can fail SRV lookups even when the OS resolves fine.
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch { /* ignore */ }

const mongoose = require('mongoose');
const User = require('../models/User');
const MathFactProgress = require('../models/MathFactProgress');
const MathFactMastery = require('../models/MathFactMastery');
const { factKeyFor, isoWeekKey, initialLevelFor, dueDateAfter } = require('../utils/math');
const { OP_KEYS, get } = require('../utils/questionTypes');

// Full operand cap per type for enumerating its universe (the grade caps are tighter
// on the client; here we seed across the whole range so trivial facts rest everywhere).
const CAPS = { mul: 20, add: 40, sub: 40, div: 40, sq: 20, sqrt: 20 };

// Enumerate every trivial fact across all registered question types, via the registry.
function trivialFacts() {
  const out = [];
  for (const op of OP_KEYS) {
    const max = CAPS[op] ?? 40;
    for (const f of get(op).generate(max)) {
      if (get(op).isTrivial(f.a, f.b)) out.push({ op, a: f.a, b: f.b });
    }
  }
  return out;
}

// Upsert that only writes when the row is new (never clobbers existing progress).
function seedOp(userId, op, a, b, level, dueDate) {
  return {
    updateOne: {
      filter: { userId, op, factKey: factKeyFor(op, a, b) },
      update: { $setOnInsert: { level, streakCount: 0, lastCorrectDate: null, dueDate, lapses: 0 } },
      upsert: true,
    },
  };
}

async function main() {
  const dryRun = process.argv.slice(2).includes('--dry-run');
  if (!process.env.MONGODB_URI) { console.error('Error: MONGODB_URI is not set.'); process.exit(2); }

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekKey = isoWeekKey(todayStr);
  const trivial = trivialFacts();
  const trivialLevel = initialLevelFor('mul', 0, 0);            // MAX_LEVEL-1 for any trivial fact
  const trivialDue = dueDateAfter(todayStr, trivialLevel);
  const masterDue = dueDateAfter(todayStr, 1);                  // gentle L1 = +1 week

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const users = await User.find().select('_id').lean();
    console.log(`Users: ${users.length} · week ${weekKey} · trivial facts/op-set: ${trivial.length}`);

    let totalMul = 0, totalTrivial = 0, usersWithMasters = 0;
    for (const u of users) {
      const userId = u._id;
      const ops = [];

      // 1. This-week mastered mul facts → level 1.
      const retired = await MathFactProgress.find({ userId, weekKey, retiredAt: { $ne: null } }).distinct('factKey');
      if (retired.length) usersWithMasters++;
      for (const factKey of retired) {
        ops.push({
          updateOne: {
            filter: { userId, op: 'mul', factKey },
            update: { $setOnInsert: { level: 1, streakCount: 0, lastCorrectDate: null, dueDate: masterDue, lapses: 0 } },
            upsert: true,
          },
        });
      }
      totalMul += retired.length;

      // 2. Trivial 0/1 facts → high level (long rest).
      for (const f of trivial) ops.push(seedOp(userId, f.op, f.a, f.b, trivialLevel, trivialDue));
      totalTrivial += trivial.length;

      if (!dryRun && ops.length) await MathFactMastery.bulkWrite(ops, { ordered: false });
    }

    console.log(`${dryRun ? '[DRY RUN] ' : ''}This-week mul masters seeded: ${totalMul} (across ${usersWithMasters} users)`);
    console.log(`${dryRun ? '[DRY RUN] ' : ''}Trivial fact upserts attempted: ${totalTrivial}`);
    console.log('Done.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => { console.error('Seed failed:', err); process.exit(1); });
