// USD per 1,000,000 tokens. Anthropic first-party rates (see the Anthropic
// pricing page). Update here if rates change. Cache read ≈ 0.1× input,
// cache write ≈ 1.25× input.
const PRICING = {
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
};

const FALLBACK = PRICING['claude-haiku-4-5'];

/**
 * Estimate the USD cost of one Anthropic call from its `usage` object.
 * Anthropic reports cache reads/writes separately from `input_tokens`, so they
 * are summed here, not double-counted.
 * @param {string} model
 * @param {object} usage  the SDK response `usage`
 * @returns {{ cost: number, input: number, output: number, cache_read: number, cache_write: number }}
 */
export function estimateCost(model, usage = {}) {
  const p = PRICING[model] || FALLBACK;
  const input = usage.input_tokens || 0;
  const output = usage.output_tokens || 0;
  const cache_read = usage.cache_read_input_tokens || 0;
  const cache_write = usage.cache_creation_input_tokens || 0;
  const cost =
    (input * p.input + output * p.output + cache_read * p.cacheRead + cache_write * p.cacheWrite) /
    1_000_000;
  return { cost, input, output, cache_read, cache_write };
}
