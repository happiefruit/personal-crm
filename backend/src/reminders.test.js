import { describe, it, expect } from 'vitest';
import { nextYearlyOccurrence, advanceDueDate } from './reminders.js';

describe('nextYearlyOccurrence', () => {
  const now = new Date('2026-08-29T12:00:00Z');

  it('picks this year when the date is still ahead', () => {
    expect(nextYearlyOccurrence('1990-12-25', now)).toBe('2026-12-25T09:00:00.000Z');
  });

  it('rolls to next year when the date has passed', () => {
    expect(nextYearlyOccurrence('1990-01-01', now)).toBe('2027-01-01T09:00:00.000Z');
  });

  it('works with year-unknown birthdates', () => {
    expect(nextYearlyOccurrence('0000-09-15', now)).toBe('2026-09-15T09:00:00.000Z');
  });

  it('null for unparseable input', () => {
    expect(nextYearlyOccurrence('')).toBeNull();
    expect(nextYearlyOccurrence('next tuesday')).toBeNull();
  });
});

describe('advanceDueDate', () => {
  it('adds a year for yearly', () => {
    expect(advanceDueDate('2026-03-03T09:00:00.000Z', 'yearly')).toBe('2027-03-03T09:00:00.000Z');
  });
  it('null (complete) for a one-off', () => {
    expect(advanceDueDate('2026-03-03T09:00:00.000Z', null)).toBeNull();
  });
});
