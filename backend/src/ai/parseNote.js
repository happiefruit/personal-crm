import Anthropic from '@anthropic-ai/sdk';

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
      reminder_suggestion: {
        type: ['object', 'null'],
        additionalProperties: false,
        properties: {
          message: { type: 'string' },
          due_hint: {
            type: 'string',
            description: 'Natural-language timing from the note, e.g. "next week", "after her surgery".',
          },
        },
        required: ['message', 'due_hint'],
        description: 'Set only if the note contains something clearly time-sensitive to follow up on.',
      },
    },
    required: [
      'person_match',
      'matched_person_id',
      'name',
      'relationship_guess',
      'tags',
      'important_dates',
      'facts',
      'summary',
      'reminder_suggestion',
    ],
  },
};

function systemPrompt() {
  return `You clean up and file short personal notes about people in someone's life.
Today's date is ${new Date().toISOString().slice(0, 10)} — use it to resolve relative dates
("next week", "Nov 16", "her birthday") to concrete ISO dates. If a date's year is genuinely
unknown (e.g. a birthday with no year), use 0000 for the year.
You are given the raw note plus a list of people already on file (id, name, aliases, relationship, short summary).
Decide if the note is about one of those people (fuzzy-match names, nicknames, and context) or someone new,
then extract structured details. Be conservative: only mark "existing" when you are fairly confident.
Never invent facts that aren't supported by the note. Keep tags and facts short.`;
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
 * @param {{ rawText: string, people: Array<{id,name,aliases,relationship,summary}> }} args
 * @returns {Promise<{ suggestion: object, usage: object }>}
 */
export async function parseNote({ rawText, people }) {
  if (!client) throw new Error('ANTHROPIC_API_KEY not set');

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt(),
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

  return { suggestion: normalize(block.input), usage: msg.usage };
}

// Defensive coercion — never trust the shape completely.
function normalize(raw) {
  const s = raw || {};
  const validId = s.person_match === 'existing' && typeof s.matched_person_id === 'string';
  return {
    person_match: s.person_match === 'existing' ? 'existing' : 'new',
    matched_person_id: validId ? s.matched_person_id : null,
    name: String(s.name || '').trim(),
    relationship_guess: s.relationship_guess ? String(s.relationship_guess).trim() : null,
    tags: Array.isArray(s.tags) ? s.tags.map(String).map((t) => t.trim()).filter(Boolean) : [],
    important_dates: Array.isArray(s.important_dates)
      ? s.important_dates
          .filter((d) => d && d.label && d.date)
          .map((d) => ({ label: String(d.label), date: String(d.date) }))
      : [],
    facts: Array.isArray(s.facts) ? s.facts.map(String).map((f) => f.trim()).filter(Boolean) : [],
    summary: String(s.summary || '').trim(),
    reminder_suggestion:
      s.reminder_suggestion && s.reminder_suggestion.message
        ? {
            message: String(s.reminder_suggestion.message),
            due_hint: String(s.reminder_suggestion.due_hint || ''),
          }
        : null,
  };
}
