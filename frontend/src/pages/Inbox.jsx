import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { formatDateTime } from '../lib/format.js';
import { Button, Card, ErrorNote, Spinner } from '../components/ui.jsx';

function AssignRow({ note, people, onDone }) {
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);

  async function assign() {
    if (!target) return;
    setBusy(true);
    try {
      await api.patch(`/api/notes/${note.id}`, { person_id: target });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-2">
      <div className="text-xs text-slate-500">{formatDateTime(note.created_at)}</div>
      <p className="whitespace-pre-wrap text-sm text-slate-200">{note.raw_text}</p>
      <div className="flex gap-2">
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
        >
          <option value="">File under…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button onClick={assign} disabled={!target || busy}>
          {busy ? '…' : 'File'}
        </Button>
      </div>
    </Card>
  );
}

export default function Inbox() {
  const state = useAsync(
    () => Promise.all([api.get('/api/notes'), api.get('/api/people')]),
    [],
  );
  const { data, error, loading, reload } = state;
  const [notes, people] = data || [[], []];
  const unfiled = notes.filter((n) => !n.person_id);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        Inbox <span className="text-xs text-slate-500">({unfiled.length} unfiled)</span>
      </h2>
      <ErrorNote error={error} onRetry={reload} />
      {loading && <Spinner />}
      {data && !unfiled.length && (
        <p className="py-6 text-center text-sm text-slate-500">Nothing unfiled. 🎉</p>
      )}
      {unfiled.map((n) => (
        <AssignRow key={n.id} note={n} people={people} onDone={reload} />
      ))}
    </div>
  );
}
