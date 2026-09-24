import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import aiRoutes from './routes/ai.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health + capability check (the client uses this to know whether real AI is available).
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY) });
});

app.use('/api/ai', aiRoutes);

// Production: serve the built SPA and fall back to index.html for client routing.
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[plano] error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n  Plano server running on http://localhost:${PORT}`);
  console.log(`  AI configured: ${Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log('  Frontend (dev):  http://localhost:5173\n');
  }
});