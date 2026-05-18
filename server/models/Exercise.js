const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name:     { type: String, required: true, trim: true },
  bodyPart: {
    type: String,
    required: true,
    enum: ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full_body'],
  },
}, { timestamps: true });

exerciseSchema.index({ userId: 1, bodyPart: 1 });
exerciseSchema.index({ userId: 1, name: 1, bodyPart: 1 }, { unique: true });

module.exports = mongoose.model('Exercise', exerciseSchema);
