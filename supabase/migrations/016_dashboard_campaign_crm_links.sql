-- Vínculo manual, por campaña de Meta, con el CRM (GoHighLevel) + etiqueta
-- que debe usarse para contar sus leads en el Dashboard. Es el mismo
-- concepto que ya existe en Proyección/Reporte Diario, pero a nivel de
-- campaña individual (el Dashboard lista TODAS las campañas, no solo
-- las agrupadas por oficina).
create table if not exists dashboard_campaign_crm_links (
  campaign_id text primary key,
  crm_connection_id uuid references proyeccion_crm_connections(id) on delete set null,
  ghl_tag text,
  updated_at timestamptz not null default now()
);
alter table dashboard_campaign_crm_links enable row level security;
