#!/usr/bin/env node
// One-time migration to move the existing single family onto the new linking model.
//
//   1. Sync MathRewardConfig indexes — drops the stale `singleton_1` unique index
//      (blocker: without this, a 2nd per-child config collides on null `singleton`)
//      and builds the new `childId` unique index.
//   2. Create APPROVED AccountLinks: parent -> each child.
//   3. Copy the old global reward catalog into a per-child config for each child
//      (falls back to DEFAULT_REWARDS if there was no global doc).
//   4. Delete the stale global reward doc (last step, so it can be skipped on failure).
//
// Idempotent: safe to re-run (upserts + existence checks). Use --dry-run first.
//
//   node server/scripts/seedFamilyLinks.js [--dry-run]
//     [--parent=amitgandhi23] [--child=mitgandhi67 --child=smitgandhi67]
// --parent/--child accept a full email or an email prefix (case-insensitive).

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch { /* ignore */ }

const mongoose = require('mongoose');
const User = require('../models/User');
const AccountLink = require('../models/AccountLink');
const MathRewardConfig = require('../models/MathRewardConfig');
const { DEFAULT_REWARDS } = require('../utils/math');

function parseArgs(argv) {
  const a = { parent: 'amitgandhi23', children: [], dryRun: false };
  for (const raw of argv.slice(2)) {
    if (raw === '--dry-run')          { a.dryRun = true; continue; }
    if (raw.startsWith('--parent='))  { a.parent = raw.slice('--parent='.length); continue; }
    if (raw.startsWith('--child='))   { a.children.push(raw.slice('--child='.length)); continue; }
    console.warn(`Ignoring unknown arg: ${raw}`);
  }
  if (a.children.length === 0) a.children = ['mitgandhi67', 'smitgandhi67'];
  return a;
}

async function findUser(token) {
  return (await User.findOne({ email: token }))
    || (await User.findOne({ email: new RegExp('^' + token, 'i') }));
}

async function main() {
  const { parent, children, dryRun } = parseArgs(process.argv);
  if (!process.env.MONGODB_URI) { console.error('Error: MONGODB_URI is not set.'); process.exit(2); }

  await mongoose.connect(process.env.MONGODB_URI);
  try {
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

    // 1. Index migration (drops singleton_1, builds childId unique).
    if (dryRun) {
      const idx = await MathRewardConfig.collection.indexes().catch(() => []);
      console.log('  [1] would syncIndexes; current:', idx.map(i => i.name).join(', '));
    } else {
      const dropped = await MathRewardConfig.syncIndexes();
      console.log('  [1] syncIndexes done (stale indexes dropped):', dropped);
    }

    // Resolve accounts.
    const parentUser = await findUser(parent);
    if (!parentUser) { console.error(`No parent user matching "${parent}"`); process.exit(1); }
    console.log(`  parent: ${parentUser.email} (${parentUser._id})`);

    const childUsers = [];
    for (const token of children) {
      const u = await findUser(token);
      if (!u) { console.log(`  child "${token}": NOT FOUND — skipping`); continue; }
      childUsers.push(u);
      console.log(`  child:  ${u.email} (${u._id})`);
    }
    if (childUsers.length === 0) { console.error('No child users resolved.'); process.exit(1); }

    // Old global reward catalog (raw read — the field is gone from the schema).
    const globalDoc = await MathRewardConfig.collection.findOne({ singleton: 'config' });
    const globalRewards = (globalDoc && Array.isArray(globalDoc.rewards) && globalDoc.rewards.length)
      ? globalDoc.rewards.map(r => ({ key: r.key, label: r.label, costPoints: r.costPoints, unit: r.unit || 'event' }))
      : DEFAULT_REWARDS;
    console.log(`  reward source: ${globalDoc ? 'existing global doc' : 'DEFAULT_REWARDS'} (${globalRewards.length} rewards)`);

    // 2 + 3. Per child: approved link + per-child reward config.
    for (const child of childUsers) {
      const linkExists = await AccountLink.findOne({ parentId: parentUser._id, childId: child._id }).lean();
      const cfgExists  = await MathRewardConfig.findOne({ childId: child._id }).lean();
      console.log(`  ${child.email}: link=${linkExists ? linkExists.status : 'none'} cfg=${cfgExists ? 'exists' : 'none'}`);
      if (dryRun) {
        console.log(`     would upsert approved link + reward config (${globalRewards.length} rewards)`);
        continue;
      }
      await AccountLink.findOneAndUpdate(
        { parentId: parentUser._id, childId: child._id },
        { $set: { status: 'approved', initiatedBy: parentUser._id, respondedAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      if (!cfgExists) {
        await MathRewardConfig.findOneAndUpdate(
          { childId: child._id },
          { $set: { childId: child._id, rewards: globalRewards } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
      console.log('     ✓ linked + reward config ensured');
    }

    // 4. Remove the stale global doc (source already copied).
    if (globalDoc) {
      if (dryRun) console.log('  [4] would delete stale global reward doc');
      else {
        await MathRewardConfig.collection.deleteOne({ _id: globalDoc._id });
        console.log('  [4] deleted stale global reward doc');
      }
    }

    console.log(dryRun ? '\n[DRY RUN] No changes written.' : '\nMigration complete.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
