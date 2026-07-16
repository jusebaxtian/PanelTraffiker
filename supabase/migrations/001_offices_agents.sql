create table if not exists offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  admin_amount numeric not null default 0,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references offices(id) on delete cascade,
  name text not null,
  type text not null check (type in ('junior', 'ejecutivo')),
  custom_value numeric,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists agents_office_id_idx on agents(office_id);

-- RLS enabled with no policies: only the service role (used server-side by
-- the app's API routes) can read/write. The anon/publishable key has no access.
alter table offices enable row level security;
alter table agents enable row level security;
