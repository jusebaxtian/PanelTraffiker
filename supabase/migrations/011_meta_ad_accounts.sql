-- Cuentas publicitarias de Meta que se pueden agregar desde el panel
-- (nombre, Account ID y token propio), además de las que ya vienen
-- configuradas por variables de entorno (META_ACCESS_TOKEN /
-- META_AD_ACCOUNT_IDS). Se combinan las dos fuentes al consultar Meta.

create table if not exists meta_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_id text not null,
  access_token text not null,
  created_at timestamptz not null default now()
);
alter table meta_ad_accounts enable row level security;
