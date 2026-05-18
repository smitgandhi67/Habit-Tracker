const mongoose = require('mongoose');

const habitLogSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  habitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
  date:    { type: String, required: true }, // 'YYYY-MM-DD'
  status: {
    type: String,
    enum: ['not_started', 'done', 'half_done', 'not_done'],
    default: 'not_started',
  },
  value: { type: mongoose.Schema.Types.Mixed }, // number, string, or null
});

habitLogSchema.index({ habitId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('HabitLog', habitLogSchema);
