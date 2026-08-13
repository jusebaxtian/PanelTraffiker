-- Caché de las métricas "caras" (gasto de Meta Ads y leads de GHL) por
-- mes, para no volver a consultar esas APIs en cada carga de la página
-- ni en cada edición de un campo — así se reduce el riesgo de bloqueo
-- por límite de tasa cuando entran varios usuarios a la vez.

create table if not exists proyeccion_metrics_cache (
  config_id uuid primary key references proyeccion_config(id) on delete cascade,
  gasto_by_office jsonb not null default '{}'::jsonb,
  leads_by_office jsonb not null default '{}'::jsonb,
  window_started_at timestamptz not null default now(),
  data_updated_at timestamptz not null default now(),
  force_count integer not null default 0
);
alter table proyeccion_metrics_cache enable row level security;
