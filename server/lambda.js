const serverlessExpress = require('@vendia/serverless-express');
const mongoose          = require('mongoose');
const app               = require('./app');

let cachedHandler = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  await connectDB();

  if (!cachedHandler) {
    cachedHandler = serverlessExpress({ app });
  }

  return cachedHandler(event, context);
};
