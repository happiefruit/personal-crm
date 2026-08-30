import { describe, it, expect } from 'vitest';
import { buildTranscript } from './useSpeech.js';

const mk = (phrases) => phrases.map((t) => ({ isFinal: true, 0: { transcript: t } }));

describe('buildTranscript', () => {
  it('collapses Samsung Internet progressive prefixes to the longest', () => {
    const results = mk([
      'my',
      'my youngest',
      'my youngest sister',
      'my youngest sister works',
      'my youngest sister works in Golf Tech',
    ]);
    expect(buildTranscript(results)).toBe('my youngest sister works in Golf Tech');
  });

  it('joins genuinely distinct phrases', () => {
    const results = mk(['I saw Dana today', 'she got a new job at Acme']);
    expect(buildTranscript(results)).toBe('I saw Dana today she got a new job at Acme');
  });

  it('ignores interim (non-final) results', () => {
    const results = [
      { isFinal: false, 0: { transcript: 'call m' } },
      { isFinal: true, 0: { transcript: 'call mom on friday' } },
    ];
    expect(buildTranscript(results)).toBe('call mom on friday');
  });

  it('empty for no final results', () => {
    expect(buildTranscript(mk([]))).toBe('');
  });
});
