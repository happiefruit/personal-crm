import { useCallback, useEffect, useState } from 'react';
import { apiGet, API_URL } from './lib/api.js';

function StatusDot({ ok }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${
        ok === null ? 'bg-slate-500' : ok ? 'bg-emerald-400' : 'bg-red-400'
      }`}
    />
  );
}

function Row({ label, ok, detail }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-slate-300">{label}</span>
      <span className="flex items-center gap-2 text-sm">
        {detail && <span className="text-slate-500">{detail}</span>}
        <StatusDot ok={ok} />
      </span>
    </div>
  );
}

export default function App() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHealth(await apiGet('/api/health'));
    } catch (err) {
      setError(err.message);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const backendOk = health ? health.backend === 'ok' : error ? false : null;
  const dbOk = health ? health.database === 'ok' : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 py-10">
      <header>
        <h1 className="text-2xl font-semibold">Personal CRM</h1>
        <p className="mt-1 text-sm text-slate-400">Scaffold — step 1 of the build order</p>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">System health</h2>
          <button
            onClick={load}
            className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            {loading ? 'Checking…' : 'Refresh'}
          </button>
        </div>

        <div className="mt-2 divide-y divide-slate-800">
          <Row label="Frontend" ok={true} detail="loaded" />
          <Row
            label="Backend API"
            ok={backendOk}
            detail={error ? 'unreachable' : health ? 'ok' : ''}
          />
          <Row
            label="Database"
            ok={dbOk}
            detail={health ? health.database_detail : ''}
          />
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-red-950/50 px-3 py-2 text-xs text-red-300">
            {error} — is the backend running at {API_URL}?
          </p>
        )}
      </section>

      <p className="text-xs text-slate-600">
        API: {API_URL}
        {health?.time ? ` · checked ${new Date(health.time).toLocaleTimeString()}` : ''}
      </p>
    </div>
  );
}
