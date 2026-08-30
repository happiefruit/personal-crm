-- Token/cost tracking for AI calls. One row per Anthropic request.
-- cost_usd is an ESTIMATE from a hard-coded rate table — the Anthropic console
-- is authoritative.

create table if not exists ai_usage (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  model              text not null,
  operation          text not null default 'parse_note',
  input_tokens       integer not null default 0,
  output_tokens      integer not null default 0,
  cache_read_tokens  integer not null default 0,
  cache_write_tokens integer not null default 0,
  cost_usd           numeric(12, 6) not null default 0,
  note_id            uuid references notes(id) on delete set null
);

create index if not exists ai_usage_created_idx on ai_usage(created_at desc);

alter table ai_usage enable row level security;
