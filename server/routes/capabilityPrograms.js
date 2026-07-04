const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const { listPacks, getPack, kidWritableMetricKeys } = require('../capabilities/packs');
const { DOMAINS } = require('../capabilities/domains');
const TrainingProgram = require('../models/TrainingProgram');
const WeeklyMeasure = require('../models/WeeklyMeasure');
const Habit = require('../models/Habit');
const { authorizeChild } = require('./capabilities');
const { isAdmin, requireAdmin } = require('../utils/auth');

const DOMAIN_KEYS = new Set(DOMAINS.map(d => d.key));

// Public (non-day-content) view of a pack for pickers and headers.
function packSummary(p) {
  return {
    key: p.key, title: p.title, domainKeys: p.domainKeys,
    habitDefaults: p.habitDefaults, metrics: p.metrics, ladder: p.ladder,
    weekThemes: p.weeks.map(w => ({ week: w.week, theme: w.theme })),
  };
}

function serializeProgram(prog, pack, habit) {
  const week = pack.weeks.find(w => w.week === prog.currentWeek) || null;
  return {
    _id: prog._id,
    userId: prog.userId,
    packKey: prog.packKey,
    status: prog.status,
    currentWeek: prog.currentWeek,
    totalWeeks: pack.weeks.length,
    startedAt: prog.startedAt,
    completedAt: prog.completedAt,
    pack: packSummary(pack),
    week,                                   // full day cards for the current week
    habitId: prog.habitId,
    habit: habit ? { _id: habit._id, name: habit.name, emoji: habit.emoji, points: habit.points || 0, archivedAt: habit.archivedAt } : null,
    habitMissing: !habit,
  };
}

// GET /api/capabilities/programs/packs — the enrollable pack registry.
router.get('/packs', (_req, res) => {
  res.json({ packs: listPacks().map(packSummary) });
});

// POST /api/capabilities/programs — enroll a child in a pack (parent/admin only).
// Body: { childId, packKey, points? }. Creates the domain-tagged daily habit and
// the program pointing at it.
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { childId, packKey } = req.body || {};
    const pack = getPack(packKey);
    if (!pack) return res.status(400).json({ error: 'unknown packKey' });
    if (!mongoose.Types.ObjectId.isValid(childId)) return res.status(400).json({ error: 'valid childId required' });

    const points = Number(req.body.points);
    const habitPoints = Number.isFinite(points) && points >= 0 ? Math.floor(points) : 0;

    const existing = await TrainingProgram.findOne({ userId: childId, packKey, status: { $in: ['active', 'paused'] } }).lean();
    if (existing) return res.status(409).json({ error: 'This pack is already running for this child' });

    const habits = await Habit.find({ userId: childId }).select('order').lean();
    const maxOrder = habits.reduce((m, h) => Math.max(m, h.order ?? 0), -1);

    const habit = await Habit.create({
      userId: childId,
      name: pack.habitDefaults.name,
      emoji: pack.habitDefaults.emoji,
      frequency: pack.habitDefaults.frequency,
      order: maxOrder + 1,
      points: habitPoints,
      domainKeys: pack.domainKeys.filter(k => DOMAIN_KEYS.has(k)),
    });

    const program = await TrainingProgram.create({ userId: childId, packKey, habitId: habit._id });
    res.status(201).json(serializeProgram(program, pack, habit));
  } catch (err) {
    // Race on the partial unique index → same message as the pre-check.
    if (err && err.code === 11000) return res.status(409).json({ error: 'This pack is already running for this child' });
    next(err);
  }
});

