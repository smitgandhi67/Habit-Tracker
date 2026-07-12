const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const AccountLink = require('../models/AccountLink');
const User = require('../models/User');

// Escape a user-supplied string for use inside a RegExp (email lookup is case-insensitive).
function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Shape a link + its counterpart account for the client. `perspective` says who the
// signed-in user is in this row so the UI knows which side to show.
function present(link, counterpart, perspective) {
  return {
    _id: link._id,
    status: link.status,
    perspective, // 'parent' (I'm the parent) | 'child' (I'm the child)
    createdAt: link.createdAt,
    respondedAt: link.respondedAt || null,
    account: counterpart
      ? { _id: counterpart._id, name: counterpart.name, email: counterpart.email, photo: counterpart.photo || null }
      : null,
  };
}

// Rate-limit link requests: a parent probing many emails is the main abuse vector.
// Keyed by the authenticated user (this router always sits behind requireAuth, so
// req.user._id is always present — no IP fallback needed). In-memory store — a soft
// guard, fine for a low-traffic family app on Lambda.
const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: { error: 'Too many link requests. Try again later.' },
});

// POST /api/links — body { childEmail }. The signed-in user (parent) requests to link a
// child by their registered email. Creates or re-opens a pending link the child approves.
router.post('/', requestLimiter, async (req, res, next) => {
  try {
    const childEmail = String(req.body?.childEmail || '').trim();
    if (!childEmail) return res.status(400).json({ error: 'childEmail required' });

    const child = await User.findOne({ email: new RegExp(`^${escapeRegex(childEmail)}$`, 'i') })
      .select('_id name email photo').lean();
    if (!child) {
      return res.status(404).json({ error: 'No account for that email — ask them to sign up first.' });
    }
    if (String(child._id) === String(req.user._id)) {
      return res.status(400).json({ error: "You can't link your own account as a child." });
    }

    const existing = await AccountLink.findOne({ parentId: req.user._id, childId: child._id });
    if (existing) {
      if (existing.status === 'approved') return res.status(200).json({ ...present(existing, child, 'parent'), already: 'approved' });
      if (existing.status === 'pending')  return res.status(200).json({ ...present(existing, child, 'parent'), already: 'pending' });
      // rejected / revoked → re-open as a fresh pending request.
      existing.status = 'pending';
      existing.initiatedBy = req.user._id;
      existing.respondedAt = null;
      await existing.save();
      return res.status(200).json(present(existing, child, 'parent'));
    }

    const link = await AccountLink.create({
      parentId: req.user._id, childId: child._id, initiatedBy: req.user._id, status: 'pending',
    });
    res.status(201).json(present(link, child, 'parent'));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'A link for this pair already exists.' });
    next(err);
  }
});

// GET /api/links?direction=incoming|outgoing[&status=]
//   outgoing (default): links where I'm the parent → my children (any status).
//   incoming: links where I'm the child → requests to approve + my linked parents.
router.get('/', async (req, res, next) => {
  try {
    const direction = req.query.direction === 'incoming' ? 'incoming' : 'outgoing';
    const me = req.user._id;
    const filter = direction === 'incoming' ? { childId: me } : { parentId: me };
    if (['pending', 'approved', 'rejected', 'revoked'].includes(req.query.status)) filter.status = req.query.status;

    const links = await AccountLink.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    const counterpartIds = links.map(l => (direction === 'incoming' ? l.parentId : l.childId));
    const users = await User.find({ _id: { $in: counterpartIds } }).select('_id name email photo').lean();
    const byId = new Map(users.map(u => [String(u._id), u]));

    const perspective = direction === 'incoming' ? 'child' : 'parent';
    res.json(links.map(l => present(l, byId.get(String(direction === 'incoming' ? l.parentId : l.childId)), perspective)));
  } catch (err) { next(err); }
});

// POST /api/links/:id/approve — the CHILD approves a pending request. Only the child on
// the link may approve, and only from 'pending'.
router.post('/:id/approve', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'valid link id required' });
    const link = await AccountLink.findOneAndUpdate(
      { _id: req.params.id, childId: req.user._id, status: 'pending' },
      { $set: { status: 'approved', respondedAt: new Date() } },
      { new: true },
    );
    if (!link) return res.status(404).json({ error: 'No pending request to approve' });
    const parent = await User.findById(link.parentId).select('_id name email photo').lean();
    res.json(present(link, parent, 'child'));
  } catch (err) { next(err); }
});

// POST /api/links/:id/reject — the CHILD declines a pending request.
router.post('/:id/reject', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'valid link id required' });
    const link = await AccountLink.findOneAndUpdate(
      { _id: req.params.id, childId: req.user._id, status: 'pending' },
      { $set: { status: 'rejected', respondedAt: new Date() } },
      { new: true },
    );
    if (!link) return res.status(404).json({ error: 'No pending request to reject' });
    res.json(present(link, null, 'child'));
  } catch (err) { next(err); }
});

// DELETE /api/links/:id — either side unlinks (approved or pending) → 'revoked'. The
// parent immediately loses access; the child's data is untouched.
router.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'valid link id required' });
    const me = String(req.user._id);
    const link = await AccountLink.findById(req.params.id);
    if (!link) return res.status(404).json({ error: 'Link not found' });
    if (String(link.parentId) !== me && String(link.childId) !== me) {
      return res.status(403).json({ error: 'Not your link' });
    }
    link.status = 'revoked';
    link.respondedAt = new Date();
    await link.save();
    res.json({ ok: true, _id: link._id, status: link.status });
  } catch (err) { next(err); }
});

module.exports = router;
