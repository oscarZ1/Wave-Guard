import express from 'express';
import cors from 'cors';
import { pool } from './db/pool.js';
import knownDomains from './routes/known-domains.js';
import directory from './routes/directory.js';
import reports from './routes/reports.js';
import check from './routes/check.js';
import events from './routes/events.js';
import admin from './routes/admin.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: true });
  } catch (err) {
    res.status(500).json({ ok: false, db: false, error: err.message });
  }
});

app.use('/api/known-domains', knownDomains);
app.use('/api/directory', directory);
app.use('/api/reports', reports);
app.use('/api/check', check);
app.use('/api/events', events);
app.use('/api/admin', admin);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Express 5 forwards async errors here.
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status < 500 ? err.message : 'Internal server error' });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`WaveGuard API listening on http://localhost:${port}`));
