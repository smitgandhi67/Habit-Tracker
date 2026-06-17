const mongoose = require('mongoose');

// One doc per user per local day. Powers daily/weekly progress charts + accuracy.
// `correct` counts first-try-correct answers (also what earns points, 1:1).
const mathDailyStatSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:      { type: String, required: true }, // 'YYYY-MM-DD' (client local)
  attempted: { type: Number, default: 0 },
  correct:   { type: Number, default: 0 },
});

mathDailyStatSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('MathDailyStat', mathDailyStatSchema);
