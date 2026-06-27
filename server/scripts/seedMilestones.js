#!/usr/bin/env node
// Seed a kid's Grade-5 roadmap milestones (idempotent — skips any whose title already
// exists for that user, so re-running is safe).
//
// Usage:
//   node server/scripts/seedMilestones.js [--dry-run] mit
// The positional token is a full email or an email prefix (case-insensitive); defaults
// to "mit". Mirrors the resolver used by the other scripts.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Pin public resolvers so mongodb+srv:// SRV lookups work on Windows (c-ares quirk).
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch { /* ignore */ }

const mongoose = require('mongoose');
const User = require('../models/User');
const Milestone = require('../models/Milestone');

const norm = (s) => (s || '').trim().toLowerCase();

// Grade-5 milestones (note: 'not_started' from the source list maps to 'upcoming').
const GRADE = 5;
const MILESTONES = [
  { title: 'Finish Beast Academy 4',                       category: 'math',        status: 'in_progress', target: '2026' },
  { title: 'Finish Beast Academy 5',                       category: 'math',        status: 'upcoming',    target: '2026' },
  { title: 'Start AoPS Pre-Algebra',                       category: 'math',        status: 'upcoming',    target: 'Fall 2026' },
  { title: 'First AMC 8',                                  category: 'competition', status: 'upcoming',    target: 'Jan 2027' },
  { title: 'Math Kangaroo retake (beat 57 / Rank 38)',     category: 'competition', status: 'upcoming',    target: 'Mar 18 2027' },
  { title: 'Reading + journal habits durable',             category: 'other',       status: 'in_progress', target: '' },
  { title: 'First "ship it" project',                      category: 'building',    status: 'upcoming',    target: 'by Jun 2027' },
  { title: 'Science notebook + first experiment',          category: 'science',     status: 'upcoming',    target: 'Summer 2026' },
];

async function findUser(token) {
  return (await User.findOne({ email: token }))
    || (await User.findOne({ email: new RegExp('^' + token, 'i') }));
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const token = argv.find(a => a !== '--dry-run') || 'mit';

  if (!process.env.MONGODB_URI) { console.error('Error: MONGODB_URI is not set.'); process.exit(2); }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const user = await findUser(token);
    if (!user) { console.error(`No user matching "${token}".`); process.exit(1); }

    const existing = await Milestone.find({ userId: user._id }).select('title').lean();
    const have = new Set(existing.map(m => norm(m.title)));

    const toInsert = MILESTONES.filter(m => !have.has(norm(m.title)));
    const skip = MILESTONES.filter(m => have.has(norm(m.title)));

    console.log(`User: ${user.email}  (${existing.length} existing milestones)`);
    console.log(`\nWill INSERT ${toInsert.length} (Grade ${GRADE}):`);
    for (const m of toInsert) console.log(`  [${m.status}] ${m.title} | ${m.category} | ${m.target || '—'}`);
    if (skip.length) {
      console.log(`\nWill SKIP ${skip.length} (title already present):`);
      for (const m of skip) console.log(`  ${m.title}`);
    }

    if (dryRun) { console.log('\n[DRY RUN] No changes written.'); return; }
    if (toInsert.length === 0) { console.log('\nNothing to insert.'); return; }

    const maxOrder = existing.length;
    const docs = toInsert.map((m, i) => ({ userId: user._id, grade: GRADE, order: maxOrder + i, ...m }));
    const inserted = await Milestone.insertMany(docs, { ordered: true });
    console.log(`\nInserted ${inserted.length} milestones for ${user.email}.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => { console.error('Seed failed:', err); process.exit(1); });
