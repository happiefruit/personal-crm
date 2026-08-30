import { describe, it, expect } from 'vitest';
import { uniq, mergeDates } from './merge.js';

describe('uniq', () => {
  it('dedupes and drops falsy', () => {
    expect(uniq(['a', 'b', 'a', '', null, 'b'])).toEqual(['a', 'b']);
  });
  it('handles missing input', () => {
    expect(uniq()).toEqual([]);
  });
});

describe('mergeDates', () => {
  it('unions by case-insensitive label, incoming wins', () => {
    const current = [{ label: 'birthday', date: '0000-01-01' }];
    const incoming = [
      { label: 'Birthday', date: '1990-01-01' },
      { label: 'anniversary', date: '2015-06-06' },
    ];
    const out = mergeDates(current, incoming);
    expect(out).toHaveLength(2);
    expect(out.find((d) => d.label.toLowerCase() === 'birthday').date).toBe('1990-01-01');
    expect(out.find((d) => d.label === 'anniversary').date).toBe('2015-06-06');
  });
  it('tolerates empty / malformed entries', () => {
    expect(mergeDates(undefined, [{ date: 'x' }, null])).toEqual([]);
  });
});
