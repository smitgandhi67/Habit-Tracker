const mongoose = require('mongoose');
const { normalizeExerciseName } = require('../utils/exerciseName');

const exerciseSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // audit only, not scoping
  name:     { type: String, required: true, trim: true },
  bodyPart: {
    type: String,
    required: true,
    enum: ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'full_body'],
  },
  // Normalized form of `name`: lowercased, trimmed, collapsed whitespace.
  // Used for global uniqueness, case- and whitespace-insensitive.
  nameKey:  { type: String, required: true, trim: true, lowercase: true },
  // Optional tutorial/demo link (YouTube etc.). Free-form; UI validates loosely.
  videoUrl: { type: String, trim: true, default: '' },
}, { timestamps: true });

// Mongoose 9 dropped callback-style middleware (`next` arg). Returning
// undefined (or a Promise) is the supported pattern.
exerciseSchema.pre('validate', function setNameKey() {
  if (this.name) this.nameKey = normalizeExerciseName(this.name);
});

// Global unique: one entry per normalized name across all users and body parts.
// MIGRATION (one-time): drop the old per-(name,bodyPart) index before this builds:
//   db.exercises.dropIndex("name_1_bodyPart_1")
// And backfill nameKey on existing rows:
//   db.exercises.find({ nameKey: { $exists: false } }).forEach(d => {
//     db.exercises.updateOne(
//       { _id: d._id },
//       { $set: { nameKey: d.name.trim().toLowerCase().replace(/\s+/g, ' ') } }
//     );
//   });
exerciseSchema.index({ nameKey: 1 }, { unique: true });

module.exports = mongoose.model('Exercise', exerciseSchema);
