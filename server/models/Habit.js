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
  config: {
    label: { type: String, trim: true },
    type:  { type: String, enum: ['number', 'time', 'text'] },
  },
}, { timestamps: true });

module.exports = mongoose.model('Habit', habitSchema);
