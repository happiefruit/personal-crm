import { useCallback, useEffect, useRef, useState } from 'react';

const SR =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

// Collapse a SpeechRecognitionResultList into one string.
// Samsung Internet emits a chain of growing prefixes for a single utterance
// ("my", "my youngest", "my youngest sister"…); keep only the longest of each
// chain so the phrase isn't repeated.
export function buildTranscript(results) {
  const phrases = [];
  let cur = '';
  for (let i = 0; i < results.length; i += 1) {
    const r = results[i];
    if (!r || !r.isFinal) continue;
    const t = (r[0]?.transcript || '').trim();
    if (!t) continue;
    if (cur && (t.startsWith(cur) || cur.startsWith(t))) {
      cur = t.length >= cur.length ? t : cur;
    } else {
      if (cur) phrases.push(cur);
      cur = t;
    }
  }
  if (cur) phrases.push(cur);
  return phrases.join(' ');
}

/**
 * In-browser speech-to-text.
 * @param {(fullTranscript: string) => void} onTranscript  the whole session's text so far
 */
export function useSpeech(onTranscript) {
  const supported = Boolean(SR);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const cbRef = useRef(onTranscript);
  cbRef.current = onTranscript;

  useEffect(() => {
    if (!supported) return undefined;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = navigator.language || 'en-US';

    rec.onresult = (e) => {
      const text = buildTranscript(e.results);
      if (text) cbRef.current?.(text);
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      const messages = {
        'not-allowed': 'Microphone permission denied',
        'service-not-allowed': 'Microphone permission denied',
        network: "Voice typing isn't available in this browser — try Chrome, or the app on your phone",
        'language-not-supported': 'This language isn’t supported for voice typing',
      };
      setError(messages[e.error] || `Voice error: ${e.error}`);
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    };
  }, [supported]);

  const start = useCallback(() => {
    if (!recRef.current || listening) return;
    setError(null);
    try {
      recRef.current.start();
      setListening(true);
    } catch {
      /* already started */
    }
  }, [listening]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  return { supported, listening, error, start, stop };
}
