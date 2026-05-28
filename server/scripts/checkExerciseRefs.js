// One-off: count GymEntry rows referencing each casing of "Seated leg curls".
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const col = mongoose.connection.collection('gymentries');
  const names = ['Seated leg curls', 'Seated Leg Curls'];
  for (const n of names) {
    const c = await col.countDocuments({ exerciseName: n });
    console.log(`${JSON.stringify(n)}: ${c} GymEntry rows`);
  }
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
