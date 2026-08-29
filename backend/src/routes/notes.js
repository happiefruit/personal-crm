import { Router } from 'express';
import { pgrest } from '../supabase.js';

const router = Router();

// GET /api/notes?person_id=... — timeline, newest first
router.get('/', async (req, res, next) => {
  try {
    const query = { select: '*,people(id,name)', order: 'created_at.desc' };
    if (req.query.person_id) query.person_id = `eq.${req.query.person_id}`;
    const { data } = await pgrest('notes', { query });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/notes — capture a raw note (optionally filed against a person)
router.post('/', async (req, res, next) => {
  try {
    const { raw_text, person_id = null, source = 'manual' } = req.body;
    if (!raw_text || !raw_text.trim()) {
      return res.status(400).json({ error: 'raw_text is required' });
    }

    const { data } = await pgrest('notes', {
      method: 'POST',
      body: { raw_text: raw_text.trim(), person_id, source },
      prefer: 'return=representation',
    });
    const note = data[0];

    // Filing a note against someone bumps their last_contacted_at.
    if (person_id) {
      await pgrest('people', {
        method: 'PATCH',
        query: { id: `eq.${person_id}` },
        body: { last_contacted_at: note.created_at },
      });
    }

    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notes/:id — reassign to a person / fix text
router.patch('/:id', async (req, res, next) => {
  try {
    const body = {};
    if (req.body.raw_text !== undefined) body.raw_text = req.body.raw_text;
    if (req.body.person_id !== undefined) body.person_id = req.body.person_id;
    if (!Object.keys(body).length) {
      return res.status(400).json({ error: 'nothing to update' });
    }

    const { data } = await pgrest('notes', {
      method: 'PATCH',
      query: { id: `eq.${req.params.id}` },
      body,
      prefer: 'return=representation',
    });
    if (!data.length) return res.status(404).json({ error: 'note not found' });

    if (body.person_id) {
      await pgrest('people', {
        method: 'PATCH',
        query: { id: `eq.${body.person_id}` },
        body: { last_contacted_at: data[0].created_at },
      });
    }
    res.json(data[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await pgrest('notes', {
      method: 'DELETE',
      query: { id: `eq.${req.params.id}` },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
