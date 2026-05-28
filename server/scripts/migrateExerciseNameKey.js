// One-time migration: backfill `nameKey` on existing Exercise docs and
// drop the legacy `name_1_bodyPart_1` index in favor of the new
// global-unique `nameKey_1` index.
//
// Run with:  node server/scripts/migrateExerciseNameKey.js
// Requires:  MONGODB_URI in env (or in ../.env).

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { normalizeExerciseName } = require('../utils/exerciseName');

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const col = mongoose.connection.collection('exercises');

  // 1) Backfill nameKey
  const cursor = col.find({ $or: [{ nameKey: { $exists: false } }, { nameKey: null }, { nameKey: '' }] });
  let updated = 0;
  for await (const doc of cursor) {
    const key = normalizeExerciseName(doc.name || '');
    if (!key) continue;
    await col.updateOne({ _id: doc._id }, { $set: { nameKey: key } });
    updated++;
  }
  console.log(`Backfilled nameKey on ${updated} docs.`);

  // 2) Check for duplicates under the new rule
  const dupes = await col.aggregate([
    { $group: { _id: '$nameKey', count: { $sum: 1 }, docs: { $push: { _id: '$_id', name: '$name', bodyPart: '$bodyPart' } } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();
  if (dupes.length) {
    console.error('Duplicates detected under new global-unique rule:');
    console.error(JSON.stringify(dupes, null, 2));
    console.error('Resolve manually before proceeding.');
    await mongoose.disconnect();
    process.exit(2);
  }

  // 3) Drop legacy index if present
  const indexes = await col.indexes();
  const legacy = indexes.find(i => i.name === 'name_1_bodyPart_1');
  if (legacy) {
    await col.dropIndex('name_1_bodyPart_1');
    console.log('Dropped legacy index name_1_bodyPart_1.');
  } else {
    console.log('Legacy index name_1_bodyPart_1 not present.');
  }

  // 4) Ensure new unique index exists
  const hasNew = (await col.indexes()).some(i => i.name === 'nameKey_1');
  if (!hasNew) {
    await col.createIndex({ nameKey: 1 }, { unique: true });
    console.log('Created unique index nameKey_1.');
  } else {
    console.log('Index nameKey_1 already exists.');
  }

  await mongoose.disconnect();
  console.log('Migration complete.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
