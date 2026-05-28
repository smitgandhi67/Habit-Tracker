const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');
const { ADMIN_EMAIL } = require('../utils/auth');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.COOKIE_SAME_SITE === 'none' || process.env.NODE_ENV === 'production',
  sameSite: process.env.COOKIE_SAME_SITE || 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// POST /api/auth/verify  — receives Google credential token from frontend
router.post('/verify', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'credential required' });

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { sub: googleId, email, name, picture } = ticket.getPayload();

    const user = await User.findOneAndUpdate(
      { googleId },
      { email, name, photo: picture },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const token = jwt.sign(
      { _id: user._id, email: user.email, name: user.name, photo: user.photo, createdAt: user.createdAt },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, COOKIE_OPTS).json({
      _id: user._id,
      email: user.email,
      name: user.name,
      photo: user.photo,
      timezone: user.timezone || 'America/New_York',
      weightUnit: user.weightUnit || 'lb',
      isAdmin: user.email === ADMIN_EMAIL,
      createdAt: user.createdAt,
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

// GET /api/auth/me — returns current user (fresh DB doc so timezone is current)
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      _id: user._id,
      email: user.email,
      name: user.name,
      photo: user.photo,
      timezone: user.timezone || 'America/New_York',
      weightUnit: user.weightUnit || 'lb',
      isAdmin: user.email === ADMIN_EMAIL,
      createdAt: user.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// IANA timezone format check — keep loose; rely on Intl runtime for full validation.
const IANA_TZ = /^[A-Za-z_+\-]+(?:\/[A-Za-z0-9_+\-]+){0,3}$/;
function isValidIanaTz(tz) {
  if (typeof tz !== 'string' || !IANA_TZ.test(tz)) return false;
  try {
    // Intl will throw on a fully unknown zone.
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// PUT /api/auth/timezone — body: { timezone: 'America/New_York' }
router.put('/timezone', requireAuth, async (req, res) => {
  try {
    const { timezone } = req.body || {};
    if (!isValidIanaTz(timezone)) {
      return res.status(400).json({ error: 'Invalid IANA timezone' });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { timezone },
      { new: true }
    ).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ timezone: user.timezone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/weight-unit — body: { weightUnit: 'kg' | 'lb' }
router.put('/weight-unit', requireAuth, async (req, res) => {
  try {
    const { weightUnit } = req.body || {};
    if (weightUnit !== 'kg' && weightUnit !== 'lb') {
      return res.status(400).json({ error: "weightUnit must be 'kg' or 'lb'" });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { weightUnit },
      { new: true }
    ).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ weightUnit: user.weightUnit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' }).json({ message: 'Logged out' });
});

module.exports = router;
