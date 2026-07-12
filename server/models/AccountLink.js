const mongoose = require('mongoose');

// A consent-based link between a parent account and a child account. Many-to-many:
// a child may have several parents, a parent several children. The parent creates a
// 'pending' link by the child's email; the child approves/rejects it. Only an
// 'approved' link grants the parent scoped access to that child's data. Either side
// may revoke an approved link (status 'revoked'). Roles are emergent — an account is a
// "parent" purely by virtue of having ≥1 approved link where it is the parent.
const accountLinkSchema = new mongoose.Schema({
  parentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  childId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status:      { type: String, enum: ['pending', 'approved', 'rejected', 'revoked'], default: 'pending', index: true },
  initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // always the parent in v1
  respondedAt: { type: Date, default: null }, // when the child approved/rejected
}, { timestamps: true });

// One link row per (parent, child) pair — a repeat request reuses/reopens it.
accountLinkSchema.index({ parentId: 1, childId: 1 }, { unique: true });

module.exports = mongoose.model('AccountLink', accountLinkSchema);