// GET /api/capabilities/programs?childId= — programs for a child (default self).
router.get('/', async (req, res, next) => {
  try {
    const childId = req.query.childId || req.user._id;
    const access = await authorizeChild(req, childId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const programs = await TrainingProgram.find({ userId: access.childId }).sort({ createdAt: 1 }).lean();
    const habitIds = programs.map(p => p.habitId).filter(Boolean);
    const habitDocs = await Habit.find({ _id: { $in: habitIds } }).lean();
    const habitById = new Map(habitDocs.map(h => [String(h._id), h]));

    const out = [];
    for (const p of programs) {
      const pack = getPack(p.packKey);
      if (!pack) continue; // template removed — hide rather than crash
      out.push(serializeProgram(p, pack, habitById.get(String(p.habitId)) || null));
    }
    res.json({ programs: out });
  } catch (err) { next(err); }
});

// PATCH /api/capabilities/programs/:id — week bump / pause / resume / done (parent only).
router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const program = await TrainingProgram.findById(req.params.id);
    if (!program) return res.status(404).json({ error: 'Not found' });
    const pack = getPack(program.packKey);
    if (!pack) return res.status(410).json({ error: 'Pack template no longer exists' });

    const { currentWeek, status } = req.body || {};

    if (currentWeek !== undefined) {
      const w = Number(currentWeek);
      if (!Number.isInteger(w) || w < 1 || w > pack.weeks.length) {
        return res.status(400).json({ error: `currentWeek must be 1–${pack.weeks.length}` });
      }
      program.currentWeek = w;
    }

    if (status !== undefined) {
      if (!['active', 'paused', 'done'].includes(status)) return res.status(400).json({ error: 'invalid status' });
      program.status = status;
      program.completedAt = status === 'done' ? new Date() : null;
      // Pause/done park the daily habit so Today stays clean; resume brings it back.
      await Habit.updateOne({ _id: program.habitId }, { archivedAt: status === 'active' ? null : new Date() });
    }

    await program.save();
    const habit = await Habit.findById(program.habitId).lean();
    res.json(serializeProgram(program, pack, habit));
  } catch (err) { next(err); }
});

// PUT /api/capabilities/programs/:id/measures/:week — upsert a week's numbers.
// Parent: any pack metric + note. Kid (self): only dose scoreMetric keys, no note.
router.put('/:id/measures/:week', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const program = await TrainingProgram.findById(req.params.id).lean();
    if (!program) return res.status(404).json({ error: 'Not found' });
    const pack = getPack(program.packKey);
    if (!pack) return res.status(410).json({ error: 'Pack template no longer exists' });

    const access = await authorizeChild(req, program.userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const week = Number(req.params.week);
    if (!Number.isInteger(week) || week < 1 || week > program.currentWeek) {
      return res.status(400).json({ error: 'week must be 1..currentWeek' });
    }

    const admin = isAdmin(req);
    const self = String(program.userId) === String(req.user._id);
    if (!admin && !self) return res.status(403).json({ error: 'Not authorised' });

    const allowedKeys = admin
      ? new Set(pack.metrics.map(m => m.key))
      : kidWritableMetricKeys(pack);
    const metricDefs = new Map(pack.metrics.map(m => [m.key, m]));

    const incoming = (req.body && typeof req.body.metrics === 'object' && req.body.metrics) || {};
    const clean = {};
    for (const [key, raw] of Object.entries(incoming)) {
      if (!allowedKeys.has(key)) return res.status(400).json({ error: `metric not allowed: ${key}` });
      const def = metricDefs.get(key);
      const n = Number(raw);
      if (!Number.isFinite(n)) return res.status(400).json({ error: `metric ${key} must be a number` });
      clean[key] = Math.min(Math.max(n, def.min), def.max);
    }

    let note;
    if (req.body && req.body.note !== undefined) {
      if (!admin) return res.status(400).json({ error: 'note is parent-only' });
      note = String(req.body.note).slice(0, 500);
    }

    const existing = await WeeklyMeasure.findOne({ programId: program._id, week });
    const metrics = { ...(existing?.metrics || {}), ...clean };
    const update = { metrics, userId: program.userId };
    if (note !== undefined) update.note = note;

    const saved = await WeeklyMeasure.findOneAndUpdate(
      { programId: program._id, week },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();
    res.json({ measure: { week: saved.week, metrics: saved.metrics, note: saved.note || '' } });
  } catch (err) { next(err); }
});

// GET /api/capabilities/programs/:id/measures — all weeks ascending (chart data).
router.get('/:id/measures', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const program = await TrainingProgram.findById(req.params.id).lean();
    if (!program) return res.status(404).json({ error: 'Not found' });

    const access = await authorizeChild(req, program.userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const measures = await WeeklyMeasure.find({ programId: program._id }).sort({ week: 1 }).lean();
    res.json({ measures: measures.map(m => ({ week: m.week, metrics: m.metrics || {}, note: m.note || '' })) });
  } catch (err) { next(err); }
});

module.exports = router;
