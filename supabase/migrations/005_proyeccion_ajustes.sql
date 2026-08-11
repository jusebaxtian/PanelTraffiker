-- Costo FTD pasa a ser un valor global editable por mes (no por oficina).
alter table proyeccion_config add column if not exists costo_ftd_mes numeric not null default 0;
alter table proyeccion_config drop column if exists holidays_note;

-- Vincular cada fila de Proyección con una oficina real de Distribución
-- (de ahí se toma el $ Diario) y cambiar de "pipeline de GHL" a
-- "etiqueta de contacto de GHL" para contar leads.
alter table proyeccion_offices add column if not exists distribucion_office_id uuid;
alter table proyeccion_offices add column if not exists ghl_tag text;
