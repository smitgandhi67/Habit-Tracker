const express = require('express');
const router = express.Router();
const HabitLog = require('../models/HabitLog');

// GET logs for multiple dates  ?dates=2024-01-01,2024-01-02,...
router.get('/batch', async (req, res) => {
  try {
    const { dates } = req.query;
    if (!dates) return res.status(400).json({ error: 'dates query param required' });
    const dateList = dates.split(',').slice(0, 60); // max 60 days
    const logs = await HabitLog.find({ userId: req.user._id, date: { $in: dateList } });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET logs for a specific date  ?date=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required' });
    const logs = await HabitLog.find({ userId: req.user._id, date });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET logs for a habit over last N days  ?habitId=...&days=21
router.get('/history', async (req, res) => {
  try {
    const { habitId, days = 21 } = req.query;
    if (!habitId) return res.status(400).json({ error: 'habitId required' });

    const dates = [];
    for (let i = 0; i < Number(days); i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const logs = await HabitLog.find({ userId: req.user._id, habitId, date: { $in: dates } });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT upsert a log entry — body: { date, status?, value? }
router.put('/:habitId', async (req, res) => {
  try {
    const { date, status, value } = req.body;
    if (!date) return res.status(400).json({ error: 'date required' });
    if (!status && value === undefined) return res.status(400).json({ error: 'status or value required' });

    const update = {};
    if (status !== undefined) update.status = status;
    if (value  !== undefined) update.value  = value;

    const log = await HabitLog.findOneAndUpdate(
      { userId: req.user._id, habitId: req.params.habitId, date },
      update,
      { upsert: true, new: true, runValidators: true }
    );
    res.json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
