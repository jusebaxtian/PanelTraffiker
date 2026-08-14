import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { bogotaYesterdayDateString } from "@/lib/bogota";

// Lista las fechas que ya tienen historial guardado, más "ayer" (hora de
// Colombia) aunque todavía no se haya construido su snapshot, para que
// siempre aparezca como opción por defecto.
export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("reporte_diario_snapshots")
    .select("snapshot_date")
    .order("snapshot_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const yesterday = bogotaYesterdayDateString();
  const dates = Array.from(new Set((data ?? []).map((r) => r.snapshot_date)));
  if (!dates.includes(yesterday)) {
    dates.unshift(yesterday);
  }
  dates.sort((a, b) => (a < b ? 1 : -1));

  return NextResponse.json({ data: { dates, yesterday } });
}
