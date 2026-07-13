const mongoose = require('mongoose');

// Per-(user, root) mastery for the Word Decoder module — the vocabulary analogue of
// MathFactMastery. Roots progress along TWO axes:
//   1. `stage` (the rung): learning -> decoding -> mastered. `exposed` records whether
//      the one-time first-exposure scaffold has run yet (absence of a doc = brand-new
//      root; the first answer creates the doc).
//   2. Leitner `level`/`dueDate` (the rest interval) — only applied AFTER a root is
//      mastered, so early rungs resurface every session while mastered roots rest weeks.
// The non-negotiable rule: a root reaches `mastered` only by decoding a NOVEL word (one
// not already in `decodedWords`), never by pair-recall.
const rootMasterySchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  rootId:          { type: String, required: true },                         // matches roots.json id
  exposed:         { type: Boolean, default: false },                        // first-exposure scaffold done
  stage:           { type: String, enum: ['learning', 'decoding', 'mastered'], default: 'learning' },
  level:           { type: Number, default: 0 },                             // Leitner level (rest interval), post-mastery
  streakCount:     { type: Number, default: 0 },                             // distinct-day successes toward the next promotion
  lastCorrectDate: { type: String, default: null },                          // 'YYYY-MM-DD' — enforces "different days"
  dueDate:         { type: String, default: null },                          // 'YYYY-MM-DD'; null or <= today => due
  lapses:          { type: Number, default: 0 },                             // demotions, for analytics
  decodedWords:    { type: [String], default: [] },                          // decode words already tested (the "novel" gate)
}, { timestamps: true });

rootMasterySchema.index({ userId: 1, rootId: 1 }, { unique: true });

module.exports = mongoose.model('RootMastery', rootMasterySchema);
