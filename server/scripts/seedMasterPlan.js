#!/usr/bin/env node
// Idempotently seeds the shared "master" WorkoutPlan from workout_plan_ABC.md.
// Ensures each Exercise referenced by the plan exists in the global Exercise
// catalogue. Safe to run multiple times: existing plan is overwritten; existing
// exercises are kept (videoUrl preserved).
//
// Usage:
//   node server/scripts/seedMasterPlan.js
//   node server/scripts/seedMasterPlan.js --dry-run
//
// Reads MONGODB_URI from server/.env.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose    = require('mongoose');
const Exercise    = require('../models/Exercise');
const WorkoutPlan = require('../models/WorkoutPlan');

const PLAN_NAME = '3-Day Full Body (A/B/C)';

const PLAN = {
  name:        PLAN_NAME,
  description: 'Push / Legs / Pull rotation. Compounds first (8-10 reps), isolation last (12-15). 3 sets each, last 2 reps hard with 1-2 in the tank.',
  days: [
    {
      label: 'Day 1', focus: 'Push', isRestDay: false,
      notes: 'Compound first, heavier weight 8-10 reps. Rest 90-120s between heavy compounds, 60-90s isolations.',
      exercises: [
        { name: 'Bench Press',                          bodyPart: 'chest',     sets: 3, repsMin: 8,  repsMax: 10, notes: 'Heavier weight, compound first' },
        { name: 'Incline Bench Press',                  bodyPart: 'chest',     sets: 3, repsMin: 8,  repsMax: 10, notes: 'Heavier weight' },
        { name: 'Shoulder Press',                       bodyPart: 'shoulders', sets: 3, repsMin: 8,  repsMax: 10, notes: 'Heavier weight' },
        { name: 'Lever Pec Deck Fly',                   bodyPart: 'chest',     sets: 3, repsMin: 12, repsMax: 15, notes: 'Isolation, controlled' },
        { name: 'Dumbbell Lateral Raises',              bodyPart: 'shoulders', sets: 3, repsMin: 12, repsMax: 15, notes: 'Light, strict form' },
        { name: 'Lever Preacher Curl',                  bodyPart: 'arms',      sets: 3, repsMin: 12, repsMax: 15, notes: 'Biceps' },
        { name: 'Incline Dumbbell Overhead Extension',  bodyPart: 'arms',      sets: 3, repsMin: 12, repsMax: 15, notes: 'Triceps' },
        { name: 'Plank',                                bodyPart: 'core',      sets: 3, repsMin: 30, repsMax: 45, notes: 'Core finisher (seconds)' },
      ],
    },
    {
      label: 'Day 2', focus: 'Legs', isRestDay: false,
      notes: 'Main compound first. Walking lunges per-leg counts.',
      exercises: [
        { name: 'Goblet Squat',         bodyPart: 'legs', sets: 3, repsMin: 8,  repsMax: 10, notes: 'Main leg compound (or Leg Press)' },
        { name: 'Romanian Deadlift',    bodyPart: 'legs', sets: 3, repsMin: 8,  repsMax: 10, notes: 'Dumbbells. Hamstrings + glutes' },
        { name: 'Walking Lunges',       bodyPart: 'legs', sets: 3, repsMin: 10, repsMax: 10, notes: '10 per leg. Unilateral leg work' },
        { name: 'Leg Extensions',       bodyPart: 'legs', sets: 3, repsMin: 12, repsMax: 15, notes: 'Quad finisher' },
        { name: 'Seated Leg Curls',     bodyPart: 'legs', sets: 3, repsMin: 12, repsMax: 15, notes: 'Hamstring finisher' },
        { name: 'Calf Raise',           bodyPart: 'legs', sets: 3, repsMin: 12, repsMax: 15, notes: 'Full range of motion' },
        { name: 'Hanging Knee Raise',   bodyPart: 'core', sets: 3, repsMin: 10, repsMax: 12, notes: 'Core' },
      ],
    },
    {
      label: 'Day 3', focus: 'Pull', isRestDay: false,
      notes: 'Pulldowns front only (no behind-the-neck).',
      exercises: [
        { name: 'Cable Pull Down',           bodyPart: 'back',      sets: 3, repsMin: 8,  repsMax: 10, notes: 'Heavier weight, compound first' },
        { name: 'Seated Cable Row',          bodyPart: 'back',      sets: 3, repsMin: 8,  repsMax: 10, notes: 'Heavier weight' },
        { name: 'Single Arm Dumbbell Row',   bodyPart: 'back',      sets: 3, repsMin: 8,  repsMax: 10, notes: 'One side at a time' },
        { name: 'Lever Seated Rear Delt Row',bodyPart: 'shoulders', sets: 3, repsMin: 12, repsMax: 15, notes: 'Posture, shoulder health' },
        { name: 'MTS Bicep Curls',           bodyPart: 'arms',      sets: 3, repsMin: 12, repsMax: 15, notes: 'Biceps' },
        { name: 'Barbell Biceps Curls',      bodyPart: 'arms',      sets: 3, repsMin: 12, repsMax: 15, notes: 'Biceps variation' },
        { name: 'Back Extension',            bodyPart: 'back',      sets: 3, repsMin: 12, repsMax: 15, notes: 'Lower back' },
      ],
    },
    {
      label: 'Yoga', focus: 'Flexibility & Balance', isRestDay: false,
      notes: '60-minute yoga session. Mobility-focused, no heavy lifting.',
      exercises: [
        { name: 'Yoga', bodyPart: 'full_body', sets: 1, repsMin: 60, repsMax: 60, notes: '60 min session (reps = minutes)' },
      ],
    },
  ],
};

