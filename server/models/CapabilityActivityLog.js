const mongoose = require('mongoose');

// One doc per completed run of a CapabilityActivity (handover_1.md §9 tracker).
// The rep is recorded FOR a child (subjectUserId); a parent may log on the child's
// behalf, or the kid logs their own (subjectUserId === userId then). `domainKeys`
// and `title` are SNAPSHOTTED from the activity at log time so the domain rollup
// (server/capabilities/rollup.js) needs no catalog join and stays accurate even if
// the activity is later re-tagged or archived. There is no per-day uniqueness — an
// activity can be done more than once a day; each run is a rep.
//
//   userId        — who recorded the log (parent or the kid themselves)
//   subjectUserId — the CHILD the rep counts toward (rollup is keyed on this)
//   activitySlug  — → CapabilityActivity.slug (reference, not a hard FK)
//   title         — activity title at log time (display without a join)
//   domainKeys    — activity's domains at log time (drives the rollup)
//   date          — 'YYYY-MM-DD' in the kid's local tz (like HabitLog)
//   note          — optional reflection ("how it went")
const capabilityActivityLogSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subjectUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  activitySlug:  { type: String, required: true, trim: true },
  title:         { type: String, default: '', trim: true },
  domainKeys:    { type: [String], default: [] },
  date:          { type: String, required: true }, // 'YYYY-MM-DD' (kid local)
  note:          { type: String, default: '', trim: true, maxlength: 280 },
}, { timestamps: true });

// Rollup path: every rep for a child within a date window.
capabilityActivityLogSchema.index({ subjectUserId: 1, date: -1 });
// "Recent activity" list for the logger.
capabilityActivityLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('CapabilityActivityLog', capabilityActivityLogSchema);
