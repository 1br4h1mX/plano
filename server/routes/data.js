/**
 * data.js — per-account Plano snapshot storage.
 * Each account owns exactly one snapshot document (the app syncs it wholesale,
 * which keeps writes idempotent and simple).
 */
import { Router } from 'express';
import { store } from '../lib/store.js';
import { requireAuth } from './auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const snapshot = store.getData(req.user.id);
  if (!snapshot) return res.status(404).json({ error: 'No data yet.' });
  res.json({ ok: true, snapshot });
});

router.put('/', (req, res) => {
  const snapshot = req.body;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot))
    return res.status(400).json({ error: 'Invalid snapshot.' });
  store.setData(req.user.id, snapshot);
  res.json({ ok: true });
});

export default router;