const express = require('express');
const router  = express.Router();
const WorkoutPlan = require('../models/WorkoutPlan');
const { isAdmin } = require('../utils/auth');

const ALLOWED_FIELDS = ['name', 'description', 'days'];

// Trim incoming body to whitelisted fields only.
function pickBody(body) {
  const out = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

// Decide whether this user may write to this plan.
//   master plans       → admin only
//   user-owned plans   → owner only
function canWrite(plan, req) {
  if (plan.isMaster) return isAdmin(req);
  return plan.ownerUserId && plan.ownerUserId.toString() === req.user._id.toString();
}

// GET /api/plans — master plans (visible to everyone) + caller's own plans.
// Archived plans hidden unless ?includeArchived=true.
router.get('/', async (req, res) => {
  try {
    const filter = {
      $or: [
        { isMaster: true },
        { ownerUserId: req.user._id },
      ],
    };
    if (req.query.includeArchived !== 'true') filter.archivedAt = null;
    const plans = await WorkoutPlan.find(filter).sort({ isMaster: -1, updatedAt: -1 }).lean();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/plans/:id — single plan; master is public to all logged-in users.
router.get('/:id', async (req, res) => {
  try {
    const plan = await WorkoutPlan.findById(req.params.id).lean();
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    const ownsIt = plan.ownerUserId && plan.ownerUserId.toString() === req.user._id.toString();
    if (!plan.isMaster && !ownsIt) return res.status(403).json({ error: 'Not authorised' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/plans — create. To create an isMaster plan, caller must be admin.
router.post('/', async (req, res) => {
  try {
    const wantMaster = !!req.body.isMaster;
    if (wantMaster && !isAdmin(req)) return res.status(403).json({ error: 'Only admin can create master plans' });

    const payload = pickBody(req.body);
    payload.isMaster    = wantMaster;
    payload.ownerUserId = wantMaster ? null : req.user._id;

    const plan = await WorkoutPlan.create(payload);
    res.status(201).json(plan);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/plans/:id — update name / description / days.
// isMaster and ownerUserId are immutable post-create (no plan-type switching).
router.put('/:id', async (req, res) => {
  try {
    const plan = await WorkoutPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (!canWrite(plan, req)) return res.status(403).json({ error: 'Not authorised' });
    if (plan.archivedAt) return res.status(409).json({ error: 'Cannot edit archived plan — unarchive first' });

    const update = pickBody(req.body);
    Object.assign(plan, update);
    await plan.save();
    res.json(plan);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/plans/:id — soft archive.
router.delete('/:id', async (req, res) => {
  try {
    const plan = await WorkoutPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (!canWrite(plan, req)) return res.status(403).json({ error: 'Not authorised' });
    if (plan.archivedAt)      return res.status(409).json({ error: 'Plan already archived' });

    plan.archivedAt = new Date();
    await plan.save();
    res.json({ message: 'Archived', plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/plans/:id/unarchive — restore a soft-archived plan.
router.post('/:id/unarchive', async (req, res) => {
  try {
    const plan = await WorkoutPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    if (!canWrite(plan, req)) return res.status(403).json({ error: 'Not authorised' });
    if (!plan.archivedAt)     return res.status(409).json({ error: 'Plan is not archived' });

    plan.archivedAt = null;
    await plan.save();
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
