const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Milestone = require('../models/Milestone');
const Achievement = require('../models/Achievement');
const { requireAdmin } = require('../utils/auth');
const {
  MILESTONE_CATEGORIES, MILESTONE_STATUSES, ACHIEVEMENT_CATEGORIES, validGrade,
} = require('../utils/journey');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, max) => String(v ?? '').trim().slice(0, max);

// Normalize an optional grade from a request body. Returns { ok, value } where value is
// null (ungrouped) or an int 5..12; ok:false for anything else.
function readGrade(raw) {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null };
  const n = Number(raw);
  if (!validGrade(n)) return { ok: false };
  return { ok: true, value: n };
}

// ---- kid (self) -----------------------------------------------------------

// GET /api/journey/trophies — the signed-in kid's own achievements (read-only shelf).
// Milestones are intentionally NOT exposed to the kid (no future-target pressure).
router.get('/trophies', async (req, res, next) => {
  try {
    const achievements = await Achievement.find({ userId: req.user._id })
      .sort({ date: -1, createdAt: -1 }).limit(500).lean();
    res.json({ achievements });
  } catch (err) { next(err); }
});

// ---- parent (admin) -------------------------------------------------------

// GET /api/journey/admin?userId= — a kid's full roadmap + brag-sheet.
router.get('/admin', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.query.userId)) return res.status(400).json({ error: 'valid userId required' });
    const userId = req.query.userId;
    const [milestones, achievements] = await Promise.all([
      Milestone.find({ userId }).sort({ grade: 1, order: 1, createdAt: 1 }).lean(),
      Achievement.find({ userId }).sort({ date: -1, createdAt: -1 }).lean(),
    ]);
    res.json({ milestones, achievements });
  } catch (err) { next(err); }
});

// POST /api/journey/admin/milestones — body { userId, title, grade?, category?, status?, target?, notes?, order? }
router.post('/admin/milestones', requireAdmin, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!mongoose.isValidObjectId(b.userId)) return res.status(400).json({ error: 'valid userId required' });
    if (!str(b.title, 160)) return res.status(400).json({ error: 'title required' });
    const grade = readGrade(b.grade);
    if (!grade.ok) return res.status(400).json({ error: 'grade must be 5–12 or empty' });
    const category = b.category ?? 'other';
    if (!MILESTONE_CATEGORIES.includes(category)) return res.status(400).json({ error: 'invalid category' });
    const status = b.status ?? 'upcoming';
    if (!MILESTONE_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' });

    const milestone = await Milestone.create({
      userId: b.userId, title: str(b.title, 160), grade: grade.value, category, status,
      target: str(b.target, 60), notes: str(b.notes, 500),
      order: Number.isFinite(b.order) ? b.order : 0,
    });
    res.status(201).json({ milestone });
  } catch (err) { next(err); }
});

// PATCH /api/journey/admin/milestones/:id — partial update.
router.patch('/admin/milestones/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'valid id required' });
    const b = req.body || {};
    const patch = {};
    if (b.title !== undefined) { if (!str(b.title, 160)) return res.status(400).json({ error: 'title cannot be empty' }); patch.title = str(b.title, 160); }
    if (b.grade !== undefined) { const g = readGrade(b.grade); if (!g.ok) return res.status(400).json({ error: 'grade must be 5–12 or empty' }); patch.grade = g.value; }
    if (b.category !== undefined) { if (!MILESTONE_CATEGORIES.includes(b.category)) return res.status(400).json({ error: 'invalid category' }); patch.category = b.category; }
    if (b.status !== undefined) { if (!MILESTONE_STATUSES.includes(b.status)) return res.status(400).json({ error: 'invalid status' }); patch.status = b.status; }
    if (b.target !== undefined) patch.target = str(b.target, 60);
    if (b.notes !== undefined) patch.notes = str(b.notes, 500);
    if (b.order !== undefined && Number.isFinite(b.order)) patch.order = b.order;

    const milestone = await Milestone.findByIdAndUpdate(req.params.id, patch, { new: true }).lean();
    if (!milestone) return res.status(404).json({ error: 'Not found' });
    res.json({ milestone });
  } catch (err) { next(err); }
});

// DELETE /api/journey/admin/milestones/:id
router.delete('/admin/milestones/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'valid id required' });
    const r = await Milestone.deleteOne({ _id: req.params.id });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/journey/admin/achievements — body { userId, title, date, grade?, category?, placement?, hours?, url?, description? }
router.post('/admin/achievements', requireAdmin, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!mongoose.isValidObjectId(b.userId)) return res.status(400).json({ error: 'valid userId required' });
    if (!str(b.title, 160)) return res.status(400).json({ error: 'title required' });
    if (!b.date || !ISO_DATE.test(b.date)) return res.status(400).json({ error: 'date (YYYY-MM-DD) required' });
    const grade = readGrade(b.grade);
    if (!grade.ok) return res.status(400).json({ error: 'grade must be 5–12 or empty' });
    const category = b.category ?? 'other';
    if (!ACHIEVEMENT_CATEGORIES.includes(category)) return res.status(400).json({ error: 'invalid category' });

    const achievement = await Achievement.create({
      userId: b.userId, title: str(b.title, 160), date: b.date, grade: grade.value, category,
      placement: str(b.placement, 80), hours: Number.isFinite(b.hours) && b.hours >= 0 ? b.hours : 0,
      url: str(b.url, 300), description: str(b.description, 1000),
    });
    res.status(201).json({ achievement });
  } catch (err) { next(err); }
});

// PATCH /api/journey/admin/achievements/:id — partial update.
router.patch('/admin/achievements/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'valid id required' });
    const b = req.body || {};
    const patch = {};
    if (b.title !== undefined) { if (!str(b.title, 160)) return res.status(400).json({ error: 'title cannot be empty' }); patch.title = str(b.title, 160); }
    if (b.date !== undefined) { if (!ISO_DATE.test(b.date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' }); patch.date = b.date; }
    if (b.grade !== undefined) { const g = readGrade(b.grade); if (!g.ok) return res.status(400).json({ error: 'grade must be 5–12 or empty' }); patch.grade = g.value; }
    if (b.category !== undefined) { if (!ACHIEVEMENT_CATEGORIES.includes(b.category)) return res.status(400).json({ error: 'invalid category' }); patch.category = b.category; }
    if (b.placement !== undefined) patch.placement = str(b.placement, 80);
    if (b.hours !== undefined) patch.hours = Number.isFinite(b.hours) && b.hours >= 0 ? b.hours : 0;
    if (b.url !== undefined) patch.url = str(b.url, 300);
    if (b.description !== undefined) patch.description = str(b.description, 1000);

    const achievement = await Achievement.findByIdAndUpdate(req.params.id, patch, { new: true }).lean();
    if (!achievement) return res.status(404).json({ error: 'Not found' });
    res.json({ achievement });
  } catch (err) { next(err); }
});

// DELETE /api/journey/admin/achievements/:id
router.delete('/admin/achievements/:id', requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'valid id required' });
    const r = await Achievement.deleteOne({ _id: req.params.id });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
