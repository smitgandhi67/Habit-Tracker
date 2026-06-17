const mongoose = require('mongoose');

// Single global doc: the reward catalog. Admin-editable costs.
// Each reward is bought by spending points from the shared balance.
//   unit 'minute' rewards are redeemable in quantities; 'event' rewards are one-shot.
const rewardItemSchema = new mongoose.Schema({
  key:        { type: String, required: true }, // 'tv', 'sleepover', ...
  label:      { type: String, required: true },
  costPoints: { type: Number, required: true }, // points per unit
  unit:       { type: String, default: 'event' }, // 'minute' | 'event'
}, { _id: false });

const mathRewardConfigSchema = new mongoose.Schema({
  // Fixed singleton key so we always upsert the same doc.
  singleton: { type: String, default: 'config', unique: true },
  rewards:   { type: [rewardItemSchema], default: [] },
});

module.exports = mongoose.model('MathRewardConfig', mathRewardConfigSchema);
