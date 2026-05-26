const mongoose = require('mongoose');

const sleepNightSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  nightDate: { type: String, required: true }, // 'YYYY-MM-DD'
  quality:   { type: Number, required: true, min: 1, max: 5 },
}, { timestamps: true });

sleepNightSchema.index({ userId: 1, nightDate: 1 }, { unique: true });

module.exports = mongoose.model('SleepNight', sleepNightSchema);
