#!/usr/bin/env node
// Idempotently seeds the 4 progress-tracking habits for a given user:
//   • Weigh-in              — weekly
//   • Waist measurement     — weekly
//   • Progress photos       — biweekly (anchored at today)
//   • Body fat %            — monthly
//
// Matches the "Progress Tracking" section of workout_plan_ABC.md so users
// have a structured place to record body metrics over time.
//
// Usage:
//   node server/scripts/seedProgressHabits.js <userEmail>
//   node server/scripts/seedProgressHabits.js --email=you@example.com [--dry-run]
//
// Re-running is safe: habits matched by name are updated, not duplicated.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User     = require('../models/User');
const Habit    = require('../models/Habit');
const { validateFrequency, sanitizeFrequency } = require('../utils/frequency');

function parseArgs(argv) {
  const args = { email: null, dryRun: false };
  for (const raw of argv.slice(2)) {
    if (raw === '--dry-run') { args.dryRun = true; continue; }
    if (raw.startsWith('--email=')) { args.email = raw.slice('--email='.length); continue; }
    if (!raw.startsWith('--')) { args.email = raw; continue; }
    console.warn(`Ignoring unknown arg: ${raw}`);
  }
  return args;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function progressHabits() {
  return [
    {
      name: 'Weigh-in',
      emoji: '⚖️',
      frequency: { type: 'weekly', times: 1 },
      order: 100,
      config: { label: 'Weight (lb)', type: 'number' },
    },
    {
      name: 'Waist measurement',
      emoji: '📏',
      frequency: { type: 'weekly', times: 1 },
      order: 101,
      config: { label: 'Waist at navel (in)', type: 'number' },
    },
    {
      name: 'Progress photos (front / side / back)',
      emoji: '📸',
      frequency: { type: 'biweekly', times: 1, anchor: todayIso() },
      order: 102,
      config: { label: 'Notes', type: 'text' },
    },
    {
      name: 'Body fat %',
      emoji: '📊',
      frequency: { type: 'monthly', times: 1 },
      order: 103,
      config: { label: 'Body fat %', type: 'number' },
    },
  ];
}

async function upsertHabit(userId, def, { dryRun }) {
  const err = validateFrequency(def.frequency);
  if (err) throw new Error(`Invalid frequency for "${def.name}": ${err}`);
  const frequency = sanitizeFrequency(def.frequency);

  // Match including archived so we restore a previously archived progress habit.
  const existing = await Habit.findOne({ userId, name: def.name });
  if (existing) {
    if (dryRun) return { action: 'would-update', id: existing._id.toString(), name: def.name };
    existing.emoji      = def.emoji;
    // Preserve biweekly anchor if logs already exist for that habit.
    if (frequency && frequency.type === 'biweekly' && existing.frequency?.type === 'biweekly' && existing.frequency.anchor) {
      frequency.anchor = existing.frequency.anchor;
    }
    existing.frequency  = frequency;
    existing.order      = def.order;
    existing.config     = def.config;
    existing.archivedAt = null;
    await existing.save();
    return { action: 'updated', id: existing._id.toString(), name: def.name };
  }

  if (dryRun) return { action: 'would-create', name: def.name };
  const created = await Habit.create({
    userId,
    name:       def.name,
    emoji:      def.emoji,
    frequency,
    order:      def.order,
    config:     def.config,
  });
  return { action: 'created', id: created._id.toString(), name: def.name };
}

async function main() {
  const { email, dryRun } = parseArgs(process.argv);
  if (!email) {
    console.error('Error: user email required.\nUsage: node server/scripts/seedProgressHabits.js <userEmail> [--dry-run]');
    process.exit(2);
  }
  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI is not set. Did you populate server/.env?');
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.error(`No user found with email "${email}". Has this user signed in at least once?`);
      process.exit(1);
    }

    console.log(`Seeding progress habits for ${user.email} (${user._id}) ${dryRun ? '[DRY RUN]' : ''}`);

    const results = [];
    for (const def of progressHabits()) {
      const result = await upsertHabit(user._id, def, { dryRun });
      results.push(result);
      console.log(`  ${result.action.padEnd(14)} ${result.name}`);
    }

    const created = results.filter(r => r.action === 'created' || r.action === 'would-create').length;
    const updated = results.filter(r => r.action === 'updated' || r.action === 'would-update').length;
    console.log(`\nDone. ${created} created, ${updated} updated.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
