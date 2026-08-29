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
- [x] **3. AI parsing** — Claude Haiku 4.5 turns a raw note into a person match + facts + summary; review-and-confirm before it's filed
- [x] **4. Rich contact fields** — birthdate/age, pronouns, how-we-met, work, location, likes, dislikes; AI extracts them, merge is non-destructive
- [x] **5. Relationship links** — typed person-to-person links with auto-inverse; AI detects people named in a note and offers to create + link them
- [x] **6. Voice capture** — in-browser speech-to-text (Web Speech API) into the capture box
- [ ] 7. Reminders
- [ ] 8. PWA setup
- [ ] 9. Push notifications
- [ ] 10. Polish

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
| POST | `/api/people` | `{ name*, relationship, tags[], aliases[], summary, important_dates[], birthdate, pronouns, how_we_met, job_title, company, location, likes[], dislikes[] }` |
| GET | `/api/people/:id` | profile + embedded `notes[]` timeline |
| PATCH | `/api/people/:id` | any writable field |
| DELETE | `/api/people/:id` | notes are kept, `person_id` set null |
| GET | `/api/notes?person_id=` | timeline, newest first |
| POST | `/api/notes` | `{ raw_text*, person_id, source }` — bumps person's `last_contacted_at` |
| PATCH | `/api/notes/:id` | reassign `person_id` / fix `raw_text` |
| DELETE | `/api/notes/:id` | |
| POST | `/api/ai/parse` | `{ raw_text }` → saves the note, returns `{ note, suggestion, people }`; changes nothing yet. 502 (note still saved) if the AI call fails. |
| POST | `/api/ai/apply` | commit a reviewed suggestion → creates/updates the person, files the note, links any confirmed mentioned people, returns the person |
| GET | `/api/relationships/types` | allowed link types |
| POST | `/api/relationships` | `{ from_person_id, to_person_id, type }` → creates the link + its inverse |
| DELETE | `/api/relationships/:id` | removes both directions |

### Relationship links (step 5)

`type` describes what `to_person` is to `from_person` ("spouse", "parent",
"child", "colleague"…). Stored as two directed rows; the inverse
(parent↔child, manager↔report, sibling↔sibling…) is created and deleted
automatically. `GET /api/people/:id` returns `relationships: [{ id, type,
person: {id, name} }]`. The AI parser returns `mentioned_people` — others named
in a note with an explicit tie — and the review card lets you create+link,
link to an existing contact, or skip each.

### Voice capture (step 6)

`frontend/src/lib/useSpeech.js` wraps the Web Speech API. A mic button on the
capture boxes (hidden where the browser lacks it) streams finalized phrases into
the textarea; the note is saved with `source: 'voice'`. Works in Chrome / Samsung
Internet on Android.

### AI note parsing (step 3)

`POST /api/ai/parse` sends the raw note + everyone on file (name, aliases,
relationship, short summary) to **Claude Haiku 4.5** via a single forced tool
call. It comes back with: existing-match vs new, a name, relationship guess,
tags, important dates, extracted facts, a rewritten rolling summary, and an
optional follow-up hint. The frontend shows this for review — you can fix the
match or edit any field — then `POST /api/ai/apply` writes it. On apply against
an existing person, tags and dates are merged (union), the summary is replaced
with the AI's revised one, and the note is filed. Needs `ANTHROPIC_API_KEY`;
without it `/api/ai/*` returns 503 and the capture box falls back to manual
filing. `~$0.001–0.002` per note.

The **Add a note** box on a person's profile uses the same flow in "locked"
mode — no person picker, the review card is headed "Update <name>", and
Confirm updates that person's structured fields / summary in place. "Save note
only" files the note and bumps `last_contacted_at` without changing any field.

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
