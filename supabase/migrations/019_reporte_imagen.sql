-- Módulo "Reporte Imagen": el reporte diario por pauta en formato tabla,
-- descargable como imagen para enviar por WhatsApp. Reutiliza los datos
-- del Reporte Diario (gasto, leads Meta, leads CRM); estos campos son solo
-- la presentación de cada fila.
alter table reporte_diario_offices
  add column if not exists report_admin text,            -- "Cristina", "Juanita"...
  add column if not exists report_label text,            -- nombre de la pauta que se muestra
  add column if not exists report_diario numeric,        -- null = total de la Distribución
  add column if not exists report_include boolean not null default true,
  add column if not exists report_position integer;
