const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AccountLink = require('../models/AccountLink');
const requireAuth = require('../middleware/auth');
const { ADMIN_EMAIL } = require('../utils/auth');
const { ageFromBirthdate } = require('../utils/age');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Derived family role for the client: `isParent` (has ≥1 approved link where I'm the
// parent — drives the parent-console nav) and `pendingIncoming` (link requests awaiting
// my approval — drives the Family badge). Roleless accounts: an adult with no kids is
// just isParent:false.
async function familyFlags(userId) {
  const [isParent, pendingIncoming] = await Promise.all([
    AccountLink.exists({ parentId: userId, status: 'approved' }),
    AccountLink.countDocuments({ childId: userId, status: 'pending' }),
  ]);
  return { isParent: !!isParent, pendingIncoming };
}

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

    const flags = await familyFlags(user._id);
    res.cookie('token', token, COOKIE_OPTS).json({
      _id: user._id,
      email: user.email,
      name: user.name,
      photo: user.photo,
      timezone: user.timezone || 'America/New_York',
      weightUnit: user.weightUnit || 'lb',
      lengthUnit: user.lengthUnit || 'in',
      grade: user.grade ?? null,
      birthdate: user.birthdate || null,
      age: ageFromBirthdate(user.birthdate),
      isAdmin: user.email === ADMIN_EMAIL,
      ...flags,
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
    const flags = await familyFlags(user._id);
    res.json({
      _id: user._id,
      email: user.email,
      name: user.name,
      photo: user.photo,
      timezone: user.timezone || 'America/New_York',
      weightUnit: user.weightUnit || 'lb',
      lengthUnit: user.lengthUnit || 'in',
      grade: user.grade ?? null,
      birthdate: user.birthdate || null,
      age: ageFromBirthdate(user.birthdate),
      isAdmin: user.email === ADMIN_EMAIL,
      ...flags,
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

// PUT /api/auth/length-unit — body: { lengthUnit: 'cm' | 'in' }
router.put('/length-unit', requireAuth, async (req, res) => {
  try {
    const { lengthUnit } = req.body || {};
    if (lengthUnit !== 'cm' && lengthUnit !== 'in') {
      return res.status(400).json({ error: "lengthUnit must be 'cm' or 'in'" });
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { lengthUnit },
      { new: true }
    ).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ lengthUnit: user.lengthUnit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/birthdate — body: { birthdate: 'YYYY-MM-DD' | null }. null clears it.
router.put('/birthdate', requireAuth, async (req, res) => {
  try {
    const { birthdate } = req.body || {};
    let value = null;
    if (birthdate != null) {
      const d = new Date(birthdate);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ error: 'Invalid birthdate' });
      }
      const now = new Date();
      // Reject the future and implausibly old (>25y) dates — this is a kid profile.
      const oldest = new Date(now.getFullYear() - 25, now.getMonth(), now.getDate());
      if (d > now || d < oldest) {
        return res.status(400).json({ error: 'birthdate out of range' });
      }
      value = d;
    }
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { birthdate: value },
      { new: true }
    ).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ birthdate: user.birthdate || null, age: ageFromBirthdate(user.birthdate) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' }).json({ message: 'Logged out' });
});

module.exports = router;
