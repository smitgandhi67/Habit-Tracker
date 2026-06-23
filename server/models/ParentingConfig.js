const mongoose = require('mongoose');

// Single global doc holding the active-version pointer per instrument. The item
// banks + scoring rules themselves live in the repo (server/parenting/
// instruments/*) — only the "which version is live" pointer is in the DB, so a
// parent/admin can roll instrument versions without a code deploy. Mirrors the
// MathRewardConfig singleton pattern.
const activeSchema = new mongoose.Schema({
  instrumentKey: { type: String, required: true },
  version:       { type: Number, required: true },
}, { _id: false });

const parentingConfigSchema = new mongoose.Schema({
  singleton: { type: String, default: 'config', unique: true },
  active:    { type: [activeSchema], default: [] },
});

module.exports = mongoose.model('ParentingConfig', parentingConfigSchema);
