import { useCallback, useEffect, useRef, useState } from 'react';

const SR =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

/**
 * In-browser speech-to-text. Finalized phrases are handed to `onFinal(text)`.
 * @param {(text: string) => void} onFinal
 */
export function useSpeech(onFinal) {
  const supported = Boolean(SR);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  // How many entries of `event.results` we've already emitted. Samsung Internet
  // (and some Android Chrome builds) re-fire onresult for an already-final result
  // multiple times — without this guard the phrase gets appended 2-3x.
  const emittedRef = useRef(0);

  useEffect(() => {
    if (!supported) return undefined;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';

    rec.onresult = (e) => {
      for (let i = emittedRef.current; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (!r.isFinal) break; // results finalize in order; stop at the first interim
        const text = (r[0]?.transcript || '').trim();
        if (text) onFinalRef.current?.(text);
        emittedRef.current = i + 1;
      }
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
    emittedRef.current = 0; // fresh session -> results list restarts at 0
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
