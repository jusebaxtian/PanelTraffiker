import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET(request: NextRequest, { params }: { params: Promise<{ monthKey: string }> }) {
  const { monthKey } = await params;
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("proyeccion_config")
    .select("*")
    .eq("month_key", monthKey)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Mes no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ monthKey: string }> }) {
  const { monthKey } = await params;
  const supabase = supabaseServer();
  const body = await request.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.month_label === "string") updates.month_label = body.month_label;
  if (typeof body.days_remaining === "number") updates.days_remaining = body.days_remaining;
  if (typeof body.costo_ftd_mes === "number") updates.costo_ftd_mes = body.costo_ftd_mes;

  const { data, error } = await supabase
    .from("proyeccion_config")
    .update(updates)
    .eq("month_key", monthKey)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
