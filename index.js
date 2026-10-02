const express = require('express');
require('dotenv').config();
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { connectDatabase, disconnectDatabase, isDatabaseReady } = require('./config');
const { isAllowedFrontendOrigin } = require('./frontendOrigins');
const routes = require('./routes');
const app = express();
const port = process.env.PORT ||4000;
app.set('trust proxy', 1);
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.use(cookieParser())
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    return isAllowedFrontendOrigin(origin)
      ? callback(null, true)
      : callback(new Error('Origin not allowed.'));
  },
  credentials: true,
}));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));


app.get('/', (req, res) => {
  res.send("Welcome to our Fitness Tracker!");
});

app.get('/health', (req, res) => {
  const ready = isDatabaseReady();
  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'unavailable',
    database: ready ? 'connected' : 'disconnected',
  });
});


app.use(routes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'Internal server error.' });
});

let server;

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down.`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDatabase();
  process.exit(0);
};

const start = async () => {
  try {
    await connectDatabase();
    server = app.listen(port, () => {
      console.log(`Nutrix API listening on port ${port}.`);
    });
    server.on('error', (error) => {
      console.error(`Server failed to start: ${error.message}`);
      process.exit(1);
    });
  } catch (error) {
    console.error(`Startup failed: ${error.message}`);
    process.exit(1);
  }
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

start();
