-- Phase 5: person-to-person relationship links.
-- A link is stored as TWO directed rows (A->B and B->A) so either person's
-- profile can be queried with a single from_person_id filter.
-- Row {from: A, to: B, type: 'spouse'} reads "B is A's spouse".

create table if not exists relationships (
  id             uuid primary key default gen_random_uuid(),
  from_person_id uuid not null references people(id) on delete cascade,
  to_person_id   uuid not null references people(id) on delete cascade,
  type           text not null,
  created_at     timestamptz not null default now(),
  constraint relationships_uniq unique (from_person_id, to_person_id, type),
  constraint relationships_no_self check (from_person_id <> to_person_id)
);

create index if not exists relationships_from_idx on relationships(from_person_id);

alter table relationships enable row level security;
