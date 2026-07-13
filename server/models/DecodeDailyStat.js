const mongoose = require('mongoose');

// One doc per user per local day for the Word Decoder — mirrors MathDailyStat. Powers the
// streak, the daily-goal ring, the week chart, and the session cap. `correct` counts
// first-try-correct interactions; `points` is what was credited to the shared math wallet
// that day; `newRoots` is how many roots were first-exposed today (drives the "N new roots
// per day" half of the session cap).
const decodeDailyStatSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:      { type: String, required: true }, // 'YYYY-MM-DD' (client local)
  attempted: { type: Number, default: 0 },
  correct:   { type: Number, default: 0 },
  points:    { type: Number, default: 0 },
  newRoots:  { type: Number, default: 0 },
});

decodeDailyStatSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DecodeDailyStat', decodeDailyStatSchema);
