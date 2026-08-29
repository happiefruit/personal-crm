import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { computeAge, formatDate, formatDateTime, relativeTime } from '../lib/format.js';
import { Button, Card, Chip, ErrorNote, Spinner, TextInput } from '../components/ui.jsx';
import QuickCapture from '../components/QuickCapture.jsx';

const csv = (arr) => (arr || []).join(', ');
const parseCsv = (s) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

// birthdate <-> form: store "YYYY-MM-DD" or "0000-MM-DD" (year unknown)
function splitBirthdate(bd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bd || '');
  if (!m) return { date: '', yearUnknown: false };
  if (m[1] === '0000') return { date: `2000-${m[2]}-${m[3]}`, yearUnknown: true };
  return { date: bd, yearUnknown: false };
}
function joinBirthdate({ date, yearUnknown }) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!m) return null;
  return yearUnknown ? `0000-${m[2]}-${m[3]}` : date;
}

const REL_TYPES = [
  'spouse', 'partner', 'ex', 'sibling', 'friend', 'colleague', 'relative',
  'parent', 'child', 'grandparent', 'grandchild', 'manager', 'report',
];
const REL_LABEL = {
  spouse: 'Spouse', partner: 'Partner', ex: 'Ex', sibling: 'Sibling', friend: 'Friend',
  colleague: 'Colleague', relative: 'Relative', parent: 'Parent', child: 'Child',
  grandparent: 'Grandparent', grandchild: 'Grandchild', manager: 'Manager', report: 'Report',
};

