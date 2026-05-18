const mongoose = require('mongoose');

const setSchema = new mongoose.Schema({
  reps:   { type: Number, min: 0 },
  weight: { type: Number, min: 0 }, // kg or lbs — user decides
}, { _id: false });

const gymEntrySchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date:         { type: String, required: true, index: true }, // 'YYYY-MM-DD'
  bodyPart:     {
    type: String,
    required: true,
    enum: ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full_body'],
  },
  exerciseName: { type: String, required: true, trim: true },
  feel:         { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  sets:         { type: [setSchema], validate: v => v.length >= 1 && v.length <= 3 },
  isPersonalRecord: { type: Boolean, default: false },
  prWeight:         { type: Number, default: 0 }, // max weight across all sets this entry
}, { timestamps: true });

gymEntrySchema.index({ userId: 1, exerciseName: 1 });
gymEntrySchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('GymEntry', gymEntrySchema);
