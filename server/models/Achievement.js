const mongoose = require('mongoose');
const { ACHIEVEMENT_CATEGORIES, MIN_GRADE, MAX_GRADE } = require('../utils/journey');

// A real thing that actually happened — the brag-sheet entry (placement, project shipped,
// award, service, research). The raw material for every future application; capturing it
// in real time beats reconstructing it senior year. Parent-managed; the kid sees these
// (read-only) as a celebratory "trophy shelf".
const achievementSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:       { type: String, required: true, trim: true, maxlength: 160 },
  date:        { type: String, required: true }, // YYYY-MM-DD when it happened
  grade:       { type: Number, min: MIN_GRADE, max: MAX_GRADE, default: null }, // school year (optional grouping)
  category:    { type: String, enum: ACHIEVEMENT_CATEGORIES, default: 'other' },
  placement:   { type: String, trim: true, maxlength: 80, default: '' }, // "State qualifier", "1st place"
  hours:       { type: Number, min: 0, default: 0 },                      // for service entries
  url:         { type: String, trim: true, maxlength: 300, default: '' }, // evidence / link
  description: { type: String, trim: true, maxlength: 1000, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Achievement', achievementSchema);
