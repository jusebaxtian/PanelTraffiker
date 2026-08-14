import { NextResponse } from "next/server";
import { supabaseServerAuth } from "@/lib/supabaseServerAuth";
import { supabaseServer } from "@/lib/supabaseServer";
import type { ModuleKey } from "@/lib/modules";

export type { ModuleKey };
export type Role = "superadmin" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  active: boolean;
  module_permissions: string[];
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabaseAuth = await supabaseServerAuth();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) return null;

  const supabase = supabaseServer();
  const { data: profile } = await supabase.from("user_profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile || !profile.active) return null;

  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
    active: profile.active,
    module_permissions: profile.module_permissions ?? [],
  };
}

export function hasModuleAccess(user: UserProfile, moduleKey: ModuleKey): boolean {
  return user.role === "superadmin" || user.module_permissions.includes(moduleKey);
}

type AuthResult = { user: UserProfile } | { error: NextResponse };

export async function requireUser(): Promise<AuthResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }
  return { user };
}

export async function requireSuperAdmin(): Promise<AuthResult> {
  const result = await requireUser();
  if ("error" in result) return result;
  if (result.user.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Solo el SuperAdmin puede hacer esto" }, { status: 403 }) };
  }
  return result;
}

// El rol admin es de solo lectura en toda la app, salvo el campo FTDs
// Real y la configuración (Días faltantes, $ FTD) de Proyección —
// cualquier otra escritura queda bloqueada aquí.
export async function requireWriteAccess(): Promise<AuthResult> {
  const result = await requireUser();
  if ("error" in result) return result;
  if (result.user.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Tu rol solo tiene acceso de lectura" }, { status: 403 }) };
  }
  return result;
}

// Permite escribir a SuperAdmin siempre, y a Admin solo si tiene
// permiso de ver ese módulo (ej. la config de Proyección).
export async function requireModuleWriteAccess(moduleKey: ModuleKey): Promise<AuthResult> {
  const result = await requireUser();
  if ("error" in result) return result;
  if (result.user.role !== "superadmin" && !result.user.module_permissions.includes(moduleKey)) {
    return { error: NextResponse.json({ error: "No tienes acceso a este módulo" }, { status: 403 }) };
  }
  return result;
}
