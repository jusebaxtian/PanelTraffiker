-- Última actividad de cada usuario (para el "Historial de actividad").
-- Se actualiza cuando el navegador avisa que la persona sigue usando el
-- panel (máximo una vez por minuto).
alter table user_profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_seen_ip text,
  add column if not exists last_seen_city text,
  add column if not exists last_seen_region text,
  add column if not exists last_seen_country text,
  add column if not exists last_seen_ua text;

-- Última vez que se renovó el acceso de cada usuario (Supabase Auth lo
-- renueva cada hora mientras la persona usa el panel). Sirve como dato de
-- respaldo para quienes todavía no tienen actividad registrada arriba.
-- Solo la puede ejecutar el servidor (service_role).
create or replace function user_token_activity()
returns table(user_id uuid, last_token_at timestamptz)
language sql
security definer
set search_path = auth, public
as $$
  select p.id, max(r.created_at)
  from paneltraffiker.user_profiles p
  join auth.refresh_tokens r on r.user_id = p.id::text
  group by p.id
$$;
revoke all on function user_token_activity() from public, anon, authenticated;
grant execute on function user_token_activity() to service_role;
