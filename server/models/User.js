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
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
