import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = supabaseServer();
  const body = await request.json();

  // Con el mes cerrado y bloqueado, ningún campo se edita — hay que
  // reabrirlo primero. Reabierto, sí se puede ajustar todo a mano.
  const { data: office } = await supabase
    .from("proyeccion_offices")
    .select("config_id")
    .eq("id", id)
    .maybeSingle();
  if (office) {
    const { data: config } = await supabase
      .from("proyeccion_config")
      .select("closed, locked")
      .eq("id", office.config_id)
      .maybeSingle();
    if (config?.closed && config.locked) {
      return NextResponse.json({ error: "El mes está cerrado — reábrelo para editar" }, { status: 403 });
    }
  }

  // El rol admin es de solo lectura en toda la app, salvo este campo:
  // puede actualizar FTDs Real en Proyección. Cualquier otro campo en el
  // body se ignora si no es SuperAdmin.
  const isSuperAdmin = auth.user.role === "superadmin";
  const updates: Record<string, unknown> = {};

  if (isSuperAdmin) {
    if (typeof body.asignacion === "string") updates.asignacion = body.asignacion.trim();
    if (Array.isArray(body.campaigns)) updates.campaigns = body.campaigns;
    if ("distribucion_office_id" in body) updates.distribucion_office_id = body.distribucion_office_id || null;
    if ("ghl_tag" in body) updates.ghl_tag = body.ghl_tag || null;
    if ("crm_connection_id" in body) updates.crm_connection_id = body.crm_connection_id || null;
    // Ajustes manuales sobre un mes ya cerrado (gasto/leads/$ diario
    // congelados, editables mientras el cierre está desbloqueado).
    if (typeof body.gasto_final === "number") updates.gasto_final = body.gasto_final;
    if (typeof body.leads_final === "number") updates.leads_final = body.leads_final;
    if (typeof body.diario_final === "number") updates.diario_final = body.diario_final;
  }
  if (typeof body.ftd_real === "number") updates.ftd_real = body.ftd_real;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No hay campos permitidos para actualizar" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("proyeccion_offices")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (auth.user.role !== "superadmin") {
    return NextResponse.json({ error: "Tu rol solo tiene acceso de lectura" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = supabaseServer();
  const { error } = await supabase.from("proyeccion_offices").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
