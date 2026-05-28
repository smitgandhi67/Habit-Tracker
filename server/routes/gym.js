const express   = require('express');
const router    = express.Router();
const GymEntry  = require('../models/GymEntry');
const Exercise  = require('../models/Exercise');
const { requireAdmin } = require('../utils/auth');
const { normalizeExerciseName } = require('../utils/exerciseName');

const BODY_PART_LABEL = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms',
  legs: 'Legs', core: 'Core', cardio: 'Cardio', full_body: 'Full Body',
};

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
      { userId: req.user._id, date: { $in: dates } }
    ).select('date bodyPart exerciseName planDayLabel');
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
    const { date, bodyPart, exerciseName, feel, sets, planDayLabel, safetyChecks } = req.body;
    const entry = new GymEntry({
      userId: req.user._id,
      date, bodyPart, exerciseName, feel, sets,
      planDayLabel: planDayLabel || '',
      safetyChecks: safetyChecks || {},
    });
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

    const { bodyPart, exerciseName, feel, sets, planDayLabel, safetyChecks } = req.body;
    if (bodyPart)     entry.bodyPart     = bodyPart;
    if (exerciseName) entry.exerciseName = exerciseName;
    if (feel)         entry.feel         = feel;
    if (sets)         entry.sets         = sets;
    if (planDayLabel !== undefined) entry.planDayLabel = planDayLabel;
    if (safetyChecks !== undefined) entry.safetyChecks = safetyChecks;

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

// GET /api/gym/exercises-list?bodyPart=  (optional filter) — shared across all users
router.get('/exercises-list', async (req, res) => {
  try {
    const filter = {};
    if (req.query.bodyPart) filter.bodyPart = req.query.bodyPart;
    const list = await Exercise.find(filter).sort({ name: 1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function validVideoUrl(v) {
  if (v === undefined || v === null || v === '') return true;
  return typeof v === 'string' && /^https?:\/\/\S+/i.test(v.trim());
}

// POST /api/gym/exercises-list — anyone can add; userId stored for audit
router.post('/exercises-list', async (req, res) => {
  try {
    const { name, bodyPart, videoUrl } = req.body;
    if (!name || !bodyPart) return res.status(400).json({ error: 'name and bodyPart required' });
    if (!validVideoUrl(videoUrl)) return res.status(400).json({ error: 'videoUrl must be a valid http(s) URL' });

    const trimmedName = name.trim();
    const nameKey = normalizeExerciseName(trimmedName);
    const existing = await Exercise.findOne({ nameKey });
    if (existing) {
      const where = BODY_PART_LABEL[existing.bodyPart] || existing.bodyPart;
      return res.status(409).json({ error: `Exercise '${existing.name}' already exists in ${where}` });
    }

    const ex = await Exercise.create({
      userId: req.user._id,
      name: trimmedName,
      bodyPart,
      videoUrl: (videoUrl || '').trim(),
    });
    res.status(201).json(ex);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Exercise already exists' });
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/gym/exercises-list/:id — update videoUrl (and only videoUrl).
// Anyone can update since exercise list is shared. Name/bodyPart immutable here.
router.put('/exercises-list/:id', async (req, res) => {
  try {
    const { videoUrl } = req.body;
    if (!validVideoUrl(videoUrl)) return res.status(400).json({ error: 'videoUrl must be a valid http(s) URL' });
    const ex = await Exercise.findByIdAndUpdate(
      req.params.id,
      { videoUrl: (videoUrl || '').trim() },
      { new: true, runValidators: true }
    );
    if (!ex) return res.status(404).json({ error: 'Not found' });
    res.json(ex);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/gym/exercises-list/:id — admin only
router.delete('/exercises-list/:id', requireAdmin, async (req, res) => {
  try {
    const ex = await Exercise.findByIdAndDelete(req.params.id);
    if (!ex) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gym/progress?weeks=12
router.get('/progress', async (req, res) => {
  try {
    const weeks = Math.min(parseInt(req.query.weeks) || 12, 52);

    // Build Monday-aligned week start dates for the last N weeks
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const daysToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + daysToMon);
    thisMonday.setHours(0, 0, 0, 0);

    const weekStarts = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(thisMonday);
      d.setDate(d.getDate() - i * 7);
      weekStarts.push(d.toISOString().slice(0, 10));
    }

    // Date range: first Monday → end of current week
    const rangeEnd = new Date(thisMonday);
    rangeEnd.setDate(rangeEnd.getDate() + 6);
    const rangeStart = weekStarts[0];
    const rangeEndStr = rangeEnd.toISOString().slice(0, 10);

    const entries = await GymEntry.find({
      userId: req.user._id,
      date: { $gte: rangeStart, $lte: rangeEndStr },
    }).lean();

    if (entries.length === 0) return res.json([]);

    // Map a YYYY-MM-DD date to its Monday week-start
    function toWeekStart(dateStr) {
      const d = new Date(dateStr);
      const dow = d.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0, 10);
    }

    // Aggregate: exerciseName → bodyPart + per-week stats
    const map = {};
    for (const entry of entries) {
      if (!map[entry.exerciseName]) {
        map[entry.exerciseName] = { bodyPart: entry.bodyPart, weeks: {} };
      }
      const ws = toWeekStart(entry.date);
      if (!map[entry.exerciseName].weeks[ws]) {
        map[entry.exerciseName].weeks[ws] = { maxWeight: 0, totalVolume: 0, sessions: 0 };
      }
      const w = map[entry.exerciseName].weeks[ws];
      w.sessions++;
      w.maxWeight = Math.max(w.maxWeight, entry.prWeight || 0);
      const vol = entry.sets.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0);
      w.totalVolume += vol;
    }

    // Build result with zero-filled weeks
    const result = Object.entries(map).map(([exerciseName, data]) => ({
      exerciseName,
      bodyPart: data.bodyPart,
      weeks: weekStarts.map(ws => ({
        weekStart: ws,
        maxWeight: data.weeks[ws]?.maxWeight || 0,
        totalVolume: data.weeks[ws]?.totalVolume || 0,
        sessions: data.weeks[ws]?.sessions || 0,
      })),
    }));

    // Sort by most recently active week
    result.sort((a, b) => {
      const lastActive = arr => [...arr].reverse().find(w => w.sessions > 0)?.weekStart || '';
      return lastActive(b.weeks).localeCompare(lastActive(a.weeks));
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
