const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const ProblemEntry = require('../models/ProblemEntry');
const BuildProject = require('../models/BuildProject');
const MathReward = require('../models/MathReward');
const MathPointAdjustment = require('../models/MathPointAdjustment');
const {
  POINTS, PROBLEM_KINDS, PROBLEM_STATUSES, FLUENCY_LEVELS,
  problemAward, canShip, topFluency,
} = require('../utils/builder');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Credit the shared points wallet + write an audit row. Mirrors the habit-approval
// credit in routes/math.js, so Builder earnings appear in the existing points ledger
// (buildLedger reads MathPointAdjustment type 'add' as a "Bonus" event).
async function creditPoints(userId, amount, reason) {
  if (amount <= 0) return;
  await MathReward.findOneAndUpdate(
    { userId },
    { $inc: { pointsEarned: amount }, $setOnInsert: { pointsSpent: 0 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await MathPointAdjustment.create({ userId, adminEmail: null, type: 'add', amount, reason });
}

async function balanceFor(userId) {
  const r = await MathReward.findOne({ userId }).lean();
  const earned = r?.pointsEarned || 0;
  const spent = r?.pointsSpent || 0;
  return Math.max(0, earned - spent);
}

// GET /api/build — dashboard: problems, projects, fluency badge, wallet balance.
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [problems, projects, balance] = await Promise.all([
      ProblemEntry.find({ userId }).sort({ createdAt: -1 }).limit(200).lean(),
      BuildProject.find({ userId }).sort({ createdAt: -1 }).limit(200).lean(),
      balanceFor(userId),
    ]);
    res.json({ problems, projects, fluency: topFluency(projects.filter(p => p.shippedAt)), balance });
  } catch (err) { next(err); }
});

// POST /api/build/problems — body { text, kind?, date }. Logs a problem; credits points
// up to the daily cap (further entries that day are allowed but earn 0).
router.post('/problems', async (req, res, next) => {
  try {
    const { text, kind = 'idea', date } = req.body || {};
    if (!String(text || '').trim()) return res.status(400).json({ error: 'text required' });
    if (!PROBLEM_KINDS.includes(kind)) return res.status(400).json({ error: `kind must be one of: ${PROBLEM_KINDS.join(', ')}` });
    if (!date || !ISO_DATE.test(date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });
    const userId = req.user._id;

    const creditedToday = await ProblemEntry.countDocuments({ userId, date, credited: true });
    const award = problemAward(creditedToday);
    const problem = await ProblemEntry.create({
      userId, text: String(text).trim().slice(0, 280), kind, date, credited: award > 0,
    });
    if (award > 0) await creditPoints(userId, award, `Builder: logged a problem (${date})`);

    res.status(201).json({ problem, awarded: award, balance: await balanceFor(userId) });
  } catch (err) { next(err); }
});

// PATCH /api/build/problems/:id — body { status }. Pick-to-build = 'tinkering'.
router.patch('/problems/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'valid id required' });
    const { status } = req.body || {};
    if (!PROBLEM_STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${PROBLEM_STATUSES.join(', ')}` });
    const problem = await ProblemEntry.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id }, { status }, { new: true },
    ).lean();
    if (!problem) return res.status(404).json({ error: 'Not found' });
    res.json({ problem });
  } catch (err) { next(err); }
});

// DELETE /api/build/problems/:id
router.delete('/problems/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'valid id required' });
    const r = await ProblemEntry.deleteOne({ _id: req.params.id, userId: req.user._id });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/build/projects — create a project (not yet shipped; earns nothing until shipped).
router.post('/projects', async (req, res, next) => {
  try {
    const { title, description = '', url = '', audience = '', aiLevel = 'helper' } = req.body || {};
    if (!String(title || '').trim()) return res.status(400).json({ error: 'title required' });
    if (!FLUENCY_LEVELS.includes(aiLevel)) return res.status(400).json({ error: `aiLevel must be one of: ${FLUENCY_LEVELS.join(', ')}` });
    const project = await BuildProject.create({
      userId: req.user._id,
      title: String(title).trim().slice(0, 100),
      description: String(description).trim().slice(0, 1000),
      url: String(url).trim().slice(0, 300),
      audience: String(audience).trim().slice(0, 140),
      aiLevel,
    });
    res.status(201).json({ project });
  } catch (err) { next(err); }
});

// PATCH /api/build/projects/:id — edit fields. Does not ship and does not move points.
router.patch('/projects/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'valid id required' });
    const b = req.body || {};
    const patch = {};
    if (b.title !== undefined) {
      if (!String(b.title).trim()) return res.status(400).json({ error: 'title cannot be empty' });
      patch.title = String(b.title).trim().slice(0, 100);
    }
    if (b.description !== undefined) patch.description = String(b.description).trim().slice(0, 1000);
    if (b.url !== undefined) patch.url = String(b.url).trim().slice(0, 300);
    if (b.audience !== undefined) patch.audience = String(b.audience).trim().slice(0, 140);
    if (b.aiLevel !== undefined) {
      if (!FLUENCY_LEVELS.includes(b.aiLevel)) return res.status(400).json({ error: 'invalid aiLevel' });
      patch.aiLevel = b.aiLevel;
    }
    if (b.explainedIt !== undefined) patch.explainedIt = !!b.explainedIt;
    const project = await BuildProject.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id }, patch, { new: true },
    ).lean();
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json({ project });
  } catch (err) { next(err); }
});

// POST /api/build/projects/:id/ship — body { explainedIt }. The explain-every-line gate;
// on pass, stamps shippedAt and credits the ship bonus once.
router.post('/projects/:id/ship', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'valid id required' });
    const userId = req.user._id;
    const project = await BuildProject.findOne({ _id: req.params.id, userId });
    if (!project) return res.status(404).json({ error: 'Not found' });

    const gate = canShip(project, req.body?.explainedIt === true);
    if (!gate.ok) return res.status(400).json({ error: gate.error });

    project.explainedIt = true;
    project.shippedAt = new Date();
    await project.save();
    await creditPoints(userId, POINTS.ship, `Builder: shipped "${project.title}"`);

    const shipped = await BuildProject.find({ userId, shippedAt: { $ne: null } }).lean();
    res.json({
      project: project.toObject(),
      awarded: POINTS.ship,
      fluency: topFluency(shipped),
      balance: await balanceFor(userId),
    });
  } catch (err) { next(err); }
});

// DELETE /api/build/projects/:id — removes the project (already-earned points stay).
router.delete('/projects/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'valid id required' });
    const r = await BuildProject.deleteOne({ _id: req.params.id, userId: req.user._id });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
