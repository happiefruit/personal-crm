# Personal CRM App — Project Spec

## 1. Overview

A personal web app (PWA, optimized for Android/Samsung) with two core features:

1. **Personal CRM** — capture messy notes about people in your life; AI parses, files, and keeps each contact's profile up to date automatically
2. **Push notifications** — reminders and nudges via Web Push (works natively in Chrome on Android)

Target platform: mobile-first responsive web app, installable as a PWA on your Samsung phone (Add to Home Screen), also usable on desktop.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite, Tailwind CSS | Fast to scaffold, PWA-friendly |
| Backend | Node.js + Express (or Fastify) | Simple API layer, plays well with Claude Code |
| Database | Postgres via Supabase | Free tier, built-in auth, easy from any device |
| AI parsing | Claude API (Haiku 4.5) | Cheap, fast, good enough for structured extraction |
| Push | Web Push API (VAPID) + Service Worker | Native on Android Chrome, no Apple cert needed |
| Hosting | Railway or Render (backend), Vercel (frontend) | Low-effort, free/cheap tiers |

---

## 3. Data Model

### `people`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| aliases | text[] | nicknames, alt spellings — helps fuzzy matching |
| relationship | text | e.g. "friend", "coworker", "family" |
| tags | text[] | freeform |
| summary | text | AI-maintained rolling summary of who they are |
| important_dates | jsonb | birthday, anniversary, etc. — `[{label, date}]` |
| last_contacted_at | timestamp | updated whenever a new note is filed against them |
| created_at | timestamp | |

### `notes`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| person_id | uuid | FK → people, nullable until AI resolves it |
| raw_text | text | exactly what you typed/said |
| extracted_facts | jsonb | structured output from AI parse |
| source | text | "manual", "voice" |
| created_at | timestamp | |

### `reminders`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| person_id | uuid | FK → people |
| message | text | |
| due_at | timestamp | |
| sent | boolean | |
| recurring | text | nullable — e.g. "yearly" for birthdays |

### `push_subscriptions`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| endpoint | text | from browser Push subscription |
| keys | jsonb | p256dh / auth keys |

---

## 4. Feature Specs

### 4.1 CRM capture + AI cleanup
- Single text input ("quick capture") on the home screen — type or use Android's built-in voice-to-text (no need to build custom voice capture; Samsung keyboard already does this)
- On submit:
  1. Save raw note to `notes`
  2. Call Claude API (Haiku 4.5) with: the raw note + list of existing people (name/aliases) as context
  3. Prompt asks for structured JSON: `{ person_match: "existing_id" | "new", name, facts: [...], relationship_guess, tags, important_dates: [...] }`
  4. If `new`, create a `people` row; if matched, update `people.summary` and append facts
  5. If a date fact was extracted (birthday, anniversary), offer to create a recurring reminder
  6. Show the person's updated profile as confirmation (lets you correct a bad match before it's saved)
- Person profile page: rolling AI summary at top, editable fields (relationship, tags, dates), timeline of raw notes below
- Home/dashboard: recently updated people, "haven't logged anything about X in a while" list, upcoming reminders

### 4.2 Push notifications
- Standard Web Push: service worker + VAPID keys generated once on the backend
- On first visit, prompt for notification permission (works well in Chrome/Samsung Internet on Android)
- Triggers to start with:
  - Reminder for a `reminders` row coming due (birthdays, follow-ups you set)
  - Re-engagement nudge if you haven't logged a note about someone in X days
- Later idea: let the AI parse step *suggest* a reminder when it detects something time-sensitive in a note ("follow up next week", "check in after her surgery")

---

## 5. Build Order (suggested)

1. **Scaffold**: React + Vite frontend, Express backend, Supabase project, deploy skeleton end-to-end — confirms hosting works before adding complexity
2. **CRM core**: people + notes tables, manual capture form, list/detail views — no AI yet, just CRUD
3. **AI parsing**: wire in Claude API (Haiku 4.5) for note → structured extraction + person matching
4. **Reminders**: add reminders table, manual creation, and auto-creation from extracted dates
5. **PWA setup**: manifest.json, service worker, installable on Samsung home screen
6. **Push notifications**: VAPID setup, permission prompt, wire up reminder-due and re-engagement triggers
7. **Polish**: refine AI prompts based on real use, improve dashboard/search

---

## 6. Open Decisions
- Single-user only, or design for auth from day one? (Simpler to start single-user with Supabase auth added later)
- Voice capture: rely on phone keyboard's built-in dictation (simplest) vs. building native audio upload (more work, only needed for hands-free capture)
- Where reminder/notification logic runs: a scheduled cron job (e.g. Supabase Edge Function on a schedule) is simplest to start
