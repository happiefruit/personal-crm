-- Phase 7: reminders. The table exists from 0001; add ordering + a kind so the
-- auto-created birthday reminder stays unique per person.

alter table reminders add column if not exists created_at timestamptz not null default now();
alter table reminders add column if not exists kind       text not null default 'custom';
-- 'custom' | 'birthday' | 'ai'

create unique index if not exists reminders_one_birthday_per_person
  on reminders (person_id) where kind = 'birthday';

create index if not exists reminders_person_idx on reminders(person_id);
