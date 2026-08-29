import { useState } from 'react';
import { api } from '../lib/api.js';
import { Button, ErrorNote, MicButton, TextInput } from './ui.jsx';

const NEW = '__new__';
const UNFILED = '';

/**
 * Quick-capture box. Save a raw note, optionally filed against a person.
 * @param {object} props
 * @param {Array} props.people        existing people for the picker
 * @param {string} [props.lockedPersonId]  when set, the note is always filed here (no picker)
 * @param {Function} props.onSaved    called after a successful save
 */
export default function QuickCapture({ people = [], lockedPersonId, onSaved }) {
  const [text, setText] = useState('');
  const [target, setTarget] = useState(lockedPersonId ?? UNFILED);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [usedVoice, setUsedVoice] = useState(false);
  const appendSpoken = (chunk) => setText((t) => (t ? `${t} ${chunk}` : chunk));

  async function submit(e) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      let personId = lockedPersonId ?? (target === UNFILED || target === NEW ? null : target);

      if (!lockedPersonId && target === NEW) {
        if (!newName.trim()) throw new Error('Enter a name for the new person');
        const person = await api.post('/api/people', { name: newName.trim() });
        personId = person.id;
      }

      const note = await api.post('/api/notes', {
        raw_text: text.trim(),
        person_id: personId,
        source: usedVoice ? 'voice' : 'manual',
      });
      setText('');
      setNewName('');
      setUsedVoice(false);
      if (!lockedPersonId) setTarget(UNFILED);
      onSaved?.({ note, personId });
    } catch (err) {
      setError(err);
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

      {!lockedPersonId && (
        <div className="flex flex-wrap gap-2">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
          >
            <option value={UNFILED}>— Unfiled —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value={NEW}>+ New person…</option>
          </select>

          {target === NEW && (
            <TextInput
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New person's name"
              className="max-w-[12rem]"
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !text.trim()}>
          {busy ? 'Saving…' : 'Save note'}
        </Button>
        <MicButton onText={appendSpoken} onListeningChange={(on) => on && setUsedVoice(true)} />
        <ErrorNote error={error} />
      </div>
    </form>
  );
}
