const mongoose = require('mongoose');
const { validateFrequency } = require('../utils/frequency');

const habitSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name:       { type: String, required: true, trim: true },
  emoji:      { type: String, default: '💪' },
  frequency: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    validate: {
      validator: (v) => validateFrequency(v) === null,
      message: (props) => validateFrequency(props.value) || 'invalid frequency',
    },
  },
  order:      { type: Number, default: 0 },
  archivedAt: { type: Date, default: null, index: true },
  // Optional capability-domain tags (server/capabilities/domains.js keys). When set,
  // each 'done' log of this habit counts as a rep toward those domains in the Skills
  // cross-track rollup (e.g. a "name your feeling" habit -> emotional). Empty = the
  // habit doesn't feed the rollup. Sanitized to real domain keys in the habit routes.
  domainKeys: { type: [String], default: [] },
  // Reward points granted each day the habit is fully completed (status 'done').
  // Parent/admin-set only — never editable through the kid's habit CRUD routes.
  points:     { type: Number, default: 0, min: 0 },
  config: {
    label: { type: String, trim: true },
    type:  { type: String, enum: ['number', 'time', 'text'] },
  },
}, { timestamps: true });

module.exports = mongoose.model('Habit', habitSchema);
