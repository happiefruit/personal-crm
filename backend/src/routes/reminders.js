import { Router } from 'express';
import { pgrest } from '../supabase.js';
import { advanceDueDate } from '../reminders.js';

const router = Router();

// GET /api/reminders?person_id=&scope=upcoming|overdue|all&days=30
router.get('/', async (req, res, next) => {
  try {
    const { person_id, scope = 'all', days = '30' } = req.query;
    const query = { select: '*,people(id,name)', order: 'due_at.asc' };
    if (person_id) query.person_id = `eq.${person_id}`;

    if (scope === 'upcoming') {
      query.sent = 'eq.false';
      const until = new Date(Date.now() + Number(days) * 86_400_000).toISOString();
      query.due_at = `lte.${until}`;
    } else if (scope === 'overdue') {
      query.sent = 'eq.false';
      query.due_at = `lt.${new Date().toISOString()}`;
    }

    const { data } = await pgrest('reminders', { query });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders  { person_id, message, due_at, recurring? }
router.post('/', async (req, res, next) => {
  try {
    const { person_id = null, message, due_at, recurring = null } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'message is required' });
    if (!due_at || Number.isNaN(Date.parse(due_at))) {
      return res.status(400).json({ error: 'due_at must be a valid date' });
    }
    const { data } = await pgrest('reminders', {
      method: 'POST',
      body: {
        person_id,
        message: message.trim(),
        due_at: new Date(due_at).toISOString(),
        recurring: recurring === 'yearly' ? 'yearly' : null,
        sent: false,
        kind: 'custom',
      },
      prefer: 'return=representation',
    });
    res.status(201).json(data[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reminders/:id  — edit fields, or { done: true } to complete/roll
router.patch('/:id', async (req, res, next) => {
  try {
    const { data: rows } = await pgrest('reminders', {
      query: { select: '*', id: `eq.${req.params.id}` },
    });
    if (!rows.length) return res.status(404).json({ error: 'reminder not found' });
    const current = rows[0];

    let body = {};
    if (req.body.done) {
      const next = advanceDueDate(current.due_at, current.recurring);
      body = next ? { due_at: next, sent: false } : { sent: true };
    } else {
      if (req.body.message !== undefined) body.message = String(req.body.message).trim();
      if (req.body.due_at !== undefined) {
        if (Number.isNaN(Date.parse(req.body.due_at))) {
          return res.status(400).json({ error: 'due_at must be a valid date' });
        }
        body.due_at = new Date(req.body.due_at).toISOString();
      }
      if (req.body.recurring !== undefined) {
        body.recurring = req.body.recurring === 'yearly' ? 'yearly' : null;
      }
      if (req.body.sent !== undefined) body.sent = Boolean(req.body.sent);
    }
    if (!Object.keys(body).length) return res.status(400).json({ error: 'nothing to update' });

    const { data } = await pgrest('reminders', {
      method: 'PATCH',
      query: { id: `eq.${req.params.id}` },
      body,
      prefer: 'return=representation',
    });
    res.json(data[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await pgrest('reminders', { method: 'DELETE', query: { id: `eq.${req.params.id}` } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
