const mongoose = require('mongoose');

// One award per solved Problem Journal entry, created when the kid marks a problem
// 'done'. Parent reviews it in the same queue as habit awards: approving credits the
// kid's shared points pool (MathReward), rejecting credits nothing. text/kind/points
// are snapshotted at done-time so later edits to the problem don't change the award.
// A problem can only ever earn this once — enforced by the unique problemId index.
const problemAwardSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  problemId:  { type: mongoose.Schema.Types.ObjectId, ref: 'ProblemEntry', required: true, unique: true },
  text:       { type: String, required: true },
  kind:       { type: String, default: 'idea' },
  date:       { type: String, required: true }, // 'YYYY-MM-DD' (kid local), for grouping/display
  points:     { type: Number, required: true, min: 0 },
  status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewedBy: { type: String, default: null }, // admin email
  reviewedAt: { type: Date,   default: null },
}, { timestamps: true });

// Kid self-fetch path: awards for a user.
problemAwardSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('ProblemAward', problemAwardSchema);
