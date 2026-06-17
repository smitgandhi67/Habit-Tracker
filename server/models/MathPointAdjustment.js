const mongoose = require('mongoose');

// Audit log of every change to a user's points outside of earning them by practice:
//   redeem — kid/admin spends points on a reward (rewardKey set)
//   deduct — admin removes points (e.g. recording real-world reward use)
//   add    — admin grants bonus points
//   reset  — admin zeroes the pool
const mathPointAdjustmentSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  adminEmail: { type: String, default: null },  // null when the kid self-redeems
  type:       { type: String, enum: ['redeem', 'deduct', 'add', 'reset'], required: true },
  rewardKey:  { type: String, default: null },  // set for 'redeem'
  amount:     { type: Number, default: 0 },     // points moved (positive magnitude)
  reason:     { type: String, default: '' },
  createdAt:  { type: Date,   default: Date.now },
});

module.exports = mongoose.model('MathPointAdjustment', mathPointAdjustmentSchema);
