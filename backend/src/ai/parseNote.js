import Anthropic from '@anthropic-ai/sdk';
import { TYPES, isValidType } from '../relationshipTypes.js';

export const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY);

const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';
const client = aiConfigured ? new Anthropic() : null;

// Structured extraction via a single forced tool call — the most reliable
// structured-output method across every model, including Haiku.
const TOOL = {
  name: 'file_note',
  description: 'Record the structured analysis of a personal note about someone.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      person_match: {
        type: 'string',
        enum: ['existing', 'new'],
        description: 'Whether this note is about someone already in the list provided.',
      },
      matched_person_id: {
        type: ['string', 'null'],
        description: 'The id of the matched person when person_match is "existing", else null.',
      },
      name: {
        type: 'string',
        description: 'Best full name for the person (existing name, or the name from the note).',
      },
      relationship_guess: {
        type: ['string', 'null'],
        description: 'e.g. "friend", "coworker", "family", "partner" — null if unclear.',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Short freeform tags implied by the note (interests, context). May be empty.',
      },
      birthdate: {
        type: ['string', 'null'],
        description:
          'Birthday as ISO YYYY-MM-DD. Use 0000 for the year when only month/day are known. null if not mentioned.',
      },
      pronouns: {
        type: ['string', 'null'],
        description: 'Pronouns or gender, only if the note makes them clear. Usually null.',
      },
      how_we_met: {
        type: ['string', 'null'],
        description: 'Short phrase on how the note-writer knows this person, if stated. Usually null.',
      },
      job_title: { type: ['string', 'null'], description: 'Their role/title, if stated.' },
      company: { type: ['string', 'null'], description: 'Where they work, if stated.' },
      location: { type: ['string', 'null'], description: 'City/area they live in, if stated.' },
      likes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Things they like/enjoy, stated in the note. Short items. May be empty.',
      },
      dislikes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Things they dislike/avoid, stated in the note. May be empty.',
      },
      important_dates: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: { type: 'string', description: 'e.g. "birthday", "anniversary"' },
            date: { type: 'string', description: 'ISO date YYYY-MM-DD; use 0000 for year if unknown' },
          },
          required: ['label', 'date'],
        },
        description: 'Dates worth remembering that appear in the note. Usually empty.',
      },
      facts: {
        type: 'array',
        items: { type: 'string' },
        description: 'Atomic facts learned from THIS note, each a short sentence.',
      },
      summary: {
        type: 'string',
        description:
          "Rewritten rolling summary of who this person is, folding in the new facts. " +
          '2-4 sentences. If updating an existing person, revise their current summary rather than replacing it wholesale.',
      },
      mentioned_people: {
        type: 'array',
        description:
          'OTHER people named in the note whose tie to the main person is explicit ' +
          '("her husband Marco", "my manager Dana"). Do not include the main person. Usually empty.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string' },
            relationship_to_subject: {
              type: ['string', 'null'],
              description: `What this person is to the main person. One of: ${TYPES.join(', ')}. null if unclear.`,
            },
            matched_person_id: {
              type: ['string', 'null'],
              description: 'id from the people-on-file list if this is clearly one of them, else null.',
            },
          },
          required: ['name', 'relationship_to_subject', 'matched_person_id'],
        },
      },
      reminder_suggestion: {
        type: ['object', 'null'],
        additionalProperties: false,
        properties: {
          message: { type: 'string', description: 'Short imperative, e.g. "Text Priya good luck".' },
          due_hint: {
            type: 'string',
            description: 'Natural-language timing from the note, e.g. "next week", "after her surgery".',
          },
          due_at: {
            type: ['string', 'null'],
            description:
              'Concrete date resolved from due_hint and today\'s date, as YYYY-MM-DD. null if the note gives no usable timing (e.g. "after her surgery").',
          },
        },
        required: ['message', 'due_hint', 'due_at'],
        description: 'Set only if the note contains something clearly time-sensitive to follow up on.',
      },
    },
    required: [
      'person_match',
      'matched_person_id',
      'name',
      'relationship_guess',
      'tags',
      'birthdate',
      'pronouns',
      'how_we_met',
      'job_title',
      'company',
      'location',
      'likes',
      'dislikes',
      'important_dates',
      'facts',
      'summary',
      'mentioned_people',
      'reminder_suggestion',
    ],
  },
};

