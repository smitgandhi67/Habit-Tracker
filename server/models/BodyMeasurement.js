const mongoose = require('mongoose');

// One document per user per calendar date. Every metric is optional so a day can
// hold just a weight (logged daily) or a full circumference set (logged weekly).
// Values are stored raw — the unit is a display label on the User (weightUnit /
// lengthUnit), matching the Gym weight convention.
const METRIC = { type: Number, min: 0, default: undefined };

const bodyMeasurementSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:    { type: String, required: true }, // 'YYYY-MM-DD'
  weight:  METRIC,
  chest:   METRIC,
  waist:   METRIC,
  abdomen: METRIC,
  hips:    METRIC,
}, { timestamps: true });

bodyMeasurementSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('BodyMeasurement', bodyMeasurementSchema);
