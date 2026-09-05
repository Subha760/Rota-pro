create table if not exists public.rota_feeds (
  token text primary key check (length(token) between 32 and 64),
  owner_id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.rota_feeds enable row level security;
revoke all on table public.rota_feeds from anon, authenticated;
create index if not exists rota_feeds_owner_updated_idx on public.rota_feeds (owner_id, updated_at desc);
comment on table public.rota_feeds is 'Private RotaPro WebCal payloads. Accessed only by server-side service credentials.';
