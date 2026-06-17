const mongoose = require('mongoose');

// Weekly mastery tracking, independent of points. A fact retires for the week
// after 2 first-try-correct answers on 2 different days (retiredAt set at correctCount>=2).
// New ISO week → new weekKey → fact reappears in the pool.
const mathFactProgressSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  weekKey:         { type: String, required: true }, // e.g. '2026-W25'
  factKey:         { type: String, required: true }, // canonical 'minxmax', e.g. '7x8'
  correctCount:    { type: Number, default: 0 },
  lastCorrectDate: { type: String, default: null },  // 'YYYY-MM-DD' — enforces "different days"
  retiredAt:       { type: Date,   default: null },
});

mathFactProgressSchema.index({ userId: 1, weekKey: 1, factKey: 1 }, { unique: true });

module.exports = mongoose.model('MathFactProgress', mathFactProgressSchema);
