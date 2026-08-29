// Allowed relationship types and their inverse.
// `type` on a row describes what to_person is to from_person.
// The inverse is what from_person is to to_person.

export const INVERSE = {
  spouse: 'spouse',
  partner: 'partner',
  ex: 'ex',
  sibling: 'sibling',
  friend: 'friend',
  colleague: 'colleague',
  relative: 'relative',
  parent: 'child',
  child: 'parent',
  grandparent: 'grandchild',
  grandchild: 'grandparent',
  manager: 'report',
  report: 'manager',
};

export const TYPES = Object.keys(INVERSE);

export function isValidType(t) {
  return Object.prototype.hasOwnProperty.call(INVERSE, t);
}
