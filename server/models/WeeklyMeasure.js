const mongoose = require('mongoose');

// The digitized fridge chart: one row per program-week. metrics keys are validated
// against the pack's metric registry in the routes (schema stays permissive so
// packs can evolve). Never grants points (guardrail R7).
const weeklyMeasureSchema = new mongoose.Schema({
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingProgram', required: true, index: true },
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  week:      { type: Number, required: true, min: 1, max: 12 },
  metrics:   { type: mongoose.Schema.Types.Mixed, default: {} },
  note:      { type: String, trim: true, maxlength: 500, default: '' },
}, { timestamps: true });

weeklyMeasureSchema.index({ programId: 1, week: 1 }, { unique: true });

module.exports = mongoose.model('WeeklyMeasure', weeklyMeasureSchema);
