const mongoose = require('mongoose');

const MEAL_SLOTS = ['early_am', 'breakfast', 'mid_morning', 'lunch', 'snack', 'dinner', 'bed'];

const mealItemSchema = new mongoose.Schema({
  slot:     { type: String, required: true, enum: MEAL_SLOTS },
  name:     { type: String, required: true, trim: true },   // short label, e.g. 'Moong dal + brown rice'
  foods:    { type: String, trim: true },                   // full ingredient string from source row
  calories: { type: Number, min: 0 },
  protein:  { type: Number, min: 0 },                       // grams
  micros:   { type: String, trim: true },                   // 'Iron, folate, beta-carotene'
  notes:    { type: String, trim: true },
  order:    { type: Number, default: 0 },
}, { _id: false });

const mealDaySchema = new mongoose.Schema({
  dayIndex:      { type: Number, required: true, min: 1, max: 60 }, // 1..cycleLength
  label:         { type: String, required: true, trim: true },     // 'Day 1'
  notes:         { type: String, trim: true },
  meals:         { type: [mealItemSchema], default: [] },
  totalCalories: { type: Number, min: 0 },                          // denormalised, recomputed from rows
  totalProtein:  { type: Number, min: 0 },
  flag:          { type: String, trim: true },                      // optional inline flag, e.g. 'low cal — add 1 fruit'
}, { _id: false });

const mealPlanSchema = new mongoose.Schema({
  // null when isMaster=true — master plans are app-wide reference, not user-owned.
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  isMaster:    { type: Boolean, default: false, index: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  cycleLength: { type: Number, default: 14, min: 1, max: 60 },
  // Optional anchor for date→day mapping. Stored as 'YYYY-MM-DD' (string) to match HabitLog.date semantics.
  // null on master plans (per-user) and on personal plans before the user "starts" them.
  startDate:   { type: String, default: null },
  // Link a personal clone back to its master template (informational; not used for auth).
  sourceMasterId: { type: mongoose.Schema.Types.ObjectId, ref: 'MealPlan', default: null },
  days:        { type: [mealDaySchema], default: [] },
  archivedAt:  { type: Date, default: null, index: true },
}, { timestamps: true });

mealPlanSchema.index({ ownerUserId: 1, archivedAt: 1 });

module.exports = mongoose.model('MealPlan', mealPlanSchema);
module.exports.MEAL_SLOTS = MEAL_SLOTS;
