import { describe, it, expect } from 'vitest';
import { normalize, promoteBirthday } from './parseNote.js';

describe('normalize', () => {
  it('coerces a well-formed suggestion', () => {
    const out = normalize({
      person_match: 'existing',
      matched_person_id: 'abc',
      name: '  Sam  ',
      relationship_guess: 'friend',
      tags: ['a', ' b ', ''],
      birthdate: '0000-06-12',
      pronouns: '  ',
      likes: ['x'],
      dislikes: [],
      important_dates: [{ label: 'anniversary', date: '2015-01-01' }],
      facts: ['f1', ''],
      summary: ' hi ',
      mentioned_people: [{ name: 'Marco', relationship_to_subject: 'spouse', matched_person_id: null }],
      reminder_suggestion: null,
    });
    expect(out.name).toBe('Sam');
    expect(out.tags).toEqual(['a', 'b']);
    expect(out.pronouns).toBeNull();
    expect(out.facts).toEqual(['f1']);
    expect(out.mentioned_people[0].relationship_to_subject).toBe('spouse');
  });

  it('drops an invalid person match id', () => {
    const out = normalize({ person_match: 'existing', matched_person_id: 42 });
    expect(out.matched_person_id).toBeNull();
  });

  it('drops an unknown mentioned-person relationship type', () => {
    const out = normalize({
      mentioned_people: [{ name: 'X', relationship_to_subject: 'nemesis', matched_person_id: null }],
    });
    expect(out.mentioned_people[0].relationship_to_subject).toBeNull();
  });

  it('never throws on garbage', () => {
    expect(() => normalize(null)).not.toThrow();
    expect(() => normalize({ tags: 'nope', facts: 5 })).not.toThrow();
  });
});

describe('promoteBirthday', () => {
  it('moves a birthday from important_dates into birthdate', () => {
    const out = promoteBirthday({
      birthdate: null,
      important_dates: [{ label: 'Birthday', date: '0000-03-03' }],
    });
    expect(out.birthdate).toBe('0000-03-03');
    expect(out.important_dates).toHaveLength(0);
  });

  it('leaves an explicit birthdate alone', () => {
    const out = promoteBirthday({
      birthdate: '1990-01-01',
      important_dates: [{ label: 'birthday', date: '0000-03-03' }],
    });
    expect(out.birthdate).toBe('1990-01-01');
    expect(out.important_dates).toHaveLength(1);
  });

  it('keeps non-birthday dates', () => {
    const out = promoteBirthday({
      birthdate: null,
      important_dates: [{ label: 'anniversary', date: '2015-06-06' }],
    });
    expect(out.birthdate).toBeNull();
    expect(out.important_dates).toHaveLength(1);
  });
});
