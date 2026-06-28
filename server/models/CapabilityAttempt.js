const mongoose = require('mongoose');

// One doc per completed capability-baseline attempt. Mirrors ParentingAttempt
// (same instrument-engine output shape) but kept in its own collection so the
// two domains never mix (handover app concept §9 — separate module).
//
//   userId        — who answered (parent for parent_baseline, kid for kid_baseline)
//   subjectUserId — the CHILD the attempt describes. For both baseline instruments
//                   this is the child: parent_baseline rates the child; kid_baseline
//                   is the child rating themselves. (Unlike the parenting gap, both
//                   sides share subject = child — see buildBaselineGap.)
//   responses     — raw picks (re-scored server-side, never trusted)
//   subscales     — { key, raw, mean, n } per domain (engine output)
//   dimensions    — { key, score } per domain, normalized 0..1
//   interpretation— from the instrument's interpret()
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

const capabilityAttemptSchema = new mongoose.Schema({
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

// Latest attempt for a taker + instrument (history, "your latest baseline").
capabilityAttemptSchema.index({ userId: 1, instrumentKey: 1, completedAt: -1 });
// Baseline gap: latest attempt describing a given child.
capabilityAttemptSchema.index({ subjectUserId: 1, instrumentKey: 1, completedAt: -1 });

module.exports = mongoose.model('CapabilityAttempt', capabilityAttemptSchema);
