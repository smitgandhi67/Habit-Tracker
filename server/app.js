require('dotenv').config();

const REQUIRED = ['MONGODB_URI', 'JWT_SECRET', 'GOOGLE_CLIENT_ID', 'ALLOWED_ORIGIN'];
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const helmet       = require('helmet');
const morgan       = require('morgan');

const mongoose     = require('mongoose');
const requireAuth  = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const authRouter   = require('./routes/auth');
const habitsRouter = require('./routes/habits');
const logsRouter   = require('./routes/logs');
const gymRouter    = require('./routes/gym');

const app    = express();
const isProd = process.env.NODE_ENV === 'production';

app.use(helmet());
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.get('/api/health', async (_req, res) => {
  const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state  = mongoose.connection.readyState;
  let dbPing   = null;
  let dbError  = null;
  try {
    await mongoose.connection.db.admin().ping();
    dbPing = 'ok';
  } catch (err) {
    dbError = err.message;
  }
  res.json({
    status: 'ok',
    origin: process.env.ALLOWED_ORIGIN,
    db: { state: STATES[state] || state, ping: dbPing, error: dbError },
    time: new Date().toISOString(),
  });
});

app.use('/api/habits', requireAuth, habitsRouter);
app.use('/api/logs',   requireAuth, logsRouter);
app.use('/api/gym',    requireAuth, gymRouter);

app.use(errorHandler);

module.exports = app;
