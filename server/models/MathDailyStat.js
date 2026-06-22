const mongoose = require('mongoose');

// One doc per user per local day. Powers daily/weekly progress charts + accuracy.
// `correct` counts first-try-correct answers (drives accuracy/progress charts).
// `points` is the points earned that day — no longer 1:1 with `correct` because
// operations are weighted (subtraction = 3, others = 1). The ledger reads
// `points` (falling back to `correct` for legacy rows written before weighting).
const mathDailyStatSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:      { type: String, required: true }, // 'YYYY-MM-DD' (client local)
  attempted: { type: Number, default: 0 },
  correct:   { type: Number, default: 0 },
  points:    { type: Number, default: 0 },
});

mathDailyStatSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('MathDailyStat', mathDailyStatSchema);
