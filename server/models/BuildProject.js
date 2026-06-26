const mongoose = require('mongoose');
const { FLUENCY_LEVELS } = require('../utils/builder');

// A real thing the kid made ("things I made"). Ships only past the explain-every-line
// gate (see utils/builder.canShip). `aiLevel` records how AI was used on THIS project;
// the kid's overall badge is the highest aiLevel across shipped projects.
const buildProjectSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:       { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  url:         { type: String, trim: true, maxlength: 300, default: '' },
  audience:    { type: String, trim: true, maxlength: 140, default: '' }, // who actually uses it
  aiLevel:     { type: String, enum: FLUENCY_LEVELS, default: 'helper' },
  explainedIt: { type: Boolean, default: false },
  shippedAt:   { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('BuildProject', buildProjectSchema);
