import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireSuperAdmin } from "@/lib/auth";

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const supabase = supabaseServer();
  const { data, error } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.full_name ?? "").trim();
  const role = body.role === "superadmin" ? "superadmin" : "admin";
  const modulePermissions = Array.isArray(body.module_permissions) ? body.module_permissions : [];

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Correo y contraseña (mínimo 8 caracteres) son obligatorios" },
      { status: 400 }
    );
  }

  const supabase = supabaseServer();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "No se pudo crear el usuario" }, { status: 500 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .insert({
      id: created.user.id,
      email,
      full_name: fullName,
      role,
      active: true,
      module_permissions: role === "superadmin" ? [] : modulePermissions,
    })
    .select()
    .single();

  if (profileError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ data: profile });
}
