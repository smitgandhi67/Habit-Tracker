const express = require('express');
const router = express.Router();
const Habit = require('../models/Habit');
const HabitLog = require('../models/HabitLog');

// All routes require auth (applied in index.js)

// GET all habits for current user
router.get('/', async (req, res) => {
  try {
    const habits = await Habit.find({ userId: req.user._id }).sort({ order: 1, createdAt: 1 });
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
        Habit.findOneAndUpdate({ _id: id, userId: req.user._id }, { order: index })
      )
    );
    res.json({ message: 'Reordered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a habit
router.post('/', async (req, res) => {
  try {
    const habit = new Habit({ ...req.body, userId: req.user._id });
    await habit.save();
    res.status(201).json(habit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT update a habit (only if owned by user)
router.put('/:id', async (req, res) => {
  try {
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    res.json(habit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE a habit and its logs (only if owned by user)
router.delete('/:id', async (req, res) => {
  try {
    const habit = await Habit.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!habit) return res.status(404).json({ error: 'Habit not found' });
    await HabitLog.deleteMany({ habitId: req.params.id, userId: req.user._id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
