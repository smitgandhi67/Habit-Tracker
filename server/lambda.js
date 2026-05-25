const serverlessExpress = require('@vendia/serverless-express');
const mongoose          = require('mongoose');
const app               = require('./app');

let cachedHandler = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connect failed:', err.name, err.message);
    throw err;
  }
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  try {
    await connectDB();
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'db_connect_failed', message: err.message }),
    };
  }
  if (!cachedHandler) cachedHandler = serverlessExpress({ app });
  return cachedHandler(event, context);
};
