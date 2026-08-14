-- Módulo Usuarios: roles (superadmin / admin), permisos por módulo para
-- el rol admin, y un historial de conexiones (fecha/hora + ciudad) por
-- usuario. auth.users es compartida entre proyectos en esta instancia
-- de Supabase self-hosted, así que solo se referencia por id — todo lo
-- propio de PanelTraffiker vive en estas tablas del schema paneltraffiker.

create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'admin' check (role in ('superadmin', 'admin')),
  active boolean not null default true,
  module_permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table user_profiles enable row level security;

create table if not exists user_login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  logged_in_at timestamptz not null default now(),
  ip_address text,
  city text,
  region text,
  country text,
  user_agent text
);
alter table user_login_history enable row level security;
create index if not exists user_login_history_user_id_idx on user_login_history(user_id, logged_in_at desc);
