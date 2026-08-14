-- Módulo Reporte Diario: una lista de "campañas" rastreadas (igual
-- vinculación manual que en Proyección: campañas de Meta + CRM/etiqueta
-- de GHL), y un historial permanente de resultados por día. Una vez
-- guardado el snapshot de un día, ya no se vuelve a consultar la API
-- para ese día — así se preserva el historial exacto de todos los
-- días y meses.

create table if not exists reporte_diario_offices (
  id uuid primary key default gen_random_uuid(),
  asignacion text not null default '',
  campaigns jsonb not null default '[]'::jsonb,
  distribucion_office_id uuid,
  ghl_tag text,
  crm_connection_id uuid references proyeccion_crm_connections(id),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
alter table reporte_diario_offices enable row level security;

create table if not exists reporte_diario_snapshots (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references reporte_diario_offices(id) on delete cascade,
  snapshot_date date not null,
  gasto numeric not null default 0,
  leads_meta numeric not null default 0,
  leads_crm numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (office_id, snapshot_date)
);
alter table reporte_diario_snapshots enable row level security;
create index if not exists reporte_diario_snapshots_date_idx on reporte_diario_snapshots(snapshot_date);
