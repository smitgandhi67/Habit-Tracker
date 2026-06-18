const express = require('express');
const router = express.Router();
const HabitLog = require('../models/HabitLog');
const { syncHabitAward } = require('../utils/habitAwards');

// GET logs for multiple dates  ?dates=2024-01-01,2024-01-02,...
router.get('/batch', async (req, res) => {
  try {
    const { dates } = req.query;
    if (!dates) return res.status(400).json({ error: 'dates query param required' });
    const dateList = dates.split(',').slice(0, 200); // max 200 days (monthly habits need ~6mo lookback)
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

    // Sync the habit-points award off the new completion state. Best-effort: the log
    // save is the source of truth and the award is re-derivable, so a failure here must
    // not fail the request. Only relevant when status was part of this update.
    if (update.status !== undefined) {
      try {
        await syncHabitAward({
          userId: req.user._id,
          habitId: req.params.habitId,
          date,
          status: log.status,
        });
      } catch (awardErr) {
        console.error('syncHabitAward failed:', awardErr.message);
      }
    }

    res.json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
