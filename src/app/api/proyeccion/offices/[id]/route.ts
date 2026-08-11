import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseServer();
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.admin === "string") updates.admin = body.admin.trim();
  if (typeof body.asignacion === "string") updates.asignacion = body.asignacion.trim();
  if (typeof body.diario === "number") updates.diario = body.diario;
  if (typeof body.gastado === "number") updates.gastado = body.gastado;
  if (typeof body.costo_ftd_objetivo === "number") updates.costo_ftd_objetivo = body.costo_ftd_objetivo;
  if (typeof body.ftd_real === "number") updates.ftd_real = body.ftd_real;
  if (typeof body.ftd_meta_mes === "number") updates.ftd_meta_mes = body.ftd_meta_mes;
  if (Array.isArray(body.campaigns)) updates.campaigns = body.campaigns;
  if ("ghl_pipeline_id" in body) updates.ghl_pipeline_id = body.ghl_pipeline_id || null;
  if ("ghl_pipeline_name" in body) updates.ghl_pipeline_name = body.ghl_pipeline_name || null;

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
  const { id } = await params;
  const supabase = supabaseServer();
  const { error } = await supabase.from("proyeccion_offices").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
