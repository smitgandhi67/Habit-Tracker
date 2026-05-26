const mongoose = require('mongoose');

const planExerciseSchema = new mongoose.Schema({
  exerciseId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise' },
  exerciseName: { type: String, required: true, trim: true }, // denormalised — survives Exercise rename/delete
  bodyPart: {
    type: String,
    enum: ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full_body'],
  },
  sets:    { type: Number, default: 3, min: 1, max: 10 },
  repsMin: { type: Number, min: 1 },
  repsMax: { type: Number, min: 1 },
  notes:   { type: String, trim: true },
  order:   { type: Number, default: 0 },
}, { _id: false });

const planDaySchema = new mongoose.Schema({
  label:     { type: String, required: true, trim: true }, // 'Day 1', 'Day 2', 'Yoga'
  focus:     { type: String, trim: true },                 // 'Push', 'Legs', 'Pull'
  isRestDay: { type: Boolean, default: false },
  notes:     { type: String, trim: true },
  exercises: { type: [planExerciseSchema], default: [] },
}, { _id: false });

const workoutPlanSchema = new mongoose.Schema({
  // null when isMaster=true — master plans are app-wide reference, not user-owned.
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  isMaster:    { type: Boolean, default: false, index: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  days:        { type: [planDaySchema], default: [] },
  archivedAt:  { type: Date, default: null, index: true },
}, { timestamps: true });

// Hot read path: GET /api/plans returns master + own (non-archived).
workoutPlanSchema.index({ ownerUserId: 1, archivedAt: 1 });

module.exports = mongoose.model('WorkoutPlan', workoutPlanSchema);
