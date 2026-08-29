# Personal CRM

A personal web app (PWA, mobile-first) with two core features:

1. **Personal CRM** — capture messy notes about people; AI parses, files, and keeps each contact's profile up to date
2. **Push notifications** — reminders and nudges via Web Push

See [spec.md](spec.md) for the full spec.

## Repo layout

| Path | What |
|---|---|
| `frontend/` | React + Vite + Tailwind PWA. Deploys to Vercel. |
| `backend/` | Node + Express API. Deploys to Railway/Render. |
| `supabase/migrations/` | SQL schema migrations. Run against your Supabase project. |

## Build status

Following the build order in `spec.md`:

- [x] **1. Scaffold** — frontend + backend skeleton, health check end-to-end, deploy config
- [x] **2. CRM core** — people + notes CRUD, quick capture, list / detail / edit, inbox for unfiled notes
- [x] **Auth** — shared-passcode gate on the API + lock screen (single-user private)
- [ ] 3. AI parsing (Claude Haiku)
- [ ] 4. Reminders
- [ ] 5. PWA setup
- [ ] 6. Push notifications
- [ ] 7. Polish

## Local development

Prereqs: Node 18+, a free [Supabase](https://supabase.com) project.

### 1. Backend

```bash
cd backend
cp .env.example .env        # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev                 # http://localhost:3001
```

Check it: `curl http://localhost:3001/api/health`

### 2. Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:3001
npm install
npm run dev                 # http://localhost:5173
```

Open http://localhost:5173 — the home screen shows the backend + database health status.

### 3. Database

In the [Supabase SQL editor](https://supabase.com/dashboard/project/_/sql), paste and run
`supabase/migrations/0001_init.sql`. (Or use the Supabase CLI — see below.)

Using the CLI:

```bash
npm i -g supabase
supabase link --project-ref <your-project-ref>
supabase db push
```

## Auth

Single-user. Every `/api/*` route except `/api/health` requires the shared
passcode in `Authorization: Bearer <APP_PASSCODE>` (the frontend stores it after
the lock screen and sends it automatically). Wrong passcodes are throttled per IP
(10 tries / 15 min). Set `APP_PASSCODE` on the backend host — if it's unset the
API is open and logs a warning on every request.

## API

| Method | Route | Notes |
|---|---|---|
| GET | `/api/health` | backend + DB status (public) |
| GET | `/api/auth/check` | 200 if the passcode is valid (used by the lock screen) |
| GET | `/api/people` | list, most-recently-contacted first |
| POST | `/api/people` | `{ name* , relationship, tags[], aliases[], summary, important_dates[] }` |
| GET | `/api/people/:id` | profile + embedded `notes[]` timeline |
| PATCH | `/api/people/:id` | any writable field |
| DELETE | `/api/people/:id` | notes are kept, `person_id` set null |
| GET | `/api/notes?person_id=` | timeline, newest first |
| POST | `/api/notes` | `{ raw_text*, person_id, source }` — bumps person's `last_contacted_at` |
| PATCH | `/api/notes/:id` | reassign `person_id` / fix `raw_text` |
| DELETE | `/api/notes/:id` | |

## Notes on the backend ↔ Supabase link

The backend does **not** use `@supabase/supabase-js` — its current major hard-requires
Node 22. Instead `backend/src/supabase.js` is a tiny PostgREST-over-`fetch` client
(`pgrest()` helper) using the service_role key. No SDK, runs on any Node 18+.

## Deploy (skeleton end-to-end)

The point of step 1 is to confirm hosting works before adding features.

### Supabase

1. Create a project at https://supabase.com/dashboard
2. Run `supabase/migrations/0001_init.sql` in the SQL editor
3. From Project Settings → API, copy the **Project URL** and the **service_role** key

### Backend → Railway

1. New Railway project → Deploy from GitHub repo
2. Set **Root Directory** to `backend`
3. Add env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_ORIGIN` (your Vercel URL, add after the frontend deploy), `NODE_ENV=production`
4. Railway auto-detects `npm start`. Note the generated public URL.
5. Verify: `curl https://<your-backend>.up.railway.app/api/health`

(Render works the same way — a `render.yaml` is included. Set the same env vars.)

### Frontend → Vercel

1. New Vercel project → import the same GitHub repo
2. Set **Root Directory** to `frontend`
3. Framework preset: Vite
4. Add env var: `VITE_API_URL` = your Railway backend URL
5. Deploy. Open the URL — the health card should show **backend: ok** and **database: ok**.
6. Go back to Railway and set `FRONTEND_ORIGIN` to this Vercel URL, then redeploy the backend so CORS allows it.

Once the deployed frontend shows both green, step 1 is done.
