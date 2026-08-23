const mongoose = require('mongoose');
const { normalizeExerciseName } = require('../utils/exerciseName');

// Per-user, per-exercise overrides for the progression engine.
//
// Everything here is OPTIONAL. A null field means "fall back to the next source"
// in server/utils/progression.js resolveTarget/resolveStep:
//
//   setting (this model)  ->  active workout plan  ->  body-part default
//
// The row is created lazily, only when the user actually overrides something,
// so the vast majority of exercises never get a document.
//
// Why user-scoped and not on the Exercise catalog: the catalog is global and
// shared across all users (nameKey is globally unique), whereas "my gym's cable
// stack moves in 10 lb jumps" and "I train this one for 12-15" are personal.
const exerciseSettingSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  // Normalized exercise name — the join key shared by the catalog, logged
  // entries and plan entries.
  nameKey:      { type: String, required: true, trim: true, lowercase: true },
  // Display form, kept so settings stay readable without a catalog lookup.
  exerciseName: { type: String, required: true, trim: true },

  // Smallest weight jump for this exercise, in the user's display unit.
  // e.g. 5 (lb) for a barbell, 10 for a pin-loaded stack, 1.25 (kg) for plates.
  weightStep:   { type: Number, default: null, min: 0.25, max: 100 },

  // Rep window. Hitting repsMax on `targetSets` sets unlocks the next weight.
  repsMin:      { type: Number, default: null, min: 1, max: 100 },
  repsMax:      { type: Number, default: null, min: 1, max: 100 },

  // How many sets must reach repsMax before the weight goes up.
  targetSets:   { type: Number, default: null, min: 1, max: 12 },
}, { timestamps: true });

// Mongoose 9 dropped callback-style middleware; returning undefined is the
// supported pattern (same convention as models/Exercise.js).
exerciseSettingSchema.pre('validate', function setNameKey() {
  if (this.exerciseName) this.nameKey = normalizeExerciseName(this.exerciseName);
});

exerciseSettingSchema.pre('validate', function checkRepWindow() {
  if (this.repsMin != null && this.repsMax != null && this.repsMin > this.repsMax) {
    this.invalidate('repsMin', 'repsMin must be less than or equal to repsMax');
  }
});

// One override row per user per exercise.
exerciseSettingSchema.index({ userId: 1, nameKey: 1 }, { unique: true });

module.exports = mongoose.model('ExerciseSetting', exerciseSettingSchema);
