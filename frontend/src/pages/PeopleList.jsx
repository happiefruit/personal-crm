import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { relativeTime } from '../lib/format.js';
import { Card, Chip, ErrorNote, Spinner, TextInput } from '../components/ui.jsx';

export default function PeopleList() {
  const { data: people, error, loading, reload } = useAsync(() => api.get('/api/people'), []);
  const [q, setQ] = useState('');

  const filtered = (people || []).filter((p) => {
    const hay = [p.name, p.relationship, ...(p.aliases || []), ...(p.tags || [])]
      .join(' ')
      .toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">People</h2>
        <span className="text-xs text-slate-500">{(people || []).length} total</span>
      </div>

      <TextInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, alias, tag, relationship…"
      />

      <ErrorNote error={error} onRetry={reload} />
      {loading && <Spinner />}

      {people && (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Link key={p.id} to={`/people/${p.id}`}>
              <Card className="hover:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-slate-500">
                    {relativeTime(p.last_contacted_at)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {p.relationship && <Chip>{p.relationship}</Chip>}
                  {(p.tags || []).map((t) => (
                    <Chip key={t}>{t}</Chip>
                  ))}
                </div>
              </Card>
            </Link>
          ))}
          {!filtered.length && (
            <p className="py-6 text-center text-sm text-slate-500">
              {people.length ? 'No matches.' : 'No people yet — capture a note on the home screen.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
