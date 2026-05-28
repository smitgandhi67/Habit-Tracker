// One-off: delete duplicate Exercise doc with 0 GymEntry references.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.collection('exercises');

  // Delete the capitalized "Seated Leg Curls" (0 refs)
  const result = await col.deleteOne({ name: 'Seated Leg Curls', bodyPart: 'legs' });
  console.log(`Deleted ${result.deletedCount} doc(s).`);

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
