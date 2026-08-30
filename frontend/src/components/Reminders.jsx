import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { formatDate, formatDue } from '../lib/format.js';
import { Button, Card, ErrorNote, Spinner, TextInput } from './ui.jsx';

function isOverdue(iso) {
  return new Date(iso).getTime() < Date.now();
}

/**
 * Reminders for one person (personId set) or the whole upcoming list (personId omitted).
 */
export default function Reminders({ personId }) {
  const scope = personId ? 'all' : 'upcoming';
  const path = personId
    ? `/api/reminders?person_id=${personId}&scope=all`
    : `/api/reminders?scope=upcoming&days=45`;
  const { data, error, loading, reload } = useAsync(() => api.get(path), [path]);

  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const reminders = (data || []).filter((r) => !r.sent);

  // On the dashboard, stay out of the way when there's nothing upcoming.
  if (!personId && data && reminders.length === 0) return null;

  async function add() {
    if (!message.trim() || !dueAt) return;
    setBusy(true);
    setFormError(null);
    try {
      await api.post('/api/reminders', {
        person_id: personId || null,
        message: message.trim(),
        due_at: dueAt,
        recurring: recurring ? 'yearly' : null,
      });
      setMessage('');
      setDueAt('');
      setRecurring(false);
      setAdding(false);
      reload();
    } catch (err) {
      setFormError(err);
    } finally {
      setBusy(false);
    }
  }

  async function complete(r) {
    await api.patch(`/api/reminders/${r.id}`, { done: true });
    reload();
  }
  async function remove(r) {
    if (!confirm('Delete this reminder?')) return;
    await api.del(`/api/reminders/${r.id}`);
    reload();
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{personId ? 'Reminders' : 'Upcoming'}</h3>
        {personId && !adding && (
          <Button variant="ghost" onClick={() => setAdding(true)}>
            + Add
          </Button>
        )}
      </div>

      <ErrorNote error={error} onRetry={reload} />
      {loading && <Spinner />}

      {data && reminders.length === 0 && !adding && (
        <p className="text-sm text-slate-500">{personId ? 'None set.' : 'Nothing coming up.'}</p>
      )}

      <ul className="divide-y divide-slate-800">
        {reminders.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-2 py-2 text-sm">
            <div>
              <div className="text-slate-200">{r.message}</div>
              <div className="text-xs">
                <span className={isOverdue(r.due_at) ? 'text-red-400' : 'text-slate-500'}>
                  {formatDate(r.due_at)} · {formatDue(r.due_at)}
                </span>
                {r.recurring === 'yearly' && <span className="text-slate-600"> · yearly</span>}
                {!personId && r.people && (
                  <span className="text-slate-600"> · {r.people.name}</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-2 text-xs">
              <button onClick={() => complete(r)} className="text-emerald-400 hover:underline">
                {r.recurring ? 'did it' : 'done'}
              </button>
              {r.kind !== 'birthday' && (
                <button onClick={() => remove(r)} className="text-slate-500 hover:text-red-400">
                  ✕
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {adding && (
        <div className="space-y-2 rounded-md border border-slate-800 p-2">
          <TextInput
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Check in after her move"
          />
          <div className="flex flex-wrap items-center gap-3">
            <TextInput
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="max-w-[11rem]"
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
              />
              yearly
            </label>
          </div>
          <ErrorNote error={formError} />
          <div className="flex gap-2">
            <Button onClick={add} disabled={busy || !message.trim() || !dueAt}>
              {busy ? 'Saving…' : 'Add'}
            </Button>
            <Button variant="ghost" type="button" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
