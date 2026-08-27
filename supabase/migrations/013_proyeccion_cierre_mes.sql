-- Cierre de mes en Proyección: al cerrar un mes se congelan los valores
-- de gasto/leads/$ diario que hasta entonces venían en vivo de Meta/GHL,
-- y quedan editables a mano para ajustes finales (ej. FTDs Real).
-- "closed" nunca vuelve a false una vez cerrado (no se reconecta la
-- alimentación en vivo); "locked" es solo el candado de solo-lectura que
-- sí se puede alternar con "Reabrir mes" / "Cerrar mes".
alter table proyeccion_config add column if not exists closed boolean not null default false;
alter table proyeccion_config add column if not exists locked boolean not null default false;
alter table proyeccion_config add column if not exists closed_at timestamptz;

alter table proyeccion_offices add column if not exists gasto_final numeric;
alter table proyeccion_offices add column if not exists leads_final numeric;
alter table proyeccion_offices add column if not exists diario_final numeric;
