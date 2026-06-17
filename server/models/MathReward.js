const mongoose = require('mongoose');

// One doc per user. The single shared points pool.
//   pointsEarned — grows +1 per first-try-correct answer (and is zeroed on admin reset)
//   pointsSpent  — grows on redeem/admin-deduct, shrinks on admin-add (bonus)
// Spendable balance = max(0, pointsEarned - pointsSpent) (see utils/math.balanceOf).
const mathRewardSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  pointsEarned: { type: Number, default: 0 },
  pointsSpent:  { type: Number, default: 0 },
});

module.exports = mongoose.model('MathReward', mathRewardSchema);
