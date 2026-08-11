create table if not exists proyeccion_config (
  id uuid primary key default gen_random_uuid(),
  month_label text not null default '',
  total_days int not null default 30,
  days_remaining int not null default 0,
  holidays_note text,
  updated_at timestamptz not null default now()
);

create table if not exists proyeccion_offices (
  id uuid primary key default gen_random_uuid(),
  admin text not null default '',
  asignacion text not null,
  diario numeric not null default 0,
  gastado numeric not null default 0,
  costo_ftd_objetivo numeric not null default 0,
  ftd_real numeric not null default 0,
  ftd_meta_mes numeric not null default 0,
  campaigns jsonb not null default '[]',
  ghl_pipeline_id text,
  ghl_pipeline_name text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table proyeccion_config enable row level security;
alter table proyeccion_offices enable row level security;
