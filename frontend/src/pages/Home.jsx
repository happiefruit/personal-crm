import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAsync } from '../lib/useAsync.js';
import { daysSince, relativeTime } from '../lib/format.js';
import { Card, Chip, ErrorNote, Spinner } from '../components/ui.jsx';
import QuickCapture from '../components/QuickCapture.jsx';

const STALE_DAYS = 30;

function PersonRow({ person }) {
  return (
    <Link
      to={`/people/${person.id}`}
      className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-slate-800/60"
    >
      <span className="flex items-center gap-2">
        <span className="font-medium">{person.name}</span>
        {person.relationship && <Chip>{person.relationship}</Chip>}
      </span>
      <span className="text-xs text-slate-500">{relativeTime(person.last_contacted_at)}</span>
    </Link>
  );
}

export default function Home() {
  const { data: people, error, loading, reload } = useAsync(() => api.get('/api/people'), []);

  const recent = (people || []).filter((p) => p.last_contacted_at).slice(0, 5);
  const stale = (people || [])
    .filter((p) => daysSince(p.last_contacted_at) >= STALE_DAYS)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-2 font-medium">Quick capture</h2>
        <QuickCapture people={people || []} onSaved={reload} />
      </Card>

      <ErrorNote error={error} onRetry={reload} />
      {loading && <Spinner />}

      {people && (
        <>
          <Card>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-medium">Recently updated</h2>
              <Link to="/people" className="text-xs text-indigo-400 hover:underline">
                all {people.length} people →
              </Link>
            </div>
            {recent.length ? (
              <div className="divide-y divide-slate-800">
                {recent.map((p) => (
                  <PersonRow key={p.id} person={p} />
                ))}
              </div>
            ) : (
              <p className="py-3 text-sm text-slate-500">
                No notes yet. Capture something above to get started.
              </p>
            )}
          </Card>

          {stale.length > 0 && (
            <Card>
              <h2 className="mb-1 font-medium">Haven&rsquo;t logged in a while</h2>
              <div className="divide-y divide-slate-800">
                {stale.map((p) => (
                  <PersonRow key={p.id} person={p} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
