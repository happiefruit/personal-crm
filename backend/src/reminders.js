import { pgrest } from './supabase.js';

/**
 * Next occurrence of a month/day, as an ISO timestamp at 09:00 UTC.
 * Accepts "YYYY-MM-DD" or "0000-MM-DD"; returns null if unparseable.
 * @param {string} dateStr
 * @param {Date} [now]
 */
export function nextYearlyOccurrence(dateStr, now = new Date()) {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return null;
  const month = Number(m[1]) - 1;
  const day = Number(m[2]);
  let year = now.getUTCFullYear();
  const candidate = new Date(Date.UTC(year, month, day, 9));
  if (candidate.getTime() < now.getTime()) {
    year += 1;
  }
  return new Date(Date.UTC(year, month, day, 9)).toISOString();
}

/**
 * Advance a reminder's due date by its recurrence, or null for a one-off.
 * @param {string} dueAtIso
 * @param {string|null} recurring
 */
export function advanceDueDate(dueAtIso, recurring) {
  if (recurring !== 'yearly') return null;
  const d = new Date(dueAtIso);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString();
}

/**
 * Create or update the single yearly birthday reminder for a person.
 * No-ops when the person has no birthdate.
 */
export async function syncBirthdayReminder(person) {
  if (!person?.id) return;
  const due = person.birthdate ? nextYearlyOccurrence(person.birthdate) : null;

  const { data: existing } = await pgrest('reminders', {
    query: { select: 'id', person_id: `eq.${person.id}`, kind: 'eq.birthday' },
  });

  if (!due) {
    // birthdate cleared — drop the auto reminder
    if (existing.length) {
      await pgrest('reminders', { method: 'DELETE', query: { id: `eq.${existing[0].id}` } });
    }
    return;
  }

  const body = {
    person_id: person.id,
    message: `🎂 ${person.name}'s birthday`,
    due_at: due,
    recurring: 'yearly',
    sent: false,
    kind: 'birthday',
  };

  if (existing.length) {
    await pgrest('reminders', {
      method: 'PATCH',
      query: { id: `eq.${existing[0].id}` },
      body: { message: body.message, due_at: body.due_at, sent: false },
    });
  } else {
    await pgrest('reminders', { method: 'POST', body });
  }
}
