import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("proyeccion_config")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  const supabase = supabaseServer();
  const body = await request.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.month_label === "string") updates.month_label = body.month_label;
  if (typeof body.total_days === "number") updates.total_days = body.total_days;
  if (typeof body.days_remaining === "number") updates.days_remaining = body.days_remaining;
  if (typeof body.holidays_note === "string") updates.holidays_note = body.holidays_note;

  const { data: existing } = await supabase
    .from("proyeccion_config")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const query = existing
    ? supabase.from("proyeccion_config").update(updates).eq("id", existing.id)
    : supabase.from("proyeccion_config").insert(updates);

  const { data, error } = await query.select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
