import { Router } from 'express';
import { pgrest } from '../supabase.js';
import { parseNote, aiConfigured } from '../ai/parseNote.js';

const router = Router();

router.use((_req, res, next) => {
  if (!aiConfigured) return res.status(503).json({ error: 'AI not configured (ANTHROPIC_API_KEY)' });
  next();
});

function uniq(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function mergeDates(current = [], incoming = []) {
  const byLabel = new Map();
  for (const d of current) byLabel.set(d.label.toLowerCase(), d);
  for (const d of incoming) byLabel.set(d.label.toLowerCase(), d); // incoming wins
  return [...byLabel.values()];
}

// POST /api/ai/parse — save the raw note, run the AI analysis, return a suggestion.
// Nothing about any person is changed yet; the client confirms via /api/ai/apply.
router.post('/parse', async (req, res, next) => {
  try {
    const { raw_text, source = 'manual' } = req.body;
    if (!raw_text || !raw_text.trim()) {
      return res.status(400).json({ error: 'raw_text is required' });
    }

    const { data: people } = await pgrest('people', {
      query: { select: 'id,name,aliases,relationship,summary' },
    });

    const { data: noteRows } = await pgrest('notes', {
      method: 'POST',
      body: { raw_text: raw_text.trim(), source },
      prefer: 'return=representation',
    });
    const note = noteRows[0];

    let suggestion;
    try {
      ({ suggestion } = await parseNote({ rawText: note.raw_text, people }));
    } catch (aiErr) {
      // Note is safely saved; let the client fall back to manual filing.
      return res.status(502).json({ error: `AI parse failed: ${aiErr.message}`, note });
    }

    await pgrest('notes', {
      method: 'PATCH',
      query: { id: `eq.${note.id}` },
      body: { extracted_facts: suggestion },
    });

    res.status(201).json({ note, suggestion, people });
  } catch (err) {
    next(err);
  }
});

// POST /api/ai/apply — commit a (possibly user-edited) suggestion:
// create or update the person, then file the note against them.
router.post('/apply', async (req, res, next) => {
  try {
    const {
      note_id,
      person_match,
      person_id,
      name,
      relationship = null,
      tags = [],
      important_dates = [],
      summary = null,
    } = req.body;

    if (!note_id) return res.status(400).json({ error: 'note_id is required' });

    const { data: noteRows } = await pgrest('notes', { query: { select: '*', id: `eq.${note_id}` } });
    if (!noteRows.length) return res.status(404).json({ error: 'note not found' });
    const note = noteRows[0];

    let person;

    if (person_match === 'existing' && person_id) {
      const { data: rows } = await pgrest('people', { query: { select: '*', id: `eq.${person_id}` } });
      if (!rows.length) return res.status(404).json({ error: 'matched person not found' });
      const existing = rows[0];

      const { data: updated } = await pgrest('people', {
        method: 'PATCH',
        query: { id: `eq.${existing.id}` },
        body: {
          tags: uniq([...(existing.tags || []), ...tags]),
          important_dates: mergeDates(existing.important_dates, important_dates),
          relationship: existing.relationship || relationship,
          summary: summary || existing.summary,
          last_contacted_at: note.created_at,
        },
        prefer: 'return=representation',
      });
      person = updated[0];
    } else {
      if (!name || !name.trim()) return res.status(400).json({ error: 'name is required for a new person' });
      const { data: created } = await pgrest('people', {
        method: 'POST',
        body: {
          name: name.trim(),
          relationship,
          tags: uniq(tags),
          important_dates,
          summary,
          last_contacted_at: note.created_at,
        },
        prefer: 'return=representation',
      });
      person = created[0];
    }

    await pgrest('notes', {
      method: 'PATCH',
      query: { id: `eq.${note.id}` },
      body: { person_id: person.id },
    });

    const { data: full } = await pgrest('people', {
      query: { select: '*,notes(*)', id: `eq.${person.id}`, 'notes.order': 'created_at.desc' },
    });
    res.json(full[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
