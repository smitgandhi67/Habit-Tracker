#!/usr/bin/env node
// Backfill habit names into old "Habit award {date}" ledger rows.
//
// Old MathPointAdjustment audit rows for habit approvals stored only
// reason="Habit award YYYY-MM-DD" — no habit name. New approvals write
// "Habit award: <name> (YYYY-MM-DD)". This rewrites the old rows.
//
// There is no link field between an adjustment and its HabitPointAward, so we
// match best-effort on (userId, date, points) against APPROVED awards. When a
// (userId,date,points) group has several awards of different habits, names are
// assigned to that group's rows in arbitrary order — the SET of names shown for
// that day/points is correct even if a row's exact timestamp pairing isn't.
// Unmatchable rows (award/habit deleted) become "Unknown habit".
//
// Usage:
//   node server/scripts/backfillHabitAwardNames.js [--dry-run]

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// c-ares on Windows can fail SRV lookups even when the OS resolves fine.
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch { /* ignore */ }

const mongoose = require('mongoose');
const Habit               = require('../models/Habit');
const HabitPointAward     = require('../models/HabitPointAward');
const MathPointAdjustment = require('../models/MathPointAdjustment');

const OLD_RE = /^Habit award (\d{4}-\d{2}-\d{2})$/; // exactly the old format

async function main() {
  const dryRun = process.argv.slice(2).includes('--dry-run');
  if (!process.env.MONGODB_URI) { console.error('Error: MONGODB_URI is not set.'); process.exit(2); }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    // Old-format habit-award adjustments only.
    const adjustments = (await MathPointAdjustment.find({
      type: 'add', reason: { $regex: '^Habit award \\d{4}-\\d{2}-\\d{2}$' },
    }).lean());

    if (adjustments.length === 0) { console.log('No old-format habit-award rows. Nothing to do.'); return; }

    // Approved awards → name lookup. Build a queue of habit names per (userId|date|points).
    const awards = await HabitPointAward.find({ status: 'approved' }).lean();
    const habitIds = [...new Set(awards.map(a => String(a.habitId)))];
    const habits = await Habit.find({ _id: { $in: habitIds } }).select('name').lean();
    const nameById = new Map(habits.map(h => [String(h._id), h.name]));

    const key = (userId, date, points) => `${userId}|${date}|${points}`;
    const queues = new Map(); // key -> [habitName, ...]
    for (const a of awards) {
      const k = key(String(a.userId), a.date, a.points);
      if (!queues.has(k)) queues.set(k, []);
      queues.get(k).push(nameById.get(String(a.habitId)) || 'Unknown habit');
    }

    const ops = [];
    let matched = 0, unknown = 0;
    for (const adj of adjustments) {
      const date = OLD_RE.exec(adj.reason)[1];
      const k = key(String(adj.userId), date, adj.amount);
      const q = queues.get(k);
      let name;
      if (q && q.length) { name = q.shift(); matched++; }
      else { name = 'Unknown habit'; unknown++; }
      ops.push({
        updateOne: {
          filter: { _id: adj._id },
          update: { $set: { reason: `Habit award: ${name} (${date})` } },
        },
      });
    }

    console.log(`Old-format rows: ${adjustments.length}`);
    console.log(`  matched to an approved award: ${matched}`);
    console.log(`  no award match (-> "Unknown habit"): ${unknown}`);
    console.log('\nSample rewrites:');
    for (const op of ops.slice(0, 10)) {
      console.log(`  ${op.updateOne.filter._id} -> ${op.updateOne.update.$set.reason}`);
    }

    if (dryRun) { console.log('\n[DRY RUN] No changes written.'); return; }

    const res = await MathPointAdjustment.bulkWrite(ops, { ordered: false });
    console.log(`\nUpdated ${res.modifiedCount ?? res.nModified ?? 0} rows.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => { console.error('Backfill failed:', err); process.exit(1); });
