const express = require('express');
const router = express.Router();
const GymEntry = require('../models/GymEntry');
const BodyMeasurement = require('../models/BodyMeasurement');
const SleepSession = require('../models/SleepSession');
const SleepNight = require('../models/SleepNight');
const User = require('../models/User');
const { buildHealthMarkdown, aggregateSleepNights } = require('../utils/healthMarkdown');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayUTC() { return new Date().toISOString().slice(0, 10); }
function minusDaysUTC(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// GET /api/export/health?from=YYYY-MM-DD&to=YYYY-MM-DD
// Defaults: from = today-365, to = today. Returns a text/markdown attachment.
router.get('/health', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (from && !ISO_DATE.test(from)) return res.status(400).json({ error: 'from must be YYYY-MM-DD' });
    if (to && !ISO_DATE.test(to))     return res.status(400).json({ error: 'to must be YYYY-MM-DD' });

    const fromStr = from || minusDaysUTC(365);
    const toStr   = to   || todayUTC();
    if (fromStr > toStr) return res.status(400).json({ error: 'from must be on or before to' });

    const userId = req.user._id;
    const [user, gymEntries, body, sessions, nights] = await Promise.all([
      User.findById(userId).select('weightUnit lengthUnit'),
      GymEntry.find({ userId, date: { $gte: fromStr, $lte: toStr } }).sort({ date: -1, createdAt: 1 }).lean(),
      BodyMeasurement.find({ userId, date: { $gte: fromStr, $lte: toStr } }).sort({ date: -1 }).lean(),
      SleepSession.find({ userId, nightDate: { $gte: fromStr, $lte: toStr } }).sort({ startAt: 1 }).lean(),
      SleepNight.find({ userId, nightDate: { $gte: fromStr, $lte: toStr } }).select('nightDate quality').lean(),
    ]);

    const sleepNights = aggregateSleepNights(sessions, nights);
    const units = {
      weight: user?.weightUnit || 'lb',
      length: user?.lengthUnit || 'in',
    };

    const md = buildHealthMarkdown({
      from: fromStr, to: toStr,
      generatedAt: new Date().toISOString(),
      units, gymEntries, body, sleepNights,
    });

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="health-export_${fromStr}_${toStr}.md"`);
    res.send(md);
  } catch (err) { next(err); }
});

module.exports = router;
