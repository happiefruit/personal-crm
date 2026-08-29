import { NavLink, Route, Routes } from 'react-router-dom';
import { api, API_URL } from './lib/api.js';
import { useAsync } from './lib/useAsync.js';
import Home from './pages/Home.jsx';
import PeopleList from './pages/PeopleList.jsx';
import Person from './pages/Person.jsx';
import Inbox from './pages/Inbox.jsx';

function Tab({ to, children }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `rounded-md px-3 py-1.5 text-sm font-medium ${
          isActive ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function HealthDot() {
  const { data } = useAsync(() => api.get('/api/health').catch(() => null), []);
  const ok = data?.status === 'ok';
  return (
    <span
      title={data ? `API ${data.status}` : `API unreachable (${API_URL})`}
      className={`inline-block h-2 w-2 rounded-full ${
        !data ? 'bg-red-400' : ok ? 'bg-emerald-400' : 'bg-amber-400'
      }`}
    />
  );
}

export default function App() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Personal CRM</h1>
        <HealthDot />
      </header>

      <nav className="mb-5 flex gap-1">
        <Tab to="/">Home</Tab>
        <Tab to="/people">People</Tab>
        <Tab to="/inbox">Inbox</Tab>
      </nav>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/people" element={<PeopleList />} />
          <Route path="/people/:id" element={<Person />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="*" element={<p className="text-sm text-slate-500">Not found.</p>} />
        </Routes>
      </main>
    </div>
  );
}
