const mongoose = require('mongoose');
const { PROBLEM_KINDS, PROBLEM_STATUSES } = require('../utils/builder');

// A "thing that bugs me / I'm curious about" — the problem-finding habit, which is the
// scarce, AI-proof skill (noticing problems worth solving). `date` is the kid's local
// YYYY-MM-DD, used for the per-day earn cap. `credited` marks entries that earned points.
const problemEntrySchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text:     { type: String, required: true, trim: true, maxlength: 280 },
  kind:     { type: String, enum: PROBLEM_KINDS, default: 'idea' },
  status:   { type: String, enum: PROBLEM_STATUSES, default: 'logged' },
  date:     { type: String, required: true }, // YYYY-MM-DD (kid local)
  credited: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('ProblemEntry', problemEntrySchema);
