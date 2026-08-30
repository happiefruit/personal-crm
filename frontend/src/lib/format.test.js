import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeAge, formatDate, relativeTime, daysSince } from './format.js';

afterEach(() => vi.useRealTimers());

describe('computeAge', () => {
  it('returns null when the year is unknown or missing', () => {
    expect(computeAge('0000-06-12')).toBeNull();
    expect(computeAge(null)).toBeNull();
    expect(computeAge('not-a-date')).toBeNull();
  });

  it('computes whole years, accounting for whether the birthday has passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T12:00:00Z'));
    expect(computeAge('2000-01-01')).toBe(26); // birthday passed this year
    expect(computeAge('2000-12-31')).toBe(25); // not yet
  });
});

describe('formatDate', () => {
  it('renders a year-less date as month + day only', () => {
    expect(formatDate('0000-03-03')).toMatch(/Mar\s*3/);
  });
  it('empty for missing', () => {
    expect(formatDate('')).toBe('');
  });
});

describe('relativeTime / daysSince', () => {
  it('never for missing', () => {
    expect(relativeTime(null)).toBe('never');
    expect(daysSince(null)).toBe(Infinity);
  });
  it('today for a recent timestamp', () => {
    expect(relativeTime(new Date().toISOString())).toBe('today');
  });
});
