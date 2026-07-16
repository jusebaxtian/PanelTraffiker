import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: officeId } = await params;
  const supabase = supabaseServer();
  const body = await request.json();

  const name = String(body.name ?? "").trim();
  const type = body.type === "ejecutivo" ? "ejecutivo" : "junior";
  const customValue =
    type === "ejecutivo" && typeof body.custom_value === "number" ? body.custom_value : null;

  if (!name) {
    return NextResponse.json({ error: "El nombre del agente es obligatorio" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("agents")
    .select("position")
    .eq("office_id", officeId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("agents")
    .insert({
      office_id: officeId,
      name,
      type,
      custom_value: customValue,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
