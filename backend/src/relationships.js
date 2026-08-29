import { pgrest } from './supabase.js';
import { INVERSE, isValidType } from './relationshipTypes.js';

/**
 * Create a link between two people, plus its inverse row. Idempotent.
 * @returns {Promise<void>}
 */
export async function createLink(fromId, toId, type) {
  if (fromId === toId) throw new Error('cannot link a person to themselves');
  if (!isValidType(type)) throw new Error(`unknown relationship type: ${type}`);

  await pgrest('relationships', {
    method: 'POST',
    body: [
      { from_person_id: fromId, to_person_id: toId, type },
      { from_person_id: toId, to_person_id: fromId, type: INVERSE[type] },
    ],
    prefer: 'resolution=merge-duplicates',
  });
}

/**
 * Delete a link by row id, plus its mirror row.
 * @returns {Promise<boolean>} whether a row was found
 */
export async function deleteLink(id) {
  const { data } = await pgrest('relationships', { query: { select: '*', id: `eq.${id}` } });
  if (!data.length) return false;
  const row = data[0];

  await pgrest('relationships', { method: 'DELETE', query: { id: `eq.${id}` } });
  await pgrest('relationships', {
    method: 'DELETE',
    query: {
      from_person_id: `eq.${row.to_person_id}`,
      to_person_id: `eq.${row.from_person_id}`,
      type: `eq.${INVERSE[row.type] || row.type}`,
    },
  });
  return true;
}

/**
 * Relationships for one person, with the other person's name attached.
 * @returns {Promise<Array<{id,type,person:{id,name}}>>}
 */
export async function linksForPerson(personId) {
  const { data: rows } = await pgrest('relationships', {
    query: { select: 'id,type,to_person_id', from_person_id: `eq.${personId}` },
  });
  if (!rows.length) return [];

  const ids = [...new Set(rows.map((r) => r.to_person_id))];
  const { data: people } = await pgrest('people', {
    query: { select: 'id,name', id: `in.(${ids.join(',')})` },
  });
  const byId = new Map(people.map((p) => [p.id, p]));

  return rows
    .map((r) => ({ id: r.id, type: r.type, person: byId.get(r.to_person_id) || null }))
    .filter((r) => r.person)
    .sort((a, b) => a.type.localeCompare(b.type) || a.person.name.localeCompare(b.person.name));
}
