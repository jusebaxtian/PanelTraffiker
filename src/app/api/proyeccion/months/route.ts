import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function defaultMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Lista los meses ya creados y garantiza que el mes calendario actual
// exista (lo crea vacío si aún no se ha entrado a ese mes), para que al
// pasar a septiembre u otro mes se arme automáticamente su propia tabla.
export async function GET() {
  const supabase = supabaseServer();
  const monthKey = currentMonthKey();

  const { data: existing, error } = await supabase
    .from("proyeccion_config")
    .select("id, month_key, month_label")
    .order("month_key", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let months = existing ?? [];

  if (!months.some((m) => m.month_key === monthKey)) {
    const { data: created, error: createError } = await supabase
      .from("proyeccion_config")
      .insert({ month_key: monthKey, month_label: defaultMonthLabel(monthKey), days_remaining: 0, costo_ftd_mes: 0 })
      .select("id, month_key, month_label")
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    months = [created, ...months].sort((a, b) => (a.month_key < b.month_key ? 1 : -1));
  }

  return NextResponse.json({ data: { months, currentMonthKey: monthKey } });
}
