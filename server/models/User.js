const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, required: true, unique: true },
  email:    { type: String, required: true },
  name:     { type: String, required: true },
  photo:    { type: String },
  // IANA timezone (e.g. 'America/New_York'). Used to interpret habit log dates
  // and bucket them into the user's local calendar/ISO weeks regardless of which
  // device or location they're using when they open the app.
  timezone: { type: String, default: 'America/New_York' },
  // Display unit for gym weights. Values are stored unitless; this
  // controls only the label shown in the UI.
  weightUnit: { type: String, enum: ['kg', 'lb'], default: 'lb' },
  // Display unit for body circumference measurements (chest/waist/etc).
  // Like weightUnit, values are stored unitless; this is only a UI label.
  lengthUnit: { type: String, enum: ['cm', 'in'], default: 'in' },
  // School grade (2-5), set by the kid. Drives the math-practice difficulty caps
  // (multiplication and addition/subtraction ranges). null = no cap (full range).
  grade: { type: Number, enum: [2, 3, 4, 5], default: null },
  // Date of birth (optional). Used by the Capabilities module to derive age for
  // age-fit on activities and age-appropriate baseline framing. null = unknown.
  birthdate: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
