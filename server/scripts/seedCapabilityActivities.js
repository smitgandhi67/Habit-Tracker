#!/usr/bin/env node
// Seed the capability activity library (handover_1.md §6). Idempotent — upserts by
// slug, so re-running updates wording/approach rules in place without duplicating.
//
// Usage:
//   node server/scripts/seedCapabilityActivities.js [--dry-run]

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Pin public resolvers so mongodb+srv:// SRV lookups work on Windows (c-ares quirk).
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch { /* ignore */ }

const mongoose = require('mongoose');
const CapabilityActivity = require('../models/CapabilityActivity');
const { ACTIVITIES } = require('../capabilities/activitiesSeed');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!process.env.MONGODB_URI) { console.error('Error: MONGODB_URI is not set.'); process.exit(2); }

  console.log(`Seeding ${ACTIVITIES.length} activities (${ACTIVITIES.filter(a => a.kind !== 'skip').length} do / ${ACTIVITIES.filter(a => a.kind === 'skip').length} skip).`);
  for (const a of ACTIVITIES) {
    console.log(`  [${a.kind === 'skip' ? 'skip' : 'T' + a.tier}] ${a.title}  (${a.domainKeys.join(', ')})`);
  }
  if (dryRun) { console.log('\n[DRY RUN] No changes written.'); return; }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const ops = ACTIVITIES.map((a, i) => ({
      updateOne: {
        filter: { slug: a.slug },
        update: { $set: { ...a, order: i, archivedAt: null } },
        upsert: true,
      },
    }));
    const res = await CapabilityActivity.bulkWrite(ops, { ordered: true });
    console.log(`\nUpserted: ${res.upsertedCount} new, ${res.modifiedCount} updated, ${res.matchedCount} matched.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => { console.error('Seed failed:', err); process.exit(1); });
