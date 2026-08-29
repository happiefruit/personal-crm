import { Router } from 'express';
import { pgrest } from '../supabase.js';
import { linksForPerson } from '../relationships.js';

const router = Router();

// Fields a client is allowed to set/change on a person.
const WRITABLE = [
  'name',
  'aliases',
  'relationship',
  'tags',
  'summary',
  'important_dates',
  'birthdate',
  'pronouns',
  'how_we_met',
  'job_title',
  'company',
  'location',
  'likes',
  'dislikes',
];

function pick(body) {
  const out = {};
  for (const k of WRITABLE) if (body[k] !== undefined) out[k] = body[k];
  return out;
}

// GET /api/people — list, most-recently-contacted first
router.get('/', async (_req, res, next) => {
  try {
    const { data } = await pgrest('people', {
      query: {
        select: '*',
        order: 'last_contacted_at.desc.nullslast,created_at.desc',
      },
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/people/:id — profile + note timeline
router.get('/:id', async (req, res, next) => {
  try {
    const { data } = await pgrest('people', {
      query: {
        select: '*,notes(*)',
        id: `eq.${req.params.id}`,
        'notes.order': 'created_at.desc',
      },
    });
    if (!data.length) return res.status(404).json({ error: 'person not found' });
    const person = data[0];
    person.relationships = await linksForPerson(person.id);
    res.json(person);
  } catch (err) {
    next(err);
  }
});

// POST /api/people — create
router.post('/', async (req, res, next) => {
  try {
    const fields = pick(req.body);
    if (!fields.name || !fields.name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const { data } = await pgrest('people', {
      method: 'POST',
      body: fields,
      prefer: 'return=representation',
    });
    res.status(201).json(data[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/people/:id — edit
router.patch('/:id', async (req, res, next) => {
  try {
    const fields = pick(req.body);
    if (!Object.keys(fields).length) {
      return res.status(400).json({ error: 'no writable fields in body' });
    }
    const { data } = await pgrest('people', {
      method: 'PATCH',
      query: { id: `eq.${req.params.id}` },
      body: fields,
      prefer: 'return=representation',
    });
    if (!data.length) return res.status(404).json({ error: 'person not found' });
    res.json(data[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/people/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await pgrest('people', {
      method: 'DELETE',
      query: { id: `eq.${req.params.id}` },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
