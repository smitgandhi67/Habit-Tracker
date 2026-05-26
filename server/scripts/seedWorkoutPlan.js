#!/usr/bin/env node
// Idempotently seeds the 4 workout-plan habits (Push / Legs / Pull / Yoga)
// from workout_plan_ABC.md for a given user.
//
// Usage:
//   node server/scripts/seedWorkoutPlan.js <userEmail>
//   node server/scripts/seedWorkoutPlan.js --email=you@example.com
//   node server/scripts/seedWorkoutPlan.js --dry-run --email=you@example.com
//
// Reads MONGODB_URI from server/.env. Re-running the script is safe: existing
// habits (matched by name) are updated in place, not duplicated.

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

function workoutPlanHabits() {
  return [
    {
      name: 'Workout — Push Day (Day 1)',
      emoji: '💪',
      frequency: ['Mon'],
      order: 0,
      config: { label: 'Notes (weights × reps)', type: 'text' },
    },
    {
      name: 'Workout — Legs Day (Day 2)',
      emoji: '🦵',
      frequency: ['Wed'],
      order: 1,
      config: { label: 'Notes (weights × reps)', type: 'text' },
    },
    {
      name: 'Workout — Pull Day (Day 3)',
      emoji: '🏋️',
      frequency: ['Sat'],
      order: 2,
      config: { label: 'Notes (weights × reps)', type: 'text' },
    },
    {
      name: 'Yoga — Flexibility & Balance',
      emoji: '🧘',
      frequency: { type: 'weekly', times: 1 },
      order: 3,
      config: { label: 'Minutes', type: 'time' },
    },
  ];
}

async function upsertHabit(userId, def, { dryRun }) {
  const err = validateFrequency(def.frequency);
  if (err) throw new Error(`Invalid frequency for "${def.name}": ${err}`);
  const frequency = sanitizeFrequency(def.frequency);

  const existing = await Habit.findOne({ userId, name: def.name });
  if (existing) {
    if (dryRun) return { action: 'would-update', id: existing._id.toString(), name: def.name };
    existing.emoji     = def.emoji;
    existing.frequency = frequency;
    existing.order     = def.order;
    existing.config    = def.config;
    await existing.save();
    return { action: 'updated', id: existing._id.toString(), name: def.name };
  }

  if (dryRun) return { action: 'would-create', name: def.name };
  const created = await Habit.create({
    userId,
    name:      def.name,
    emoji:     def.emoji,
    frequency,
    order:     def.order,
    config:    def.config,
  });
  return { action: 'created', id: created._id.toString(), name: def.name };
}

async function main() {
  const { email, dryRun } = parseArgs(process.argv);
  if (!email) {
    console.error('Error: user email required.\nUsage: node server/scripts/seedWorkoutPlan.js <userEmail> [--dry-run]');
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

    console.log(`Seeding workout plan for ${user.email} (${user._id}) ${dryRun ? '[DRY RUN]' : ''}`);

    const results = [];
    for (const def of workoutPlanHabits()) {
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
