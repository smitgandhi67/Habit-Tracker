const mongoose = require('mongoose');

const sleepSessionSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  nightDate: { type: String, required: true }, // 'YYYY-MM-DD', derived from startAt + tz
  startAt:   { type: Date, required: true },
  endAt:     { type: Date, default: null }, // null = still active
}, { timestamps: true });

sleepSessionSchema.index({ userId: 1, nightDate: 1 });
// Partial index for fast "active session" lookup.
sleepSessionSchema.index(
  { userId: 1, endAt: 1 },
  { partialFilterExpression: { endAt: null } },
);

module.exports = mongoose.model('SleepSession', sleepSessionSchema);
