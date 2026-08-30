import { describe, it, expect } from 'vitest';
import { INVERSE, TYPES, isValidType } from './relationshipTypes.js';

describe('relationship inverse map', () => {
  it('every type has an inverse that is itself a valid type', () => {
    for (const t of TYPES) {
      expect(isValidType(INVERSE[t]), `inverse of ${t}`).toBe(true);
    }
  });

  it('inverting twice returns the original type', () => {
    for (const t of TYPES) {
      expect(INVERSE[INVERSE[t]], `double-inverse of ${t}`).toBe(t);
    }
  });

  it('known pairs map correctly', () => {
    expect(INVERSE.parent).toBe('child');
    expect(INVERSE.child).toBe('parent');
    expect(INVERSE.manager).toBe('report');
    expect(INVERSE.spouse).toBe('spouse');
    expect(INVERSE.sibling).toBe('sibling');
  });

  it('rejects unknown types', () => {
    expect(isValidType('bestie')).toBe(false);
    expect(isValidType(null)).toBe(false);
    expect(isValidType(undefined)).toBe(false);
  });
});
