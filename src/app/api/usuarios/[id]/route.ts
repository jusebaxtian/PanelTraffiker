import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireSuperAdmin } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = supabaseServer();
  const body = await request.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.full_name === "string") updates.full_name = body.full_name.trim();
  if (body.role === "superadmin" || body.role === "admin") updates.role = body.role;
  if (typeof body.active === "boolean") updates.active = body.active;
  if (Array.isArray(body.module_permissions)) updates.module_permissions = body.module_permissions;

  if (updates.role === "superadmin") {
    updates.module_permissions = [];
  }

  const { data, error } = await supabase.from("user_profiles").update(updates).eq("id", id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof body.password === "string" && body.password.length >= 8) {
    const { error: pwError } = await supabase.auth.admin.updateUserById(id, { password: body.password });
    if (pwError) {
      return NextResponse.json({ error: pwError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = supabaseServer();

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
