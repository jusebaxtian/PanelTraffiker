create table if not exists api_connections (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  phone_number_id text not null,
  access_token text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- RLS enabled with no policies: only the service role (used server-side by
-- the app's API routes) can read/write, so the stored access_token is never
-- reachable via the anon/publishable key.
alter table api_connections enable row level security;
