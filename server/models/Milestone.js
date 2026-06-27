const mongoose = require('mongoose');
const { MILESTONE_CATEGORIES, MILESTONE_STATUSES, MIN_GRADE, MAX_GRADE } = require('../utils/journey');

// A forward-looking, grade-anchored target on the kid's roadmap (the §9 ladder turned
// into trackable items). Parent-managed only — never exposed to the kid (protects the
// "love of learning above metrics" principle; the kid sees achievements, not targets).
const milestoneSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:    { type: String, required: true, trim: true, maxlength: 160 },
  grade:    { type: Number, min: MIN_GRADE, max: MAX_GRADE, default: null }, // school grade (null = ungrouped)
  category: { type: String, enum: MILESTONE_CATEGORIES, default: 'other' },
  status:   { type: String, enum: MILESTONE_STATUSES, default: 'upcoming' },
  target:   { type: String, trim: true, maxlength: 60, default: '' }, // freeform, e.g. "Jan 2027"
  notes:    { type: String, trim: true, maxlength: 500, default: '' },
  order:    { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Milestone', milestoneSchema);
