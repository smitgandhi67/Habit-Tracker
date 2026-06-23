const mongoose = require('mongoose');

// One doc per completed quiz attempt. Re-takes accumulate as new docs so the
// history/trend views can chart change over time. Each attempt snapshots the
// instrument version it was scored against, so old results stay interpretable
// as item banks evolve.
//
//   userId        — who answered the questionnaire
//   subjectUserId — whose parenting is described:
//                     self-report   => equals userId
//                     child's-view  => the parent the child rated
//   responses     — raw Likert picks (re-scored server-side, never trusted)
//   subscales     — { key, raw, mean, n } per subscale (engine output)
//   dimensions    — { key, score } normalized 0..1 for cross-instrument compare
//   interpretation— { styleKey, bands } from the instrument's interpret()
const responseSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  value:  { type: Number, required: true },
}, { _id: false });

const subscaleSchema = new mongoose.Schema({
  key:  { type: String, required: true },
  raw:  { type: Number, required: true },
  mean: { type: Number, required: true },
  n:    { type: Number, required: true },
}, { _id: false });

const dimensionSchema = new mongoose.Schema({
  key:   { type: String, required: true },
  score: { type: Number, required: true },
}, { _id: false });

const parentingAttemptSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subjectUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  instrumentKey: { type: String, required: true },
  version:       { type: Number, required: true },
  responses:     { type: [responseSchema], default: [] },
  subscales:     { type: [subscaleSchema], default: [] },
  dimensions:    { type: [dimensionSchema], default: [] },
  interpretation:{ type: mongoose.Schema.Types.Mixed, default: {} },
  completedAt:   { type: Date, default: Date.now },
});

// History/trend for a taker; latest-self-report lookups.
parentingAttemptSchema.index({ userId: 1, instrumentKey: 1, completedAt: -1 });
// Gap report: latest child's-view describing a given parent.
parentingAttemptSchema.index({ subjectUserId: 1, instrumentKey: 1, completedAt: -1 });

module.exports = mongoose.model('ParentingAttempt', parentingAttemptSchema);
