import { useEffect, useState } from 'react';
import { api, API_URL } from '../lib/api.js';
import { getPasscode, setPasscode, onSessionChange } from '../lib/session.js';
import { Button, ErrorNote, TextInput } from './ui.jsx';

function LockScreen() {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.verifyPasscode(value.trim()); // throws on 401
      setPasscode(value.trim());
    } catch (err) {
      setError(err.status === 401 ? new Error('Wrong passcode') : err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-lg font-semibold">Personal CRM</h1>
      <p className="mt-1 text-sm text-slate-400">Enter your passcode to continue.</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <TextInput
          type="password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Passcode"
        />
        <Button type="submit" disabled={busy || !value.trim()} className="w-full">
          {busy ? 'Checking…' : 'Unlock'}
        </Button>
        <ErrorNote error={error} />
      </form>
      <p className="mt-6 text-xs text-slate-600">API: {API_URL}</p>
    </div>
  );
}

export default function PasscodeGate({ children }) {
  const [code, setCode] = useState(getPasscode());
  const [required, setRequired] = useState(null); // null = unknown yet

  useEffect(() => onSessionChange(setCode), []);

  // Does this backend even require a passcode? (dev may run without one)
  useEffect(() => {
    api
      .get('/api/health')
      .then((h) => setRequired(Boolean(h.auth_required)))
      .catch(() => setRequired(true));
  }, []);

  if (required === false) return children;
  if (required === null && !code) {
    return <p className="p-6 text-sm text-slate-500">Connecting…</p>;
  }
  if (!code) return <LockScreen />;
  return children;
}
