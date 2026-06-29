const mongoose = require('mongoose');

// App-wide reference catalog of evidence-based activities (handover_1.md §6).
// Unlike meal plans there is no per-user clone — these are shared reference items
// the parent browses and (Day 5) logs completions against. Seeded idempotently by
// `slug` from server/capabilities/activitiesSeed.js.
//
//   slug         — stable id (seed upsert key; future activity-log reference)
//   domainKeys   — primary capability domains this builds (→ domain registry)
//   tier         — 1 (highest evidence) … 3; null for the skip list
//   kind         — 'do' (recommend) | 'skip' (deprioritize)
//   approachRule — the coaching note that makes the activity work (the differentiator)
//   citationKey  — → citation registry; null where §6 gives no specific anchor
//   minAge/maxAge— age-fit bounds in years; null = open
const capabilityActivitySchema = new mongoose.Schema({
  slug:         { type: String, required: true, unique: true, trim: true },
  title:        { type: String, required: true, trim: true },
  domainKeys:   { type: [String], default: [] },
  tier:         { type: Number, enum: [1, 2, 3, null], default: null },
  kind:         { type: String, enum: ['do', 'skip'], default: 'do', index: true },
  approachRule: { type: String, default: '', trim: true },
  why:          { type: String, default: '', trim: true },
  citationKey:  { type: String, default: null },
  skipReason:   { type: String, default: '', trim: true },
  minAge:       { type: Number, default: null },
  maxAge:       { type: Number, default: null },
  order:        { type: Number, default: 0 },
  archivedAt:   { type: Date, default: null, index: true },
}, { timestamps: true });

// Browse path: active items, ordered by tier then order.
capabilityActivitySchema.index({ archivedAt: 1, tier: 1, order: 1 });

module.exports = mongoose.model('CapabilityActivity', capabilityActivitySchema);
