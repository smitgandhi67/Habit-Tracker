const mongoose = require('mongoose');

// One kid's enrollment in a Depth Pack (server/capabilities/packs). The linked
// habit is the daily-dose vehicle: completing it flows through the normal habit
// engine (points/streaks/rollup) — this model never touches the ledger.
const trainingProgramSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  packKey:     { type: String, required: true },
  status:      { type: String, enum: ['active', 'paused', 'done'], default: 'active', index: true },
  currentWeek: { type: Number, default: 1, min: 1, max: 12 },
  habitId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
  startedAt:   { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

// One live (non-done) program per kid per pack; done programs keep history.
trainingProgramSchema.index(
  { userId: 1, packKey: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['active', 'paused'] } } }
);

module.exports = mongoose.model('TrainingProgram', trainingProgramSchema);
