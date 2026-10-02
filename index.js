const express = require('express');
require('dotenv').config();
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT ||4000;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const allowedOrigins = new Set([
  frontendUrl,
  'http://localhost:3000',
  'http://localhost:3001',
  'https://fitness-tracker-frontend-eta.vercel.app',
]);
require('./config.js')
const routes = require('./routes');
app.set('trust proxy', 1);
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.use(cookieParser())
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    try {
      const parsedOrigin = new URL(origin);
      const isAllowedLocalhost = parsedOrigin.hostname === 'localhost';
      if (allowedOrigins.has(origin) || isAllowedLocalhost) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed.'));
    } catch (error) {
      return callback(new Error('Origin not allowed.'));
    }
  },
  credentials: true,
}));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.json({ limit: '10kb' }));


app.get('/', (req, res) => {

  res.send("Welcome to our Fitness Tracker!");
});


app.use(routes);


const server = app.listen(port, () => {
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'Internal server error.' });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${port} is already in use.\n` +
      `Something else (likely a previous "node index.js" or "nodemon" process) is still running.\n` +
      `Fix: find and stop it, e.g. on Mac/Linux:  lsof -i :${port}  then  kill <PID>\n` +
      `Or set a different port:  PORT=4001 npm run dev\n`
    );
    process.exit(1);
  } else {
    console.error('Server failed to start.');
    process.exit(1);
  }
});
