const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const requireAuth = require('../middleware/auth');

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
      { _id: user._id, email: user.email, name: user.name, photo: user.photo },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, COOKIE_OPTS).json({
      _id: user._id,
      email: user.email,
      name: user.name,
      photo: user.photo,
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

// GET /api/auth/me — returns current user from JWT cookie
router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' }).json({ message: 'Logged out' });
});

module.exports = router;