function systemPrompt(subject) {
  const dateLine = `Today's date is ${new Date().toISOString().slice(0, 10)} — use it to resolve relative dates
("next week", "Nov 16", "her birthday") to concrete ISO dates. If a date's year is genuinely
unknown (e.g. a birthday with no year), use 0000 for the year.`;

  const common = `Never invent facts that aren't supported by the note. Only fill a structured field
(birthdate, pronouns, how_we_met, job_title, company, location, likes, dislikes) when the
note clearly states it about the right person — otherwise leave it null or empty.
Keep tags, likes, dislikes and facts short.
When the note mentions OTHER people with an explicit tie ("her husband", "my manager Dana"),
put them in mentioned_people; never fold their job/details into the main person's fields.
If someone is referred to only by role with no name ("my dad", "her manager"), use a short
human name like "Dad" or "Manager" — never "<UNKNOWN>", "?", or an empty name.`;

  if (subject) {
    return `You are updating the profile of ${subject.name} (id ${subject.id}) from a short note.
${dateLine}

Every top-level field (name, relationship_guess, tags, birthdate, pronouns, how_we_met,
job_title, company, location, likes, dislikes, important_dates, facts, summary) must describe
${subject.name} SPECIFICALLY. Set person_match to "existing" and matched_person_id to ${subject.id};
keep name as "${subject.name}".
If the note is actually about someone else (e.g. "Samantha is her sister and teaches at X"),
that other person goes in mentioned_people with their relationship_to_subject, and you leave
${subject.name}'s fields null/empty unless the note genuinely states something about ${subject.name}.
The summary should be a revised rolling summary of ${subject.name} — if the note adds nothing
about them, return their existing summary unchanged.
${common}`;
  }

  return `You clean up and file short personal notes about people in someone's life.
${dateLine}
You are given the raw note plus a list of people already on file (id, name, aliases, relationship, short summary).
Decide if the note is about one of those people (fuzzy-match names, nicknames, and context) or someone new,
then extract structured details. Be conservative: only mark "existing" when you are fairly confident.
${common}`;
}

function buildPeopleContext(people) {
  if (!people?.length) return 'No people on file yet.';
  return people
    .map((p) => {
      const aliases = (p.aliases || []).join(', ');
      const summary = (p.summary || '').slice(0, 200);
      return [
        `- id: ${p.id}`,
        `  name: ${p.name}`,
        aliases && `  aliases: ${aliases}`,
        p.relationship && `  relationship: ${p.relationship}`,
        summary && `  summary: ${summary}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');
}

/**
 * @param {object} args
 * @param {string} args.rawText
 * @param {Array<{id,name,aliases,relationship,summary}>} args.people
 * @param {{id,name}|null} [args.subjectPerson]  when set, the note is being filed on this
 *   person's profile — top-level fields must describe them, others go to mentioned_people
 * @returns {Promise<{ suggestion: object, usage: object }>}
 */
export async function parseNote({ rawText, people, subjectPerson = null }) {
  if (!client) throw new Error('ANTHROPIC_API_KEY not set');

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt(subjectPerson),
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'file_note' },
    messages: [
      {
        role: 'user',
        content: `People already on file:\n${buildPeopleContext(people)}\n\n--- RAW NOTE ---\n${rawText}`,
      },
    ],
  });

  const block = msg.content.find((b) => b.type === 'tool_use' && b.name === 'file_note');
  if (!block) throw new Error('AI did not return a structured result');

  let suggestion = promoteBirthday(normalize(block.input));
  if (subjectPerson) {
    suggestion = { ...suggestion, person_match: 'existing', matched_person_id: subjectPerson.id };
  }
  return { suggestion, usage: msg.usage, model: MODEL };
}

// If the model filed the birthday under important_dates instead of birthdate, move it.
export function promoteBirthday(s) {
  if (s.birthdate) return s;
  const i = s.important_dates.findIndex((d) => /\bbirth\s*day\b|\bbirthday\b/i.test(d.label));
  if (i === -1) return s;
  const [bd] = s.important_dates.splice(i, 1);
  return { ...s, birthdate: bd.date };
}

// Defensive coercion — never trust the shape completely.
export function normalize(raw) {
  const s = raw || {};
  const validId = s.person_match === 'existing' && typeof s.matched_person_id === 'string';
  const str = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());
  const list = (v) =>
    Array.isArray(v) ? v.map(String).map((x) => x.trim()).filter(Boolean) : [];
  return {
    person_match: s.person_match === 'existing' ? 'existing' : 'new',
    matched_person_id: validId ? s.matched_person_id : null,
    name: String(s.name || '').trim(),
    relationship_guess: s.relationship_guess ? String(s.relationship_guess).trim() : null,
    tags: list(s.tags),
    birthdate: str(s.birthdate),
    pronouns: str(s.pronouns),
    how_we_met: str(s.how_we_met),
    job_title: str(s.job_title),
    company: str(s.company),
    location: str(s.location),
    likes: list(s.likes),
    dislikes: list(s.dislikes),
    important_dates: Array.isArray(s.important_dates)
      ? s.important_dates
          .filter((d) => d && d.label && d.date)
          .map((d) => ({ label: String(d.label), date: String(d.date) }))
      : [],
    facts: Array.isArray(s.facts) ? s.facts.map(String).map((f) => f.trim()).filter(Boolean) : [],
    summary: String(s.summary || '').trim(),
    mentioned_people: Array.isArray(s.mentioned_people)
      ? s.mentioned_people
          .filter((m) => m && m.name && String(m.name).trim())
          .map((m) => ({
            name: String(m.name).trim(),
            relationship_to_subject: isValidType(m.relationship_to_subject)
              ? m.relationship_to_subject
              : null,
            matched_person_id: typeof m.matched_person_id === 'string' ? m.matched_person_id : null,
          }))
      : [],
    reminder_suggestion:
      s.reminder_suggestion && s.reminder_suggestion.message
        ? {
            message: String(s.reminder_suggestion.message),
            due_hint: String(s.reminder_suggestion.due_hint || ''),
            due_at: /^\d{4}-\d{2}-\d{2}$/.test(s.reminder_suggestion.due_at || '')
              ? s.reminder_suggestion.due_at
              : null,
          }
        : null,
  };
}
