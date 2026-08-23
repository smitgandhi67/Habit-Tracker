const mongoose = require('mongoose');

// Hard cap on sets per exercise per session. Warmups, working sets and back-off
// sets all count against it. 12 comfortably covers pyramid and drop-set schemes
// while still bounding the document size.
const MAX_SETS_PER_ENTRY = 12;

const setSchema = new mongoose.Schema({
  reps:   { type: Number, min: 0 },
  weight: { type: Number, min: 0 }, // kg or lbs — user decides
  // Warmup sets are logged for the record but excluded from the progression
  // engine (server/utils/progression.js), which only reads working sets. Without
  // this flag a light warmup would look like a failed working set and would
  // wrongly block or reverse a weight increase.
  isWarmup: { type: Boolean, default: false },
}, { _id: false });

const safetyChecksSchema = new mongoose.Schema({
  warmup:       { type: Boolean, default: false }, // 5min cardio + 5min mobility + warmup sets
  eccentric:    { type: Boolean, default: false }, // 2-3 sec down, 1 sec up
  notToFailure: { type: Boolean, default: false }, // last 2 reps hard, 1-2 in tank
  breathing:    { type: Boolean, default: false }, // exhale on exertion, never hold heavy
  noJointPain:  { type: Boolean, default: false }, // stopped on sharp/joint pain
  noBehindNeck: { type: Boolean, default: false }, // pulldowns/presses front only
  noLockout:    { type: Boolean, default: false }, // no locked knees/elbows under heavy
  recovered:    { type: Boolean, default: false }, // 48h since training same muscle
}, { _id: false });

const gymEntrySchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:         { type: String, required: true, index: true }, // 'YYYY-MM-DD'
  bodyPart:     {
    type: String,
    required: true,
    enum: ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full_body'],
  },
  exerciseName: { type: String, required: true, trim: true },
  feel:         { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  sets:         {
    type: [setSchema],
    validate: {
      validator: v => Array.isArray(v) && v.length >= 1 && v.length <= MAX_SETS_PER_ENTRY,
      message: `sets must contain between 1 and ${MAX_SETS_PER_ENTRY} entries`,
    },
  },
  isPersonalRecord: { type: Boolean, default: false },
  prWeight:         { type: Number, default: 0 }, // max weight across all sets this entry
  // Optional link to the workout plan day this session followed (e.g., 'Day 1').
  // Used by PlanWeekGrid to show plan-vs-done coverage.
  planDayLabel: { type: String, trim: true, default: '' },
  // Per-session safety self-check (eight non-negotiable rules from the master plan).
  safetyChecks: { type: safetyChecksSchema, default: () => ({}) },
}, { timestamps: true });

gymEntrySchema.index({ userId: 1, exerciseName: 1 });
gymEntrySchema.index({ userId: 1, date: 1 });
// Progression read path: "last N sessions of this exercise, newest first",
// both for a single exercise and for the bulk recommendations aggregation.
gymEntrySchema.index({ userId: 1, exerciseName: 1, date: -1 });

const GymEntry = mongoose.model('GymEntry', gymEntrySchema);
GymEntry.MAX_SETS_PER_ENTRY = MAX_SETS_PER_ENTRY;

module.exports = GymEntry;
