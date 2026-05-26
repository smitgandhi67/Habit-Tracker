const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // audit only, not scoping
  name:     { type: String, required: true, trim: true },
  bodyPart: {
    type: String,
    required: true,
    enum: ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full_body'],
  },
  // Optional tutorial/demo link (YouTube etc.). Free-form; UI validates loosely.
  videoUrl: { type: String, trim: true, default: '' },
}, { timestamps: true });

// Global unique: one entry per (name, bodyPart) across all users
// Run once in Mongo shell to drop old per-user index: db.exercises.dropIndex("userId_1_name_1_bodyPart_1")
exerciseSchema.index({ name: 1, bodyPart: 1 }, { unique: true });

module.exports = mongoose.model('Exercise', exerciseSchema);
