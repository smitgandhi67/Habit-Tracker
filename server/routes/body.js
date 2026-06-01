const express = require('express');
const router = express.Router();
const BodyMeasurement = require('../models/BodyMeasurement');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const METRICS = ['weight', 'chest', 'waist', 'abdomen', 'hips'];

// GET /api/body/measurements?from&to (defaults: last 60 days through tomorrow)
router.get('/measurements', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (from && !ISO_DATE.test(from)) return res.status(400).json({ error: 'from must be YYYY-MM-DD' });
    if (to && !ISO_DATE.test(to))     return res.status(400).json({ error: 'to must be YYYY-MM-DD' });

    const today = new Date();
    const defaultFrom = new Date(today);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 60);
    const defaultTo = new Date(today);
    defaultTo.setUTCDate(defaultTo.getUTCDate() + 1);

    const fromStr = from || defaultFrom.toISOString().slice(0, 10);
    const toStr   = to   || defaultTo.toISOString().slice(0, 10);

    const measurements = await BodyMeasurement.find({
      userId: req.user._id,
      date: { $gte: fromStr, $lte: toStr },
    }).sort({ date: 1 });
    res.json(measurements);
  } catch (err) { next(err); }
});

// PUT /api/body/measurements/:date — upsert. Body may contain any subset of
// METRICS. A finite number > 0 sets the metric; null clears it. Only provided
// fields are touched.
router.put('/measurements/:date', async (req, res, next) => {
  try {
    const { date } = req.params;
    if (!ISO_DATE.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

    const body = req.body || {};
    const $set = {};
    const $unset = {};
    let touched = false;

    for (const key of METRICS) {
      if (!(key in body)) continue;
      const v = body[key];
      if (v === null) { $unset[key] = ''; touched = true; continue; }
      if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
        return res.status(400).json({ error: `${key} must be a number > 0 or null` });
      }
      $set[key] = v;
      touched = true;
    }

    if (!touched) return res.status(400).json({ error: 'no measurement fields provided' });

    const update = { $setOnInsert: { userId: req.user._id, date } };
    if (Object.keys($set).length)   update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;

    const doc = await BodyMeasurement.findOneAndUpdate(
      { userId: req.user._id, date },
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
    res.json(doc);
  } catch (err) { next(err); }
});

// DELETE /api/body/measurements/:date
router.delete('/measurements/:date', async (req, res, next) => {
  try {
    const { date } = req.params;
    if (!ISO_DATE.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    const doc = await BodyMeasurement.findOneAndDelete({ userId: req.user._id, date });
    if (!doc) return res.status(404).json({ error: 'Measurement not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
