import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Button, Card, Chip, ErrorNote, TextInput } from './ui.jsx';
import QuickCapture from './QuickCapture.jsx';

const csv = (arr) => (arr || []).join(', ');
const parseCsv = (s) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

function SuggestionReview({ result, onCancel, onApplied }) {
  const { note, suggestion, people } = result;
  const [target, setTarget] = useState(
    suggestion.person_match === 'existing' && suggestion.matched_person_id
      ? suggestion.matched_person_id
      : 'new',
  );
  const [name, setName] = useState(suggestion.name);
  const [relationship, setRelationship] = useState(suggestion.relationship_guess || '');
  const [tags, setTags] = useState(csv(suggestion.tags));
  const [summary, setSummary] = useState(suggestion.summary);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isNew = target === 'new';
  const matched = people.find((p) => p.id === target);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const person = await api.post('/api/ai/apply', {
        note_id: note.id,
        person_match: isNew ? 'new' : 'existing',
        person_id: isNew ? null : target,
        name: name.trim(),
        relationship: relationship.trim() || null,
        tags: parseCsv(tags),
        important_dates: suggestion.important_dates,
        summary: summary.trim() || null,
      });
      onApplied(person);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Review &amp; file</h3>
        <span className="text-xs text-slate-500">
          {suggestion.person_match === 'existing' ? 'matched existing' : 'looks new'}
        </span>
      </div>

      <label className="block text-xs text-slate-400">
        Person
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
        >
          <option value="new">+ New person</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {isNew ? (
        <label className="block text-xs text-slate-400">
          Name
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      ) : (
        <p className="text-xs text-slate-500">
          Filing under <span className="text-slate-300">{matched?.name}</span>
        </p>
      )}

      <label className="block text-xs text-slate-400">
        Relationship
        <TextInput
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          placeholder="friend, coworker…"
        />
      </label>

      <label className="block text-xs text-slate-400">
        Tags
        <TextInput value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>

      {suggestion.important_dates.length > 0 && (
        <div className="text-xs text-slate-400">
          Dates
          <div className="mt-1 flex flex-wrap gap-1.5">
            {suggestion.important_dates.map((d, i) => (
              <Chip key={i}>
                {d.label}: {d.date}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <label className="block text-xs text-slate-400">
        {isNew ? 'Summary' : 'Updated summary'}
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
        />
      </label>

      {suggestion.facts.length > 0 && (
        <div className="text-xs text-slate-500">
          Extracted: {suggestion.facts.join(' · ')}
        </div>
      )}

      {suggestion.reminder_suggestion && (
        <p className="rounded-md bg-slate-800/60 px-3 py-2 text-xs text-slate-400">
          💡 Possible follow-up: “{suggestion.reminder_suggestion.message}” (
          {suggestion.reminder_suggestion.due_hint}). Reminders arrive in a later version.
        </p>
      )}

      <ErrorNote error={error} />
      <div className="flex gap-2">
        <Button onClick={confirm} disabled={busy || (isNew && !name.trim())}>
          {busy ? 'Filing…' : 'Confirm'}
        </Button>
        <Button variant="ghost" onClick={onCancel} type="button">
          Skip (leave in Inbox)
        </Button>
      </div>
    </Card>
  );
}

export default function SmartCapture({ aiAvailable, people, onSaved }) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { note, suggestion, people }
  const [manualFallback, setManualFallback] = useState(false);

  if (!aiAvailable || manualFallback) {
    return (
      <QuickCapture
        people={people}
        onSaved={(x) => {
          setManualFallback(false);
          onSaved?.(x);
        }}
      />
    );
  }

  if (result) {
    return (
      <SuggestionReview
        result={result}
        onCancel={() => {
          setResult(null);
          onSaved?.({});
        }}
        onApplied={(person) => {
          setResult(null);
          onSaved?.({ personId: person.id });
          navigate(`/people/${person.id}`);
        }}
      />
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/ai/parse', { raw_text: text.trim() });
      setText('');
      setResult(res);
    } catch (err) {
      // 502 => note was saved but the AI failed; drop to manual filing.
      if (err.status === 502) {
        setText('');
        setManualFallback(true);
        onSaved?.({});
        setError(new Error('Saved, but AI parsing failed — file it from the Inbox.'));
      } else {
        setError(err);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Quick capture — what happened, what you learned…"
        className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || !text.trim()}>
          {busy ? 'Reading…' : 'Save & file with AI'}
        </Button>
        <button
          type="button"
          onClick={() => setManualFallback(true)}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          file manually
        </button>
      </div>
      <ErrorNote error={error} />
    </form>
  );
}
