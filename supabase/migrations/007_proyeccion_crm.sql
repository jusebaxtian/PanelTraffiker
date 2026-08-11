-- Cada oficina de Proyección puede traer sus leads de un CRM/token de
-- GoHighLevel distinto, así que se guardan varias conexiones y cada
-- oficina se vincula a la que le corresponde.

create table if not exists proyeccion_crm_connections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location_id text not null,
  access_token text not null,
  created_at timestamptz not null default now()
);
alter table proyeccion_crm_connections enable row level security;

alter table proyeccion_offices add column if not exists crm_connection_id uuid references proyeccion_crm_connections(id);
