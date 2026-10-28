import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { getOrBuildSnapshot } from "@/lib/reporteDiarioSnapshot";
import { bogotaYesterdayDateString } from "@/lib/bogota";

interface ReportConfigRow {
  id: string;
  report_admin: string | null;
  report_label: string | null;
  report_diario: number | null;
  report_include: boolean;
  report_position: number | null;
}

// Módulo "Reporte Imagen": el Reporte Diario (gasto, leads Meta, leads
// CRM ya guardados por oficina) presentado como la tabla que se envía por
// WhatsApp. Solo agrega la presentación de cada fila (Admin, nombre de la
// pauta, valor Diario y si se incluye).
export async function GET(request: NextRequest) {
  const auth = await requireModuleAccess("reporte-imagen");
  if ("error" in auth) return auth.error;

  const date = request.nextUrl.searchParams.get("date") ?? bogotaYesterdayDateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  try {
    const [{ data: offices }, { data: configRows, error }] = await Promise.all([
      getOrBuildSnapshot(date),
      supabaseServer()
        .from("reporte_diario_offices")
        .select("id, report_admin, report_label, report_diario, report_include, report_position"),
    ]);
    if (error) throw new Error(error.message);

    const configById = new Map((configRows ?? []).map((c: ReportConfigRow) => [c.id, c]));
    const rows = offices
      .map((o) => {
        const c = configById.get(o.id);
        return {
          id: o.id,
          asignacion: o.asignacion,
          admin: c?.report_admin ?? "",
          label: c?.report_label || o.asignacion,
          diario: c?.report_diario ?? o.diario,
          diario_is_custom: c?.report_diario !== null && c?.report_diario !== undefined,
          diario_distribucion: o.diario,
          include: c?.report_include ?? true,
          position: c?.report_position ?? 999,
          resultados_meta: o.leads_meta,
          leads_crm: o.leads_crm,
          inversion: o.gasto,
        };
      })
      .sort((a, b) => a.position - b.position || a.asignacion.localeCompare(b.asignacion));

    return NextResponse.json({ data: { date, rows } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error armando el reporte" }, { status: 500 });
  }
}
