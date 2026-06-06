const express = require('express');
const router  = express.Router();
const WorkoutPlan = require('../models/WorkoutPlan');
const Exercise = require('../models/Exercise');
const { isAdmin } = require('../utils/auth');
const { normalizeExerciseName } = require('../utils/exerciseName');
const { canonicalizeExercise } = require('../utils/canonicalExercise');

const ALLOWED_FIELDS = ['name', 'description', 'days'];

// Trim incoming body to whitelisted fields only.
function pickBody(body) {
  const out = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

// Canonical-name guard: snap every plan exercise to the catalog so plan names
// share one key with logs and progress. Mutates and returns `days` in place.
async function canonicalizeDays(days) {
  if (!Array.isArray(days)) return days;
  const exs = await Exercise.find({}).select('name bodyPart nameKey');
  const byKey = new Map(exs.map(e => [e.nameKey, { name: e.name, bodyPart: e.bodyPart }]));
  for (const day of days) {
    for (const ex of day?.exercises || []) {
      if (!ex || !ex.exerciseName) continue;
      const match = byKey.get(normalizeExerciseName(ex.exerciseName));
      const c = canonicalizeExercise({ name: ex.exerciseName, bodyPart: ex.bodyPart }, match);
      ex.exerciseName = c.name;
      ex.bodyPart     = c.bodyPart;
    }
  }
  return days;
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
    if (payload.days !== undefined) payload.days = await canonicalizeDays(payload.days);

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
    if (update.days !== undefined) update.days = await canonicalizeDays(update.days);
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
