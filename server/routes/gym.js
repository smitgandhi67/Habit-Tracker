const express   = require('express');
const router    = express.Router();
const GymEntry  = require('../models/GymEntry');
const Exercise  = require('../models/Exercise');

// All routes protected by requireAuth (applied in index.js)

// ─── helpers ────────────────────────────────────────────────────────────────

function maxWeight(sets) {
  return Math.max(0, ...sets.map(s => s.weight || 0));
}

async function checkAndMarkPR(entry, userId) {
  const entryMax = maxWeight(entry.sets);
  // Find best weight ever for this exercise (excluding current entry if update)
  const best = await GymEntry.findOne(
    { userId, exerciseName: entry.exerciseName, _id: { $ne: entry._id } },
    { prWeight: 1 }
  ).sort({ prWeight: -1 });

  const historicalBest = best?.prWeight || 0;
  entry.prWeight        = entryMax;
  entry.isPersonalRecord = entryMax > 0 && entryMax >= historicalBest;
  return entry;
}

// ─── routes ─────────────────────────────────────────────────────────────────

// GET /api/gym/entries?date=YYYY-MM-DD
router.get('/entries', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date required' });
    const entries = await GymEntry.find({ userId: req.user._id, date }).sort({ createdAt: 1 });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gym/week?weekStart=YYYY-MM-DD  — returns all entries for a 7-day window
router.get('/week', async (req, res) => {
  try {
    const { weekStart } = req.query;
    if (!weekStart) return res.status(400).json({ error: 'weekStart required' });

    const dates = [];
    const start = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const entries = await GymEntry.find(
      { userId: req.user._id, date: { $in: dates } },
      { date: 1, bodyPart: 1 }
    );
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gym/exercise/:name/history  — last session + all-time PR
router.get('/exercise/:name/history', async (req, res) => {
  try {
    const exerciseName = decodeURIComponent(req.params.name);

    // Last session entry
    const last = await GymEntry.findOne(
      { userId: req.user._id, exerciseName },
    ).sort({ date: -1, createdAt: -1 });

    // All-time PR entry
    const pr = await GymEntry.findOne(
      { userId: req.user._id, exerciseName, isPersonalRecord: true },
    ).sort({ prWeight: -1 });

    res.json({ last: last || null, pr: pr || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gym/exercises  — list distinct exercise names for autocomplete
router.get('/exercises', async (req, res) => {
  try {
    const names = await GymEntry.distinct('exerciseName', { userId: req.user._id });
    res.json(names.sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gym/entries
router.post('/entries', async (req, res) => {
  try {
    const { date, bodyPart, exerciseName, feel, sets } = req.body;
    const entry = new GymEntry({ userId: req.user._id, date, bodyPart, exerciseName, feel, sets });
    await checkAndMarkPR(entry, req.user._id);
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/gym/entries/:id
router.put('/entries/:id', async (req, res) => {
  try {
    const entry = await GymEntry.findOne({ _id: req.params.id, userId: req.user._id });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    const { bodyPart, exerciseName, feel, sets } = req.body;
    if (bodyPart)     entry.bodyPart     = bodyPart;
    if (exerciseName) entry.exerciseName = exerciseName;
    if (feel)         entry.feel         = feel;
    if (sets)         entry.sets         = sets;

    await checkAndMarkPR(entry, req.user._id);
    await entry.save();
    res.json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/gym/entries/:id
router.delete('/entries/:id', async (req, res) => {
  try {
    const entry = await GymEntry.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── exercise templates ──────────────────────────────────────────────────────

// GET /api/gym/exercises-list?bodyPart=  (optional filter)
router.get('/exercises-list', async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.bodyPart) filter.bodyPart = req.query.bodyPart;
    const list = await Exercise.find(filter).sort({ name: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gym/exercises-list
router.post('/exercises-list', async (req, res) => {
  try {
    const { name, bodyPart } = req.body;
    if (!name || !bodyPart) return res.status(400).json({ error: 'name and bodyPart required' });
    const ex = await Exercise.create({ userId: req.user._id, name: name.trim(), bodyPart });
    res.status(201).json(ex);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Exercise already exists for this body part' });
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/gym/exercises-list/:id
router.delete('/exercises-list/:id', async (req, res) => {
  try {
    const ex = await Exercise.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!ex) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
