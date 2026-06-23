const mongoose = require('mongoose');

// Minimal family linkage — the first such abstraction in this codebase. Ties a
// parent (admin) to a specific child user so the gap report can pair a parent's
// self-report with that child's child's-view attempt. No household/multi-family
// modeling; just the edge that the gap report needs.
const parentingLinkSchema = new mongoose.Schema({
  parentUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  childUserId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  label:        { type: String },
  createdAt:    { type: Date, default: Date.now },
});

parentingLinkSchema.index({ parentUserId: 1, childUserId: 1 }, { unique: true });

module.exports = mongoose.model('ParentingLink', parentingLinkSchema);
