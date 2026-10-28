import { NextRequest, NextResponse } from "next/server";
import { requireWriteAccess } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";

// Configuración de una fila del Reporte Imagen (solo SuperAdmin).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriteAccess();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.report_admin === "string") updates.report_admin = body.report_admin.trim() || null;
  if (typeof body.report_label === "string") updates.report_label = body.report_label.trim() || null;
  if ("report_diario" in body) {
    const n = Number(body.report_diario);
    updates.report_diario = body.report_diario === null || body.report_diario === "" || !Number.isFinite(n) ? null : Math.max(0, Math.round(n));
  }
  if (typeof body.report_include === "boolean") updates.report_include = body.report_include;
  if (Number.isInteger(body.report_position)) updates.report_position = body.report_position;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { error } = await supabaseServer().from("reporte_diario_offices").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