function Relationships({ person, allPeople, onChange }) {
  const [adding, setAdding] = useState(false);
  const [toId, setToId] = useState('');
  const [type, setType] = useState('friend');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const links = person.relationships || [];
  const candidates = allPeople.filter((p) => p.id !== person.id);

  async function add() {
    if (!toId) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/api/relationships', {
        from_person_id: person.id,
        to_person_id: toId,
        type,
      });
      setAdding(false);
      setToId('');
      onChange();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove(linkId) {
    await api.del(`/api/relationships/${linkId}`);
    onChange();
  }

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Relationships</h3>
        {!adding && candidates.length > 0 && (
          <Button variant="ghost" onClick={() => setAdding(true)}>
            + Add
          </Button>
        )}
      </div>

      {links.length === 0 && !adding && (
        <p className="text-sm text-slate-500">No links yet.</p>
      )}

      <ul className="divide-y divide-slate-800">
        {links.map((l) => (
          <li key={l.id} className="flex items-center justify-between py-1.5 text-sm">
            <span>
              <span className="text-slate-500">{REL_LABEL[l.type] || l.type}: </span>
              <Link to={`/people/${l.person.id}`} className="text-indigo-400 hover:underline">
                {l.person.name}
              </Link>
            </span>
            <button onClick={() => remove(l.id)} className="text-xs text-slate-500 hover:text-red-400">
              ✕
            </button>
          </li>
        ))}
      </ul>

      {adding && (
        <div className="space-y-2 rounded-md border border-slate-800 p-2">
          <select
            value={toId}
            onChange={(e) => setToId(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Choose a person…</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">&mdash; {person.name}&rsquo;s</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            >
              {REL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REL_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <ErrorNote error={error} />
          <div className="flex gap-2">
            <Button onClick={add} disabled={busy || !toId}>
              {busy ? 'Linking…' : 'Link'}
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)} type="button">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Facts({ person }) {
  const rows = [];
  if (person.birthdate) {
    const age = computeAge(person.birthdate);
    rows.push(['Birthday', `${formatDate(person.birthdate)}${age != null ? ` · age ${age}` : ''}`]);
  }
  if (person.pronouns) rows.push(['Pronouns', person.pronouns]);
  const work = [person.job_title, person.company].filter(Boolean).join(' at ');
  if (work) rows.push(['Work', work]);
  if (person.location) rows.push(['Location', person.location]);
  if (person.how_we_met) rows.push(['How we met', person.how_we_met]);
  if (!rows.length) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-slate-300">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function EditForm({ person, onCancel, onSaved }) {
  const bd = splitBirthdate(person.birthdate);
  const [form, setForm] = useState({
    name: person.name,
    relationship: person.relationship || '',
    summary: person.summary || '',
    tags: csv(person.tags),
    aliases: csv(person.aliases),
    important_dates: person.important_dates || [],
    birthdate: bd.date,
    birthdateYearUnknown: bd.yearUnknown,
    pronouns: person.pronouns || '',
    how_we_met: person.how_we_met || '',
    job_title: person.job_title || '',
    company: person.company || '',
    location: person.location || '',
    likes: csv(person.likes),
    dislikes: csv(person.dislikes),
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
        birthdate: joinBirthdate({
          date: form.birthdate,
          yearUnknown: form.birthdateYearUnknown,
        }),
        pronouns: form.pronouns.trim() || null,
        how_we_met: form.how_we_met.trim() || null,
        job_title: form.job_title.trim() || null,
        company: form.company.trim() || null,
        location: form.location.trim() || null,
        likes: parseCsv(form.likes),
        dislikes: parseCsv(form.dislikes),
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
        Birthday
        <div className="mt-1 flex items-center gap-3">
          <TextInput
            type="date"
            value={form.birthdate}
            onChange={(e) => set('birthdate', e.target.value)}
            className="max-w-[11rem]"
          />
          <label className="flex items-center gap-1.5 text-slate-400">
            <input
              type="checkbox"
              checked={form.birthdateYearUnknown}
              onChange={(e) => set('birthdateYearUnknown', e.target.checked)}
            />
            year unknown
          </label>
        </div>
      </div>

      <label className="block text-xs text-slate-400">
        Pronouns
        <TextInput value={form.pronouns} onChange={(e) => set('pronouns', e.target.value)} />
      </label>
      <div className="flex gap-2">
        <label className="block flex-1 text-xs text-slate-400">
          Job title
          <TextInput value={form.job_title} onChange={(e) => set('job_title', e.target.value)} />
        </label>
        <label className="block flex-1 text-xs text-slate-400">
          Company
          <TextInput value={form.company} onChange={(e) => set('company', e.target.value)} />
        </label>
      </div>
      <label className="block text-xs text-slate-400">
        Location
        <TextInput value={form.location} onChange={(e) => set('location', e.target.value)} />
      </label>
      <label className="block text-xs text-slate-400">
        How we met
        <TextInput value={form.how_we_met} onChange={(e) => set('how_we_met', e.target.value)} />
      </label>
      <label className="block text-xs text-slate-400">
        Likes (comma-separated)
        <TextInput value={form.likes} onChange={(e) => set('likes', e.target.value)} />
      </label>
      <label className="block text-xs text-slate-400">
        Dislikes (comma-separated)
        <TextInput value={form.dislikes} onChange={(e) => set('dislikes', e.target.value)} />
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
  const { data, error, loading, reload, setData } = useAsync(
    () => Promise.all([api.get(`/api/people/${id}`), api.get('/api/people')]),
    [id],
  );
  const person = data?.[0];
  const allPeople = data?.[1] || [];
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
            setData([{ ...person, ...updated }, allPeople]);
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

          <Facts person={person} />

          {(person.likes || []).length > 0 && (
            <div className="text-xs text-slate-400">
              Likes
              <div className="mt-1 flex flex-wrap gap-1.5">
                {person.likes.map((x) => (
                  <Chip key={x}>{x}</Chip>
                ))}
              </div>
            </div>
          )}
          {(person.dislikes || []).length > 0 && (
            <div className="text-xs text-slate-400">
              Dislikes
              <div className="mt-1 flex flex-wrap gap-1.5">
                {person.dislikes.map((x) => (
                  <Chip key={x}>{x}</Chip>
                ))}
              </div>
            </div>
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

      {!editing && (
        <Relationships person={person} allPeople={allPeople} onChange={reload} />
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
