import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireWriteAccess } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriteAccess();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = supabaseServer();
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.asignacion === "string") updates.asignacion = body.asignacion.trim();
  if (Array.isArray(body.campaigns)) updates.campaigns = body.campaigns;
  if ("distribucion_office_id" in body) updates.distribucion_office_id = body.distribucion_office_id || null;
  if ("ghl_tag" in body) updates.ghl_tag = body.ghl_tag || null;
  if ("crm_connection_id" in body) updates.crm_connection_id = body.crm_connection_id || null;

  const { data, error } = await supabase
    .from("reporte_diario_offices")
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
  const auth = await requireWriteAccess();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = supabaseServer();
  const { error } = await supabase.from("reporte_diario_offices").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
