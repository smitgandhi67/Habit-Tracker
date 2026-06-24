const mongoose = require('mongoose');

// Persistent per-fact Leitner mastery, replacing the week-scoped MathFactProgress.
// One doc per (user, op, fact). Absence of a doc = a brand-new fact, due now at
// level 0 — so only mastered/in-progress facts are stored and the suppressed set
// the client receives stays small. A fact rests until `dueDate`; mastering it
// (PROMOTE_AT first-try-corrects on distinct days) bumps `level` and pushes the
// dueDate out by INTERVAL_WEEKS[level]; a first-try miss demotes it, due now.
const mathFactMasterySchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  op:              { type: String, required: true }, // any registered question-type key; route validates membership
  factKey:         { type: String, required: true }, // op-local canonical key, e.g. '7x8', '3+5', '9-4', '12/3'
  level:           { type: Number, default: 0 },     // 0..MAX_LEVEL
  streakCount:     { type: Number, default: 0 },     // first-try corrects toward the next promotion (0..PROMOTE_AT)
  lastCorrectDate: { type: String, default: null },  // 'YYYY-MM-DD' — enforces "different days"
  dueDate:         { type: String, default: null },  // 'YYYY-MM-DD'; null or <= today ⇒ due
  lapses:          { type: Number, default: 0 },     // demotions, for analytics
}, { timestamps: true });

mathFactMasterySchema.index({ userId: 1, op: 1, factKey: 1 }, { unique: true });

module.exports = mongoose.model('MathFactMastery', mathFactMasterySchema);
