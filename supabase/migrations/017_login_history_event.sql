-- Tipo de cada registro del historial de conexiones:
--   login   = inició sesión con correo y contraseña
--   resume  = volvió a la app con la sesión ya abierta (recargó o reabrió la pestaña)
--   timeout = la sesión se cerró sola por inactividad (solo rol Admin)
alter table user_login_history add column if not exists event text not null default 'login';
