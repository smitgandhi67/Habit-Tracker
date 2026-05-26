const express = require('express');
const router = express.Router();
const SleepSession = require('../models/SleepSession');
const SleepNight = require('../models/SleepNight');
const { nightDateFor } = require('../utils/sleepNight');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(v) {
  if (v === undefined || v === null) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Returns the conflicting session, if any. Excludes `excludeId` for edits.
async function findOverlap(userId, startAt, endAt, excludeId = null) {
  const range = endAt
    ? { startAt: { $lt: endAt } }
    : { startAt: { $lt: new Date(8.64e15) } };
  const query = {
    userId,
    _id: excludeId ? { $ne: excludeId } : { $exists: true },
    $or: [
      { ...range, endAt: { $gt: startAt } },
      { startAt: { $lt: endAt || new Date(8.64e15) }, endAt: null },
    ],
  };
  return SleepSession.findOne(query);
}

// ─── sessions ───────────────────────────────────────────────────────────────

// GET /api/sleep/sessions?from&to (defaults: last 30 days through tomorrow)
router.get('/sessions', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (from && !ISO_DATE.test(from)) return res.status(400).json({ error: 'from must be YYYY-MM-DD' });
    if (to && !ISO_DATE.test(to))     return res.status(400).json({ error: 'to must be YYYY-MM-DD' });

    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);
    const defaultTo = new Date(today);
    defaultTo.setUTCDate(defaultTo.getUTCDate() + 1);

    const fromStr = from || defaultFrom.toISOString().slice(0, 10);
    const toStr   = to   || defaultTo.toISOString().slice(0, 10);

    const sessions = await SleepSession.find({
      userId: req.user._id,
      nightDate: { $gte: fromStr, $lte: toStr },
    }).sort({ startAt: 1 });
    res.json(sessions);
  } catch (err) { next(err); }
});

// GET /api/sleep/sessions/active
router.get('/sessions/active', async (req, res, next) => {
  try {
    const active = await SleepSession.findOne({ userId: req.user._id, endAt: null });
    res.json(active || null);
  } catch (err) { next(err); }
});

// POST /api/sleep/sessions/start
router.post('/sessions/start', async (req, res, next) => {
  try {
    const { tz } = req.body || {};
    const existing = await SleepSession.findOne({ userId: req.user._id, endAt: null });
    if (existing) return res.status(409).json({ error: 'Already sleeping' });

    const startAt = new Date();
    const session = await SleepSession.create({
      userId: req.user._id,
      nightDate: nightDateFor(startAt, tz),
      startAt,
      endAt: null,
    });
    res.status(201).json(session);
  } catch (err) { next(err); }
});

// POST /api/sleep/sessions/:id/stop
router.post('/sessions/:id/stop', async (req, res, next) => {
  try {
    const session = await SleepSession.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.endAt) return res.status(409).json({ error: 'Already stopped' });

    session.endAt = new Date();
    if (session.endAt <= session.startAt) {
      // Stop tapped within the same millisecond as start — push end forward a bit.
      session.endAt = new Date(session.startAt.getTime() + 1000);
    }
    await session.save();
    res.json(session);
  } catch (err) { next(err); }
});

// POST /api/sleep/sessions — manual entry (both start + end required)
router.post('/sessions', async (req, res, next) => {
  try {
    const { startAt, endAt, tz } = req.body || {};
    const start = parseDate(startAt);
    const end   = parseDate(endAt);
    if (!start) return res.status(400).json({ error: 'startAt must be a valid date' });
    if (!end)   return res.status(400).json({ error: 'endAt must be a valid date' });
    if (end <= start) return res.status(400).json({ error: 'endAt must be after startAt' });

    const conflict = await findOverlap(req.user._id, start, end);
    if (conflict) return res.status(409).json({ error: 'Overlaps existing session' });

    const session = await SleepSession.create({
      userId: req.user._id,
      nightDate: nightDateFor(start, tz),
      startAt: start,
      endAt: end,
    });
    res.status(201).json(session);
  } catch (err) { next(err); }
});

// PUT /api/sleep/sessions/:id — edit start and/or end
router.put('/sessions/:id', async (req, res, next) => {
  try {
    const { startAt, endAt, tz } = req.body || {};
    const session = await SleepSession.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    let newStart = session.startAt;
    let newEnd   = session.endAt;
    if (startAt !== undefined) {
      const d = parseDate(startAt);
      if (!d) return res.status(400).json({ error: 'startAt must be a valid date' });
      newStart = d;
    }
    if (endAt !== undefined) {
      if (endAt === null) {
        return res.status(400).json({ error: 'endAt cannot be cleared; delete the session instead' });
      }
      const d = parseDate(endAt);
      if (!d) return res.status(400).json({ error: 'endAt must be a valid date' });
      newEnd = d;
    }
    if (newEnd && newEnd <= newStart) {
      return res.status(400).json({ error: 'endAt must be after startAt' });
    }

    const conflict = await findOverlap(req.user._id, newStart, newEnd, session._id);
    if (conflict) return res.status(409).json({ error: 'Overlaps existing session' });

    session.startAt = newStart;
    session.endAt = newEnd;
    session.nightDate = nightDateFor(newStart, tz);
    await session.save();
    res.json(session);
  } catch (err) { next(err); }
});

// DELETE /api/sleep/sessions/:id
router.delete('/sessions/:id', async (req, res, next) => {
  try {
    const session = await SleepSession.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── nights (quality) ───────────────────────────────────────────────────────

// GET /api/sleep/nights?from&to
router.get('/nights', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (from && !ISO_DATE.test(from)) return res.status(400).json({ error: 'from must be YYYY-MM-DD' });
    if (to && !ISO_DATE.test(to))     return res.status(400).json({ error: 'to must be YYYY-MM-DD' });

    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);
    const defaultTo = new Date(today);
    defaultTo.setUTCDate(defaultTo.getUTCDate() + 1);

    const fromStr = from || defaultFrom.toISOString().slice(0, 10);
    const toStr   = to   || defaultTo.toISOString().slice(0, 10);

    const nights = await SleepNight.find({
      userId: req.user._id,
      nightDate: { $gte: fromStr, $lte: toStr },
    }).select('nightDate quality');
    res.json(nights);
  } catch (err) { next(err); }
});

// PUT /api/sleep/nights/:date/quality
router.put('/nights/:date/quality', async (req, res, next) => {
  try {
    const { date } = req.params;
    if (!ISO_DATE.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    const { quality } = req.body || {};
    if (!Number.isInteger(quality) || quality < 1 || quality > 5) {
      return res.status(400).json({ error: 'quality must be integer 1..5' });
    }
    const night = await SleepNight.findOneAndUpdate(
      { userId: req.user._id, nightDate: date },
      { $set: { quality } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    res.json({ nightDate: night.nightDate, quality: night.quality });
  } catch (err) { next(err); }
});

module.exports = router;
