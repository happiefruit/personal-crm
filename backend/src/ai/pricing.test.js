import { describe, it, expect } from 'vitest';
import { estimateCost } from './pricing.js';

describe('estimateCost', () => {
  it('prices Haiku input and output per MTok', () => {
    expect(estimateCost('claude-haiku-4-5', { input_tokens: 1_000_000 }).cost).toBeCloseTo(1);
    expect(estimateCost('claude-haiku-4-5', { output_tokens: 1_000_000 }).cost).toBeCloseTo(5);
  });

  it('adds cache reads/writes on top of input_tokens', () => {
    const c = estimateCost('claude-haiku-4-5', {
      input_tokens: 1000,
      output_tokens: 300,
      cache_read_input_tokens: 500,
    });
    // (1000*1 + 300*5 + 500*0.1) / 1e6
    expect(c.cost).toBeCloseTo(0.00255, 6);
    expect(c.input).toBe(1000);
    expect(c.cache_read).toBe(500);
  });

  it('falls back to Haiku pricing for an unknown model', () => {
    expect(estimateCost('some-future-model', { input_tokens: 1_000_000 }).cost).toBeCloseTo(1);
  });

  it('handles a missing usage object', () => {
    expect(estimateCost('claude-haiku-4-5').cost).toBe(0);
  });
});
