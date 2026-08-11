-- Proyección pasa a tener una tabla por mes (mes seleccionable en un
-- desplegable) y se eliminan los campos Días totales, Admin y $ Gastado.

alter table proyeccion_config add column if not exists month_key text;
update proyeccion_config set month_key = to_char(coalesce(updated_at, now()), 'YYYY-MM') where month_key is null;
alter table proyeccion_config alter column month_key set not null;
alter table proyeccion_config add constraint proyeccion_config_month_key_key unique (month_key);
alter table proyeccion_config drop column if exists total_days;

alter table proyeccion_offices add column if not exists config_id uuid references proyeccion_config(id) on delete cascade;
update proyeccion_offices set config_id = (select id from proyeccion_config order by updated_at desc limit 1) where config_id is null;
alter table proyeccion_offices alter column config_id set not null;
alter table proyeccion_offices drop column if exists admin;
alter table proyeccion_offices drop column if exists gastado;
