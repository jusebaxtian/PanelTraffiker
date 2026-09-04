-- Nueva columna "Leads/FB": leads obtenidos directamente de las campañas
-- de Meta seleccionadas (conversaciones iniciadas), antes de la columna
-- de leads del CRM.
alter table proyeccion_metrics_cache add column if not exists leads_meta_by_office jsonb not null default '{}'::jsonb;
alter table proyeccion_offices add column if not exists leads_meta_final numeric;
