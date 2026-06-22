#!/usr/bin/env node
// Backfill MathDailyStat.points = correct for rows written before operation
// weighting existed (when points were 1:1 with first-try-correct answers).
//
// Must run BEFORE deploying the weighted-scoring code: otherwise a day's doc
// that already exists (points field absent) would have $inc create points from
// 0, dropping its pre-deploy earnings.
//
// Usage:
//   node server/scripts/backfillDailyStatPoints.js [--dry-run]

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// c-ares on Windows can fail SRV lookups even when the OS resolves fine.
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch { /* ignore */ }

const mongoose = require('mongoose');
const MathDailyStat = require('../models/MathDailyStat');

async function main() {
  const dryRun = process.argv.slice(2).includes('--dry-run');
  if (!process.env.MONGODB_URI) { console.error('Error: MONGODB_URI is not set.'); process.exit(2); }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const missing = await MathDailyStat.countDocuments({ points: { $exists: false } });
    console.log(`Rows without points: ${missing}`);
    if (missing === 0) { console.log('Nothing to backfill.'); return; }
    if (dryRun) { console.log('[DRY RUN] Would set points = correct on those rows.'); return; }

    // points = correct, via the native driver (accepts an aggregation pipeline).
    const res = await MathDailyStat.collection.updateMany(
      { points: { $exists: false } },
      [{ $set: { points: '$correct' } }],
    );
    console.log(`Updated ${res.modifiedCount ?? 0} rows.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => { console.error('Backfill failed:', err); process.exit(1); });
