// Small pure helpers for the non-destructive merge in /api/ai/apply.

/** Distinct, falsy-stripped. */
export function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

/**
 * Merge two lists of { label, date }, keyed case-insensitively by label.
 * Incoming entries win over current ones.
 */
export function mergeDates(current = [], incoming = []) {
  const byLabel = new Map();
  for (const d of current) if (d && d.label) byLabel.set(String(d.label).toLowerCase(), d);
  for (const d of incoming) if (d && d.label) byLabel.set(String(d.label).toLowerCase(), d);
  return [...byLabel.values()];
}
