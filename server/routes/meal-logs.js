const express  = require('express');
const router   = express.Router();
const MealLog  = require('../models/MealLog');
const MealPlan = require('../models/MealPlan');

// Verify the caller can log against this plan: must own it (master plans are
// read-only — clone first, then log against the clone).
async function assertOwnedPlan(planId, userId) {
  const plan = await MealPlan.findById(planId).select('ownerUserId isMaster archivedAt').lean();
  if (!plan) {
    const err = new Error('Plan not found');
    err.status = 404;
    throw err;
  }
  if (plan.isMaster) {
    const err = new Error('Cannot log against a master plan — clone it first');
    err.status = 400;
    throw err;
  }
  if (!plan.ownerUserId || plan.ownerUserId.toString() !== userId.toString()) {
    const err = new Error('Not authorised');
    err.status = 403;
    throw err;
  }
  if (plan.archivedAt) {
    const err = new Error('Plan is archived');
    err.status = 409;
    throw err;
  }
  return plan;
}

// GET /api/meal-logs/batch?planId=...&dates=YYYY-MM-DD,YYYY-MM-DD,...
// Returns logs for the caller across the requested dates for one plan.
router.get('/batch', async (req, res) => {
  try {
    const { planId, dates } = req.query;
    if (!planId) return res.status(400).json({ error: 'planId required' });
    if (!dates)  return res.status(400).json({ error: 'dates query param required' });
    const dateList = dates.split(',').slice(0, 60); // hard cap (full plan cycle + buffer)
    const logs = await MealLog.find({ userId: req.user._id, planId, date: { $in: dateList } });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/meal-logs?planId=...&date=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { planId, date } = req.query;
    if (!planId) return res.status(400).json({ error: 'planId required' });
    if (!date)   return res.status(400).json({ error: 'date query param required' });
    const logs = await MealLog.find({ userId: req.user._id, planId, date });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/meal-logs — upsert a single (planId, date, slot) entry.
// Body: { planId, date, slot, status?, swapNote? }
router.put('/', async (req, res) => {
  try {
    const { planId, date, slot, status, swapNote } = req.body;
    if (!planId || !date || !slot) {
      return res.status(400).json({ error: 'planId, date, and slot are required' });
    }
    if (!status && swapNote === undefined) {
      return res.status(400).json({ error: 'status or swapNote required' });
    }

    await assertOwnedPlan(planId, req.user._id);

    const update = {};
    if (status   !== undefined) update.status   = status;
    if (swapNote !== undefined) update.swapNote = swapNote;

    const log = await MealLog.findOneAndUpdate(
      { userId: req.user._id, planId, date, slot },
      update,
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    res.json(log);
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

module.exports = router;
