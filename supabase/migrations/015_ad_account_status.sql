-- Guarda el último estado conocido de cada cuenta publicitaria de Meta,
-- para poder detectar cuándo cambia (ej. Activa -> Periodo de gracia ->
-- Deshabilitada) y avisar por Telegram.
create table if not exists ad_account_status (
  account_id text primary key,
  account_name text,
  last_status integer,
  last_balance numeric,
  updated_at timestamptz not null default now()
);
alter table ad_account_status enable row level security;
