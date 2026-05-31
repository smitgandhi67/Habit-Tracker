const express  = require('express');
const router   = express.Router();
const MealPlan = require('../models/MealPlan');
const MealLog  = require('../models/MealLog');
const { isAdmin } = require('../utils/auth');

const ALLOWED_FIELDS = ['name', 'description', 'days', 'cycleLength', 'startDate'];

// Trim incoming body to whitelisted fields only.
function pickBody(body) {
  const out = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

// Decide whether this user may write to this plan.
//   master plans     → admin only
//   user-owned plans → owner only
function canWrite(plan, req) {
  if (plan.isMaster) return isAdmin(req);
  return plan.ownerUserId && plan.ownerUserId.toString() === req.user._id.toString();
}

// GET /api/meal-plans — master plans (visible to everyone) + caller's own plans.
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
    const plans = await MealPlan.find(filter).sort({ isMaster: -1, updatedAt: -1 }).lean();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meal-plans/:id — single plan; master is readable by all logged-in users.
router.get('/:id', async (req, res) => {
  try {
    const plan = await MealPlan.findById(req.params.id).lean();
    if (!plan) return res.status(404).json({ error: 'Plan not found' });
    const ownsIt = plan.ownerUserId && plan.ownerUserId.toString() === req.user._id.toString();
    if (!plan.isMaster && !ownsIt) return res.status(403).json({ error: 'Not authorised' });
    res.json(plan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/meal-plans — create. To create an isMaster plan, caller must be admin.
router.post('/', async (req, res) => {
  try {
    const wantMaster = !!req.body.isMaster;
    if (wantMaster && !isAdmin(req)) return res.status(403).json({ error: 'Only admin can create master plans' });

    const payload = pickBody(req.body);
    payload.isMaster    = wantMaster;
    payload.ownerUserId = wantMaster ? null : req.user._id;

    const plan = await MealPlan.create(payload);
    res.status(201).json(plan);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/meal-plans/:id/clone — copy a master (or any readable) plan into the
// caller's account. Returns the new owned plan. 409 if user already has a
// non-archived clone of this master.
router.post('/:id/clone', async (req, res) => {
  try {
    const source = await MealPlan.findById(req.params.id).lean();
    if (!source) return res.status(404).json({ error: 'Plan not found' });

    const ownsIt = source.ownerUserId && source.ownerUserId.toString() === req.user._id.toString();
    if (!source.isMaster && !ownsIt) return res.status(403).json({ error: 'Not authorised' });

    // De-dupe: prevent the user from accumulating identical clones of the same master.
    if (source.isMaster) {
      const existing = await MealPlan.findOne({
        ownerUserId:    req.user._id,
        sourceMasterId: source._id,
        archivedAt:     null,
      }).lean();
      if (existing) return res.status(409).json({ error: 'You already have an active copy of this plan', plan: existing });
    }

    // Strip mongo internals + identity fields before cloning.
    const days = (source.days || []).map(d => ({
      dayIndex:      d.dayIndex,
      label:         d.label,
      notes:         d.notes,
      meals:         (d.meals || []).map(m => ({
        slot:     m.slot,
        name:     m.name,
        foods:    m.foods,
        calories: m.calories,
        protein:  m.protein,
        micros:   m.micros,
        notes:    m.notes,
        order:    m.order,
      })),
      totalCalories: d.totalCalories,
      totalProtein:  d.totalProtein,
      flag:          d.flag,
    }));

    const today = new Date().toISOString().slice(0, 10);
    const clone = await MealPlan.create({
      ownerUserId:    req.user._id,
      isMaster:       false,
      name:           source.isMaster ? source.name : `${source.name} (copy)`,
      description:    source.description,
      cycleLength:    source.cycleLength,
      startDate:      today,
      sourceMasterId: source.isMaster ? source._id : (source.sourceMasterId || null),
      days,
    });
    res.status(201).json(clone);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/meal-plans/:id — update name / description / days / cycleLength / startDate.
// isMaster and ownerUserId are immutable post-create (no plan-type switching).
router.put('/:id', async (req, res) => {
  try {
    const plan = await MealPlan.findById(req.params.id);
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

// DELETE /api/meal-plans/:id — soft archive.
router.delete('/:id', async (req, res) => {
  try {
    const plan = await MealPlan.findById(req.params.id);
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

// POST /api/meal-plans/:id/unarchive — restore a soft-archived plan.
router.post('/:id/unarchive', async (req, res) => {
  try {
    const plan = await MealPlan.findById(req.params.id);
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
