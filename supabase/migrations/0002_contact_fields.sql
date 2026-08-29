-- Phase 4: MonicaHQ-style structured contact fields on people.
-- All nullable; no backfill needed.

alter table people add column if not exists birthdate   text;   -- YYYY-MM-DD or 0000-MM-DD (year unknown)
alter table people add column if not exists pronouns    text;
alter table people add column if not exists how_we_met  text;
alter table people add column if not exists job_title   text;
alter table people add column if not exists company     text;
alter table people add column if not exists location    text;
alter table people add column if not exists likes       text[] not null default '{}';
alter table people add column if not exists dislikes    text[] not null default '{}';
