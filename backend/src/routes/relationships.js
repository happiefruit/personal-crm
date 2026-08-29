import { Router } from 'express';
import { createLink, deleteLink } from '../relationships.js';
import { TYPES, isValidType } from '../relationshipTypes.js';

const router = Router();

router.get('/types', (_req, res) => res.json(TYPES));

// POST /api/relationships  { from_person_id, to_person_id, type }
router.post('/', async (req, res, next) => {
  try {
    const { from_person_id, to_person_id, type } = req.body;
    if (!from_person_id || !to_person_id || !type) {
      return res.status(400).json({ error: 'from_person_id, to_person_id and type are required' });
    }
    if (!isValidType(type)) {
      return res.status(400).json({ error: `unknown type "${type}"` });
    }
    if (from_person_id === to_person_id) {
      return res.status(400).json({ error: 'cannot link a person to themselves' });
    }
    await createLink(from_person_id, to_person_id, type);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/relationships/:id  (removes both directions)
router.delete('/:id', async (req, res, next) => {
  try {
    const found = await deleteLink(req.params.id);
    if (!found) return res.status(404).json({ error: 'relationship not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
