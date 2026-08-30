import { Router } from 'express';
import { pgrest } from '../supabase.js';
import { parseNote, aiConfigured } from '../ai/parseNote.js';
import { createLink } from '../relationships.js';
import { isValidType } from '../relationshipTypes.js';
import { uniq, mergeDates } from '../merge.js';
import { syncBirthdayReminder } from '../reminders.js';

const router = Router();

const MAX_NOTE_CHARS = 8000;

router.use((_req, res, next) => {
  if (!aiConfigured) return res.status(503).json({ error: 'AI not configured (ANTHROPIC_API_KEY)' });
  next();
});

// POST /api/ai/parse — save the raw note, run the AI analysis, return a suggestion.
// Nothing about any person is changed yet; the client confirms via /api/ai/apply.
router.post('/parse', async (req, res, next) => {
  try {
    const { raw_text, source = 'manual', for_person_id = null } = req.body;
    if (!raw_text || !raw_text.trim()) {
      return res.status(400).json({ error: 'raw_text is required' });
    }
    if (raw_text.length > MAX_NOTE_CHARS) {
      return res.status(413).json({ error: `note too long (max ${MAX_NOTE_CHARS} chars)` });
    }

    const { data: people } = await pgrest('people', {
      query: { select: 'id,name,aliases,relationship,summary' },
    });

    const subjectPerson = for_person_id
      ? people.find((p) => p.id === for_person_id) || null
      : null;

    const { data: noteRows } = await pgrest('notes', {
      method: 'POST',
      body: { raw_text: raw_text.trim(), source },
      prefer: 'return=representation',
    });
    const note = noteRows[0];

    let suggestion;
    try {
      ({ suggestion } = await parseNote({ rawText: note.raw_text, people, subjectPerson }));
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
      birthdate = null,
      pronouns = null,
      how_we_met = null,
      job_title = null,
      company = null,
      location = null,
      likes = [],
      dislikes = [],
      mentioned_people = [],
      reminder = null, // { message, due_at } — user-confirmed from the suggestion
    } = req.body;

    // Scalar contact fields: fill only when the person doesn't already have one.
    const fillIfEmpty = { birthdate, pronouns, how_we_met, job_title, company, location };

    if (!note_id) return res.status(400).json({ error: 'note_id is required' });

    const { data: noteRows } = await pgrest('notes', { query: { select: '*', id: `eq.${note_id}` } });
    if (!noteRows.length) return res.status(404).json({ error: 'note not found' });
    const note = noteRows[0];

    let person;

    if (person_match === 'existing' && person_id) {
      const { data: rows } = await pgrest('people', { query: { select: '*', id: `eq.${person_id}` } });
      if (!rows.length) return res.status(404).json({ error: 'matched person not found' });
      const existing = rows[0];

      const patch = {
        tags: uniq([...(existing.tags || []), ...tags]),
        likes: uniq([...(existing.likes || []), ...likes]),
        dislikes: uniq([...(existing.dislikes || []), ...dislikes]),
        important_dates: mergeDates(existing.important_dates, important_dates),
        relationship: existing.relationship || relationship,
        summary: summary || existing.summary,
        last_contacted_at: note.created_at,
      };
      for (const [k, v] of Object.entries(fillIfEmpty)) {
        if (v && !existing[k]) patch[k] = v;
      }

      const { data: updated } = await pgrest('people', {
        method: 'PATCH',
        query: { id: `eq.${existing.id}` },
        body: patch,
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
          likes: uniq(likes),
          dislikes: uniq(dislikes),
          important_dates,
          summary,
          last_contacted_at: note.created_at,
          ...fillIfEmpty,
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

    // Link any confirmed people mentioned in the note.
    for (const m of mentioned_people) {
      if (!m || m.action === 'skip' || !isValidType(m.relationship_to_subject)) continue;
      try {
        let otherId = m.person_id;
        if (m.action === 'create') {
          if (!m.name || !m.name.trim()) continue;
          const { data: rows } = await pgrest('people', {
            method: 'POST',
            body: { name: m.name.trim() },
            prefer: 'return=representation',
          });
          otherId = rows[0].id;
        }
        if (otherId && otherId !== person.id) {
          await createLink(person.id, otherId, m.relationship_to_subject);
        }
      } catch (linkErr) {
        console.error('mentioned-person link failed:', linkErr.message);
      }
    }

    // Keep the birthday reminder in sync if a birthdate was set/changed.
    await syncBirthdayReminder(person).catch((e) => console.error('birthday reminder:', e.message));

    // Optional follow-up reminder the user confirmed from the AI suggestion.
    if (reminder && reminder.message && reminder.due_at && !Number.isNaN(Date.parse(reminder.due_at))) {
      await pgrest('reminders', {
        method: 'POST',
        body: {
          person_id: person.id,
          message: String(reminder.message).trim(),
          due_at: new Date(reminder.due_at).toISOString(),
          recurring: null,
          sent: false,
          kind: 'ai',
        },
      }).catch((e) => console.error('ai reminder:', e.message));
    }

    const { data: full } = await pgrest('people', {
      query: { select: '*,notes(*)', id: `eq.${person.id}`, 'notes.order': 'created_at.desc' },
    });
    res.json(full[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
