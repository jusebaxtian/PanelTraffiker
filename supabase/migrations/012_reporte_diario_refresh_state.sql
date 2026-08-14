-- Límite de refrescos manuales para el botón "Actualizar" de Reporte
-- Diario, igual que ya existe en Proyección: máximo 2 consultas frescas
-- cada 30 minutos por día consultado, para no saturar las APIs.
create table if not exists reporte_diario_refresh_state (
  snapshot_date date primary key,
  window_started_at timestamptz not null default now(),
  force_count integer not null default 0
);
alter table reporte_diario_refresh_state enable row level security;
