const mongoose = require('mongoose');

// One award per habit per day, created when the kid fully completes a points-bearing
// habit. Parent reviews it: approving credits the kid's shared points pool (MathReward),
// rejecting credits nothing. `points` is snapshotted at completion so later edits to the
// habit's point value don't retroactively change a pending/approved award.
const habitPointAwardSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  habitId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
  date:       { type: String, required: true }, // 'YYYY-MM-DD' (kid local)
  points:     { type: Number, required: true, min: 0 },
  status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewedBy: { type: String, default: null }, // admin email
  reviewedAt: { type: Date,   default: null },
}, { timestamps: true });

// One award row per habit per day.
habitPointAwardSchema.index({ habitId: 1, date: 1 }, { unique: true });
// Kid self-fetch path: awards for a user across dates.
habitPointAwardSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('HabitPointAward', habitPointAwardSchema);
