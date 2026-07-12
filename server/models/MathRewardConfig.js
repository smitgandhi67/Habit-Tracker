const mongoose = require('mongoose');

// Per-child reward catalog. Each child owns their own catalog + costs; any linked
// parent may edit it. Rewards are bought by spending points from the child's balance.
//   unit 'minute' rewards are redeemable in quantities; 'event' rewards are one-shot.
//
// Historically this was a single global doc keyed by `singleton: 'config'`. It is now
// keyed by `childId`. The one-time migration (server/scripts/seedFamilyLinks.js) copies
// the old global catalog into a per-child doc for each existing child and drops the stale
// `singleton_1` unique index. `getConfig(childId)` in routes/math.js falls back to the
// defaults when a child has no row yet, so nothing breaks pre-migration.
const rewardItemSchema = new mongoose.Schema({
  key:        { type: String, required: true }, // 'tv', 'sleepover', ...
  label:      { type: String, required: true },
  costPoints: { type: Number, required: true }, // points per unit
  unit:       { type: String, default: 'event' }, // 'minute' | 'event'
}, { _id: false });

const mathRewardConfigSchema = new mongoose.Schema({
  childId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  rewards:  { type: [rewardItemSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('MathRewardConfig', mathRewardConfigSchema);
