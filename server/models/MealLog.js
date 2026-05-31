const mongoose = require('mongoose');
const { MEAL_SLOTS } = require('./MealPlan');

const mealLogSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',     required: true, index: true },
  planId:   { type: mongoose.Schema.Types.ObjectId, ref: 'MealPlan', required: true },
  date:     { type: String, required: true },   // 'YYYY-MM-DD'
  slot:     { type: String, required: true, enum: MEAL_SLOTS },
  status:   { type: String, enum: ['not_started', 'done', 'skipped', 'swapped'], default: 'not_started' },
  swapNote: { type: String, trim: true },       // when status='swapped' — what was eaten instead
}, { timestamps: true });

// One log entry per (user, plan, date, slot). Allows upsert via findOneAndUpdate.
mealLogSchema.index({ userId: 1, planId: 1, date: 1, slot: 1 }, { unique: true });
// Hot read path: batch fetch by date range.
mealLogSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('MealLog', mealLogSchema);
