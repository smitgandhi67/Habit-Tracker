const express = require('express');
const router = express.Router();
const Habit = require('../models/Habit');
const HabitLog = require('../models/HabitLog');
const { validateFrequency, sanitizeFrequency } = require('../utils/frequency');
const { isDomainKey } = require('../capabilities/domains');

// All routes require auth (applied in index.js)

// Keep only real, de-duplicated capability-domain keys (used by the Skills rollup).
function sanitizeDomainKeys(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter(k => typeof k === 'string' && isDomainKey(k)))];
}

// GET all habits for current user (archived hidden by default)
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.includeArchived !== 'true') {
      filter.archivedAt = null;
    }
    const habits = await Habit.find(filter).sort({ order: 1, createdAt: 1 });
    res.json(habits);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT reorder — body: { ids: ['id1','id2',...] }
router.put('/reorder', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
    await Promise.all(
      ids.map((id, index) =>
        Habit.findOneAndUpdate(
          { _id: id, userId: req.user._id, archivedAt: null },
          { order: index }
        )
      )
    );
    res.json({ message: 'Reordered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a habit
const ALLOWED_CREATE_FIELDS = ['name', 'emoji', 'frequency', 'config', 'order', 'domainKeys'];
router.post('/', async (req, res) => {
  try {
    const payload = { userId: req.user._id };
    for (const key of ALLOWED_CREATE_FIELDS) {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    }
    if (payload.domainKeys !== undefined) payload.domainKeys = sanitizeDomainKeys(payload.domainKeys);
    if (payload.frequency !== undefined) {
      const err = validateFrequency(payload.frequency);
      if (err) return res.status(400).json({ error: err });
      payload.frequency = sanitizeFrequency(payload.frequency);
    }
    const habit = new Habit(payload);
    await habit.save();
    res.status(201).json(habit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update a habit (only if owned by user; archivedAt managed via DELETE/unarchive only)
const ALLOWED_UPDATE_FIELDS = ['name', 'emoji', 'frequency', 'config', 'order', 'domainKeys'];
router.put('/:id', async (req, res) => {
  try {
    const update = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }
    if (update.domainKeys !== undefined) update.domainKeys = sanitizeDomainKeys(update.domainKeys);
    if (update.frequency !== undefined) {
      const err = validateFrequency(update.frequency);
      if (err) return res.status(400).json({ error: err });
      update.frequency = sanitizeFrequency(update.frequency);
    }

    // Lock biweekly anchor once logs exist — shifting it would re-bucket past
    // completions into the wrong period. UI also disables the field; this is the
    // server-side enforcement.
    if (update.frequency && typeof update.frequency === 'object' && update.frequency.type === 'biweekly') {
      const existing = await Habit.findOne({ _id: req.params.id, userId: req.user._id }).lean();
      if (existing && existing.frequency?.type === 'biweekly' && existing.frequency.anchor !== update.frequency.anchor) {
        const hasLogs = await HabitLog.exists({ habitId: req.params.id, userId: req.user._id });
        if (hasLogs) {
          return res.status(409).json({ error: 'Biweekly anchor cannot change once completion logs exist' });
        }
      }
    }

    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      update,
      { new: true, runValidators: true }
    );
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    res.json(habit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a habit — soft archive. Logs are preserved for audit/history.
router.delete('/:id', async (req, res) => {
  try {
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, archivedAt: null },
      { archivedAt: new Date() },
      { new: true }
    );
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    res.json({ message: 'Archived', habit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST unarchive — restore a soft-archived habit
router.post('/:id/unarchive', async (req, res) => {
  try {
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, archivedAt: { $ne: null } },
      { archivedAt: null },
      { new: true }
    );
    if (!habit) return res.status(404).json({ error: 'Archived habit not found' });
    res.json(habit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
