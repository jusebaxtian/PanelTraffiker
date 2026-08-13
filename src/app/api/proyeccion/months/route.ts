import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { monthLabel } from "@/lib/proyeccion";
import { bogotaMonthKey } from "@/lib/bogota";

// Lista los meses ya creados y garantiza que el mes calendario actual
// (según la hora legal de Colombia) exista, creándolo vacío si aún no se
// ha entrado a ese mes, para que al pasar a septiembre u otro mes se
// arme automáticamente su propia tabla justo a medianoche de Bogotá.
export async function GET() {
  const supabase = supabaseServer();
  const monthKey = bogotaMonthKey();

  const { data: existing, error } = await supabase
    .from("proyeccion_config")
    .select("id, month_key")
    .order("month_key", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let rows = existing ?? [];

  if (!rows.some((m) => m.month_key === monthKey)) {
    const { data: created, error: createError } = await supabase
      .from("proyeccion_config")
      .insert({ month_key: monthKey, month_label: monthLabel(monthKey), days_remaining: 0, costo_ftd_mes: 0 })
      .select("id, month_key")
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    rows = [created, ...rows].sort((a, b) => (a.month_key < b.month_key ? 1 : -1));
  }

  const months = rows.map((m) => ({ ...m, month_label: monthLabel(m.month_key) }));

  return NextResponse.json({ data: { months, currentMonthKey: monthKey } });
}
