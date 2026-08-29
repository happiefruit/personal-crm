import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { checkDatabase, supabaseConfigured } from './supabase.js';
import peopleRouter from './routes/people.js';
import notesRouter from './routes/notes.js';

const app = express();
app.use(express.json());

const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // allow non-browser clients (curl, health checks) with no Origin header
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
  }),
);

app.get('/', (_req, res) => {
  res.json({ name: 'personal-crm-backend', status: 'up' });
});

app.get('/api/health', async (_req, res) => {
  const db = await checkDatabase();
  res.status(db.ok ? 200 : 503).json({
    status: db.ok ? 'ok' : 'degraded',
    backend: 'ok',
    database: db.ok ? 'ok' : 'error',
    database_detail: db.detail,
    supabase_configured: supabaseConfigured,
    time: new Date().toISOString(),
  });
});

app.use('/api/people', peopleRouter);
app.use('/api/notes', notesRouter);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'internal error' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`personal-crm-backend listening on :${port}`);
  console.log(`allowed origins: ${allowedOrigins.join(', ')}`);
  if (!supabaseConfigured) {
    console.warn('WARNING: Supabase env vars not set — /api/health will report degraded');
  }
});
