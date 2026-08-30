import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Button, Card, Chip, ErrorNote, MicButton, TextInput } from './ui.jsx';
import QuickCapture from './QuickCapture.jsx';

const csv = (arr) => (arr || []).join(', ');
const parseCsv = (s) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

const REL_TYPES = [
  'spouse', 'partner', 'ex', 'sibling', 'friend', 'colleague', 'relative',
  'parent', 'child', 'grandparent', 'grandchild', 'manager', 'report',
];

function SuggestionReview({ result, lockedPerson, onCancel, onApplied }) {
  const { note, suggestion, people } = result;
  const [target, setTarget] = useState(
    lockedPerson
      ? lockedPerson.id
      : suggestion.person_match === 'existing' && suggestion.matched_person_id
        ? suggestion.matched_person_id
        : 'new',
  );
  const [name, setName] = useState(
    /^<.*>$|^\?+$|^unknown$/i.test((suggestion.name || '').trim()) ? '' : suggestion.name,
  );
  const [relationship, setRelationship] = useState(suggestion.relationship_guess || '');
  const [tags, setTags] = useState(csv(suggestion.tags));
  const [summary, setSummary] = useState(suggestion.summary);
  const [details, setDetails] = useState({
    birthdate: suggestion.birthdate || '',
    pronouns: suggestion.pronouns || '',
    job_title: suggestion.job_title || '',
    company: suggestion.company || '',
    location: suggestion.location || '',
    how_we_met: suggestion.how_we_met || '',
    likes: csv(suggestion.likes),
    dislikes: csv(suggestion.dislikes),
  });
  const hasDetails =
    suggestion.birthdate ||
    suggestion.pronouns ||
    suggestion.job_title ||
    suggestion.company ||
    suggestion.location ||
    suggestion.how_we_met ||
    (suggestion.likes || []).length ||
    (suggestion.dislikes || []).length;
  const [showDetails, setShowDetails] = useState(Boolean(hasDetails));
  const setDetail = (k, v) => setDetails((d) => ({ ...d, [k]: v }));

  const rs = suggestion.reminder_suggestion;
  const [reminderOn, setReminderOn] = useState(Boolean(rs?.due_at));
  const [reminderMsg, setReminderMsg] = useState(rs?.message || '');
  const [reminderDue, setReminderDue] = useState(rs?.due_at || '');

  const [mentions, setMentions] = useState(
    (suggestion.mentioned_people || []).map((m) => ({
      name: m.name,
      relationship_to_subject: m.relationship_to_subject || 'friend',
      person_id: m.matched_person_id || '',
      action: m.matched_person_id ? 'link' : m.relationship_to_subject ? 'create' : 'skip',
    })),
  );
  const setMention = (i, patch) =>
    setMentions((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const isNew = target === 'new';
  const matched = people.find((p) => p.id === target);

  async function confirm({ noEdits = false } = {}) {
    setBusy(true);
    setError(null);
    try {
      const base = {
        note_id: note.id,
        person_match: isNew ? 'new' : 'existing',
        person_id: isNew ? null : target,
        name: name.trim(),
      };
      const payload = noEdits
        ? base
        : {
            ...base,
            relationship: relationship.trim() || null,
            tags: parseCsv(tags),
            important_dates: suggestion.important_dates,
            summary: summary.trim() || null,
            birthdate: details.birthdate.trim() || null,
            pronouns: details.pronouns.trim() || null,
            job_title: details.job_title.trim() || null,
            company: details.company.trim() || null,
            location: details.location.trim() || null,
            how_we_met: details.how_we_met.trim() || null,
            likes: parseCsv(details.likes),
            dislikes: parseCsv(details.dislikes),
            mentioned_people: mentions
              .filter((m) => m.action !== 'skip')
              .map((m) => ({
                action: m.action,
                name: m.name,
                relationship_to_subject: m.relationship_to_subject,
                person_id: m.action === 'link' ? m.person_id : null,
              })),
            reminder:
              reminderOn && reminderMsg.trim() && reminderDue
                ? { message: reminderMsg.trim(), due_at: reminderDue }
                : null,
          };
      const person = await api.post('/api/ai/apply', payload);
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
        <h3 className="font-medium">
          {lockedPerson ? `Update ${lockedPerson.name}` : 'Review & file'}
        </h3>
        {!lockedPerson && (
          <span className="text-xs text-slate-500">
            {suggestion.person_match === 'existing' ? 'matched existing' : 'looks new'}
          </span>
        )}
      </div>

      {!lockedPerson && (
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
      )}

      {!lockedPerson &&
        (isNew ? (
          <label className="block text-xs text-slate-400">
            Name
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        ) : (
          <p className="text-xs text-slate-500">
            Filing under <span className="text-slate-300">{matched?.name}</span>
          </p>
        ))}

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

      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="text-xs text-indigo-400 hover:underline"
      >
        {showDetails ? 'Hide details' : 'More details'}
        {!showDetails && hasDetails ? ' (AI found some)' : ''}
      </button>

      {showDetails && (
        <div className="space-y-2 rounded-md border border-slate-800 p-3">
          <div className="flex gap-2">
            <label className="block flex-1 text-xs text-slate-400">
              Birthday
              <TextInput
                type="date"
                value={/^\d{4}-/.test(details.birthdate) && !details.birthdate.startsWith('0000') ? details.birthdate : ''}
                onChange={(e) => setDetail('birthdate', e.target.value)}
              />
              {details.birthdate.startsWith('0000') && (
                <span className="text-[11px] text-slate-500">
                  {details.birthdate.slice(5)} (year unknown)
                </span>
              )}
            </label>
            <label className="block flex-1 text-xs text-slate-400">
              Pronouns
              <TextInput
                value={details.pronouns}
                onChange={(e) => setDetail('pronouns', e.target.value)}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <label className="block flex-1 text-xs text-slate-400">
              Job title
              <TextInput
                value={details.job_title}
                onChange={(e) => setDetail('job_title', e.target.value)}
              />
            </label>
            <label className="block flex-1 text-xs text-slate-400">
              Company
              <TextInput
                value={details.company}
                onChange={(e) => setDetail('company', e.target.value)}
              />
            </label>
          </div>
          <label className="block text-xs text-slate-400">
            Location
            <TextInput
              value={details.location}
              onChange={(e) => setDetail('location', e.target.value)}
            />
          </label>
          <label className="block text-xs text-slate-400">
            How we met
            <TextInput
              value={details.how_we_met}
              onChange={(e) => setDetail('how_we_met', e.target.value)}
            />
          </label>
          <label className="block text-xs text-slate-400">
            Likes
            <TextInput value={details.likes} onChange={(e) => setDetail('likes', e.target.value)} />
          </label>
          <label className="block text-xs text-slate-400">
            Dislikes
            <TextInput
              value={details.dislikes}
              onChange={(e) => setDetail('dislikes', e.target.value)}
            />
          </label>
        </div>
      )}

      {suggestion.facts.length > 0 && (
        <div className="text-xs text-slate-500">
          Extracted: {suggestion.facts.join(' · ')}
        </div>
      )}

      {mentions.length > 0 && (
        <div className="space-y-2 rounded-md border border-slate-800 p-3">
          <p className="text-xs font-medium text-slate-300">People mentioned</p>
          {mentions.map((m, i) => (
            <div key={i} className="space-y-1.5 border-t border-slate-800 pt-2 first:border-0 first:pt-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-200">{m.name}</span>
                <span className="text-xs text-slate-500">
                  — {name || 'this person'}&rsquo;s
                </span>
                <select
                  value={m.relationship_to_subject}
                  onChange={(e) => setMention(i, { relationship_to_subject: e.target.value })}
                  className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-xs text-slate-100 focus:outline-none"
                >
                  {REL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-1.5 text-xs">
                {['create', 'link', 'skip'].map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setMention(i, { action: a })}
                    className={`rounded px-2 py-1 ${
                      m.action === a
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-700 text-slate-400'
                    }`}
                  >
                    {a === 'create' ? 'Create & link' : a === 'link' ? 'Link existing' : 'Skip'}
                  </button>
                ))}
                {m.action === 'link' && (
                  <select
                    value={m.person_id}
                    onChange={(e) => setMention(i, { person_id: e.target.value })}
                    className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-slate-100 focus:outline-none"
                  >
                    <option value="">choose…</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {rs && (
        <div className="space-y-2 rounded-md bg-slate-800/60 px-3 py-2 text-xs text-slate-400">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={reminderOn}
              onChange={(e) => setReminderOn(e.target.checked)}
            />
            <span>💡 Set a reminder{rs.due_hint ? ` (${rs.due_hint})` : ''}</span>
          </label>
          {reminderOn && (
            <div className="space-y-1.5">
              <TextInput
                value={reminderMsg}
                onChange={(e) => setReminderMsg(e.target.value)}
                placeholder="Reminder text"
              />
              <TextInput
                type="date"
                value={reminderDue}
                onChange={(e) => setReminderDue(e.target.value)}
                className="max-w-[11rem]"
              />
              {!rs.due_at && !reminderDue && (
                <p className="text-[11px] text-amber-400">Pick a date — the note didn’t give one.</p>
              )}
            </div>
          )}
        </div>
      )}

      <ErrorNote error={error} />
      <div className="flex gap-2">
        <Button onClick={() => confirm()} disabled={busy || (isNew && !name.trim())}>
          {busy ? 'Saving…' : lockedPerson ? 'Update profile' : 'Confirm'}
        </Button>
        {lockedPerson ? (
          <Button variant="ghost" onClick={() => confirm({ noEdits: true })} type="button" disabled={busy}>
            Save note only
          </Button>
        ) : (
          <Button variant="ghost" onClick={onCancel} type="button">
            Skip (leave in Inbox)
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function SmartCapture({ aiAvailable, people, lockedPerson, onSaved }) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { note, suggestion, people }
  const [manualFallback, setManualFallback] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);

  if (!aiAvailable || manualFallback) {
    return (
      <QuickCapture
        people={people}
        lockedPersonId={lockedPerson?.id}
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
        lockedPerson={lockedPerson}
        onCancel={() => {
          setResult(null);
          onSaved?.({});
        }}
        onApplied={(person) => {
          setResult(null);
          onSaved?.({ personId: person.id });
          if (!lockedPerson) navigate(`/people/${person.id}`);
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
      const res = await api.post('/api/ai/parse', {
        raw_text: text.trim(),
        source: usedVoice ? 'voice' : 'manual',
        ...(lockedPerson ? { for_person_id: lockedPerson.id } : {}),
      });
      setText('');
      setUsedVoice(false);
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
        placeholder={
          lockedPerson
            ? `What's new with ${lockedPerson.name}?`
            : 'Quick capture — what happened, what you learned…'
        }
        className="w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !text.trim()}>
          {busy ? 'Reading…' : lockedPerson ? 'Save note using AI' : 'Save & file with AI'}
        </Button>
        <MicButton
          value={text}
          onChange={setText}
          onListeningChange={(on) => on && setUsedVoice(true)}
        />
        {text && (
          <button
            type="button"
            onClick={() => {
              setText('');
              setUsedVoice(false);
            }}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            clear
          </button>
        )}
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
