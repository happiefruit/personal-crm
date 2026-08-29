-- Personal CRM — initial schema
-- Build order step 1: full data model from spec.md section 3.
-- Single-user to start (no auth yet). RLS is enabled with no policies so the
-- anon/public key cannot read anything; the backend uses the service_role key.

create extension if not exists "pgcrypto";

-- people -------------------------------------------------------------------
create table if not exists people (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  aliases           text[] not null default '{}',
  relationship      text,
  tags              text[] not null default '{}',
  summary           text,
  important_dates   jsonb not null default '[]'::jsonb,  -- [{label, date}]
  last_contacted_at timestamptz,
  created_at        timestamptz not null default now()
);

-- notes -------------------------------------------------------------------
create table if not exists notes (
  id              uuid primary key default gen_random_uuid(),
  person_id       uuid references people(id) on delete set null,
  raw_text        text not null,
  extracted_facts jsonb not null default '{}'::jsonb,
  source          text not null default 'manual',  -- 'manual' | 'voice'
  created_at      timestamptz not null default now()
);
create index if not exists notes_person_id_idx on notes(person_id);
create index if not exists notes_created_at_idx on notes(created_at desc);

-- reminders -------------------------------------------------------------------
create table if not exists reminders (
  id        uuid primary key default gen_random_uuid(),
  person_id uuid references people(id) on delete cascade,
  message   text not null,
  due_at    timestamptz not null,
  sent      boolean not null default false,
  recurring text  -- nullable, e.g. 'yearly'
);
create index if not exists reminders_due_idx on reminders(due_at) where sent = false;

-- push_subscriptions -------------------------------------------------------------
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text not null unique,
  keys       jsonb not null,  -- { p256dh, auth }
  created_at timestamptz not null default now()
);

-- Lock down the public API surface; backend talks via service_role.
alter table people             enable row level security;
alter table notes              enable row level security;
alter table reminders          enable row level security;
alter table push_subscriptions enable row level security;
