export function Spinner({ label = 'Loading…' }) {
  return <p className="py-6 text-center text-sm text-slate-500">{label}</p>;
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="rounded-md bg-red-950/50 px-3 py-2 text-sm text-red-300">
      {String(error.message || error)}
      {onRetry && (
        <button onClick={onRetry} className="ml-2 underline">
          retry
        </button>
      )}
    </div>
  );
}

export function Chip({ children }) {
  return (
    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{children}</span>
  );
}

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Button({ className = '', variant = 'primary', ...props }) {
  const styles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50',
    ghost: 'border border-slate-700 text-slate-300 hover:bg-slate-800',
    danger: 'border border-red-900 text-red-300 hover:bg-red-950/50',
  }[variant];
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${styles} ${className}`}
      {...props}
    />
  );
}

import { useSpeech } from '../lib/useSpeech.js';

/**
 * Mic toggle for dictation. Renders nothing where the browser has no speech API.
 * @param {(chunk: string) => void} props.onText  called with each finalized phrase
 */
export function MicButton({ onText, onListeningChange }) {
  const { supported, listening, error, start, stop } = useSpeech(onText);
  if (!supported) return null;

  function toggle() {
    const next = !listening;
    if (next) start();
    else stop();
    onListeningChange?.(next);
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        title={listening ? 'Stop dictation' : 'Dictate'}
        className={`rounded-md border px-2 py-1.5 text-sm ${
          listening
            ? 'animate-pulse border-red-500 bg-red-950/50 text-red-300'
            : 'border-slate-700 text-slate-300 hover:bg-slate-800'
        }`}
      >
        {listening ? '● Listening' : '🎤'}
      </button>
      {error && <span className="basis-full text-xs text-amber-400">{error}</span>}
    </>
  );
}

export function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none ${props.className || ''}`}
    />
  );
}