function parseArgs(argv) {
  const args = { dryRun: false };
  for (const raw of argv.slice(2)) {
    if (raw === '--dry-run') args.dryRun = true;
    else console.warn(`Ignoring unknown arg: ${raw}`);
  }
  return args;
}

// Ensure the Exercise doc exists; return the resolved doc with _id.
// Existing exercises are kept untouched (preserves any videoUrl already set).
async function ensureExercise(name, bodyPart, { dryRun }) {
  const found = await Exercise.findOne({ name, bodyPart });
  if (found) return { doc: found, action: 'exists' };
  if (dryRun) return { doc: { _id: null, name, bodyPart }, action: 'would-create' };
  const created = await Exercise.create({ name, bodyPart });
  return { doc: created, action: 'created' };
}

async function buildDays({ dryRun }) {
  const builtDays = [];
  const exerciseActions = [];
  for (const day of PLAN.days) {
    const planExercises = [];
    for (let i = 0; i < day.exercises.length; i++) {
      const ex = day.exercises[i];
      const { doc, action } = await ensureExercise(ex.name, ex.bodyPart, { dryRun });
      exerciseActions.push({ name: ex.name, action });
      planExercises.push({
        exerciseId:   doc._id || undefined,
        exerciseName: ex.name,
        bodyPart:     ex.bodyPart,
        sets:         ex.sets,
        repsMin:      ex.repsMin,
        repsMax:      ex.repsMax,
        notes:        ex.notes || '',
        order:        i,
      });
    }
    builtDays.push({
      label:     day.label,
      focus:     day.focus,
      isRestDay: !!day.isRestDay,
      notes:     day.notes || '',
      exercises: planExercises,
    });
  }
  return { builtDays, exerciseActions };
}

async function main() {
  const { dryRun } = parseArgs(process.argv);
  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI is not set. Did you populate server/.env?');
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    console.log(`Seeding master WorkoutPlan "${PLAN_NAME}" ${dryRun ? '[DRY RUN]' : ''}`);

    const { builtDays, exerciseActions } = await buildDays({ dryRun });

    const created = exerciseActions.filter(a => a.action === 'created' || a.action === 'would-create').length;
    const existed = exerciseActions.filter(a => a.action === 'exists').length;
    console.log(`  Exercises: ${created} created, ${existed} already present.`);

    const existing = await WorkoutPlan.findOne({ isMaster: true, name: PLAN_NAME });
    if (existing) {
      if (dryRun) {
        console.log(`  would-update  master plan ${existing._id}`);
      } else {
        existing.description = PLAN.description;
        existing.days        = builtDays;
        existing.archivedAt  = null;
        await existing.save();
        console.log(`  updated       master plan ${existing._id}`);
      }
    } else {
      if (dryRun) {
        console.log('  would-create  master plan');
      } else {
        const plan = await WorkoutPlan.create({
          isMaster:    true,
          ownerUserId: null,
          name:        PLAN.name,
          description: PLAN.description,
          days:        builtDays,
        });
        console.log(`  created       master plan ${plan._id}`);
      }
    }

    console.log('\nDone.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
