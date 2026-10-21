import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireSuperAdmin, getProtectedSuperAdminId } from "@/lib/auth";

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const supabase = supabaseServer();
  const { data, error } = await supabase.from("user_profiles").select("*").order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const protectedId = await getProtectedSuperAdminId();

  // Última actividad: lo más reciente entre el aviso del navegador
  // (last_seen_*) y la última renovación del acceso (respaldo para quienes
  // aún no tienen un aviso guardado). Para el respaldo, la ciudad, IP y
  // dispositivo salen del último registro del historial de ese usuario.
  const [{ data: tokens }, { data: history }] = await Promise.all([
    supabase.rpc("user_token_activity"),
    supabase
      .from("user_login_history")
      .select("user_id, ip_address, city, region, country, user_agent, logged_in_at")
      .order("logged_in_at", { ascending: false })
      .limit(500),
  ]);
  const tokenAt = new Map<string, string>((tokens ?? []).map((t: { user_id: string; last_token_at: string }) => [t.user_id, t.last_token_at]));
  const lastHistory = new Map<string, { ip_address: string | null; city: string | null; region: string | null; country: string | null; user_agent: string | null }>();
  for (const h of history ?? []) if (!lastHistory.has(h.user_id)) lastHistory.set(h.user_id, h);

  return NextResponse.json({
    data: (data ?? []).map((u) => {
      const seenAt: string | null = u.last_seen_at ?? null;
      const tAt: string | null = tokenAt.get(u.id) ?? null;
      const useSeen = !!seenAt && (!tAt || new Date(seenAt) >= new Date(tAt));
      const fallback = lastHistory.get(u.id);
      const last_activity =
        useSeen || tAt
          ? {
              at: useSeen ? seenAt : tAt,
              ip: useSeen ? u.last_seen_ip : (fallback?.ip_address ?? null),
              city: useSeen ? u.last_seen_city : (fallback?.city ?? null),
              region: useSeen ? u.last_seen_region : (fallback?.region ?? null),
              country: useSeen ? u.last_seen_country : (fallback?.country ?? null),
              user_agent: useSeen ? u.last_seen_ua : (fallback?.user_agent ?? null),
              exact: useSeen,
            }
          : null;
      // Los datos "last_seen_*" crudos no se envían: ya van dentro de last_activity.
      const rest = Object.fromEntries(Object.entries(u).filter(([k]) => !k.startsWith("last_seen_")));
      return { ...rest, is_protected: u.id === protectedId, last_activity };
    }),
  });
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
