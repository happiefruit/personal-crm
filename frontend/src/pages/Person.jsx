import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { formatDate, formatDateTime, relativeTime } from '../lib/format.js';
import { Button, Card, Chip, ErrorNote, Spinner, TextInput } from '../components/ui.jsx';
import QuickCapture from '../components/QuickCapture.jsx';

const csv = (arr) => (arr || []).join(', ');
const parseCsv = (s) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

function EditForm({ person, onCancel, onSaved }) {
  const [form, setForm] = useState({
    name: person.name,
    relationship: person.relationship || '',
    summary: person.summary || '',
    tags: csv(person.tags),
    aliases: csv(person.aliases),
    important_dates: person.important_dates || [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setDate = (i, k, v) =>
    set(
      'important_dates',
      form.important_dates.map((d, j) => (j === i ? { ...d, [k]: v } : d)),
    );

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.patch(`/api/people/${person.id}`, {
        name: form.name.trim(),
        relationship: form.relationship.trim() || null,
        summary: form.summary.trim() || null,
        tags: parseCsv(form.tags),
        aliases: parseCsv(form.aliases),
        important_dates: form.important_dates.filter((d) => d.label && d.date),
      });
      onSaved(updated);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <label className="block text-xs text-slate-400">
        Name
        <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} />
      </label>
      <label className="block text-xs text-slate-400">
        Relationship
        <TextInput
          value={form.relationship}
          onChange={(e) => set('relationship', e.target.value)}
          placeholder="friend, coworker, family…"
        />
      </label>
      <label className="block text-xs text-slate-400">
        Summary
        <textarea
          value={form.summary}
          onChange={(e) => set('summary', e.target.value)}
          rows={3}
          className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
        />
      </label>
      <label className="block text-xs text-slate-400">
        Tags (comma-separated)
        <TextInput value={form.tags} onChange={(e) => set('tags', e.target.value)} />
      </label>
      <label className="block text-xs text-slate-400">
        Aliases (comma-separated)
        <TextInput value={form.aliases} onChange={(e) => set('aliases', e.target.value)} />
      </label>

      <div className="text-xs text-slate-400">
        Important dates
        <div className="mt-1 space-y-2">
          {form.important_dates.map((d, i) => (
            <div key={i} className="flex gap-2">
              <TextInput
                value={d.label || ''}
                onChange={(e) => setDate(i, 'label', e.target.value)}
                placeholder="birthday"
              />
              <TextInput
                type="date"
                value={d.date || ''}
                onChange={(e) => setDate(i, 'date', e.target.value)}
              />
              <Button
                variant="ghost"
                type="button"
                onClick={() =>
                  set('important_dates', form.important_dates.filter((_, j) => j !== i))
                }
              >
                ✕
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            type="button"
            onClick={() => set('important_dates', [...form.important_dates, { label: '', date: '' }])}
          >
            + date
          </Button>
        </div>
      </div>

      <ErrorNote error={error} />
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="ghost" onClick={onCancel} type="button">
          Cancel
        </Button>
      </div>
    </Card>
  );
}

export default function Person() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: person, error, loading, reload, setData } = useAsync(
    () => api.get(`/api/people/${id}`),
    [id],
  );
  const [editing, setEditing] = useState(false);

  async function removePerson() {
    if (!confirm(`Delete ${person.name}? Their notes become unfiled.`)) return;
    await api.del(`/api/people/${id}`);
    navigate('/people');
  }

  async function removeNote(noteId) {
    if (!confirm('Delete this note?')) return;
    await api.del(`/api/notes/${noteId}`);
    reload();
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!person) return null;

  const notes = person.notes || [];

  return (
    <div className="space-y-5">
      <Link to="/people" className="text-xs text-indigo-400 hover:underline">
        ← People
      </Link>

      {editing ? (
        <EditForm
          person={person}
          onCancel={() => setEditing(false)}
          onSaved={(updated) => {
            setData({ ...person, ...updated });
            setEditing(false);
          }}
        />
      ) : (
        <Card className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold">{person.name}</h2>
              <p className="text-xs text-slate-500">
                last contacted {relativeTime(person.last_contacted_at)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="danger" onClick={removePerson}>
                Delete
              </Button>
            </div>
          </div>

          {person.summary ? (
            <p className="text-sm text-slate-300">{person.summary}</p>
          ) : (
            <p className="text-sm italic text-slate-600">No summary yet.</p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {person.relationship && <Chip>{person.relationship}</Chip>}
            {(person.tags || []).map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>

          {(person.aliases || []).length > 0 && (
            <p className="text-xs text-slate-500">a.k.a. {person.aliases.join(', ')}</p>
          )}

          {(person.important_dates || []).length > 0 && (
            <ul className="text-sm text-slate-300">
              {person.important_dates.map((d, i) => (
                <li key={i}>
                  <span className="text-slate-500">{d.label}:</span> {formatDate(d.date)}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <h3 className="mb-2 font-medium">Add a note</h3>
        <QuickCapture lockedPersonId={person.id} onSaved={reload} />
      </Card>

      <div>
        <h3 className="mb-2 font-medium">
          Timeline <span className="text-xs text-slate-500">({notes.length})</span>
        </h3>
        <div className="space-y-2">
          {notes.map((n) => (
            <Card key={n.id}>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>{formatDateTime(n.created_at)}</span>
                <button onClick={() => removeNote(n.id)} className="hover:text-red-400">
                  delete
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-200">{n.raw_text}</p>
            </Card>
          ))}
          {!notes.length && <p className="text-sm text-slate-500">No notes yet.</p>}
        </div>
      </div>
    </div>
  );
}
