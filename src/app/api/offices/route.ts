import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = supabaseServer();
  const { data: offices, error: officesError } = await supabase
    .from("offices")
    .select("*")
    .order("position", { ascending: true });

  if (officesError) {
    return NextResponse.json({ error: officesError.message }, { status: 500 });
  }

  const { data: agents, error: agentsError } = await supabase
    .from("agents")
    .select("*")
    .order("position", { ascending: true });

  if (agentsError) {
    return NextResponse.json({ error: agentsError.message }, { status: 500 });
  }

  const data = offices.map((office) => ({
    ...office,
    agents: agents.filter((a) => a.office_id === office.id),
  }));

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = supabaseServer();
  const body = await request.json();
  const name = String(body.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "El nombre de la oficina es obligatorio" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("offices")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("offices")
    .insert({ name, position: nextPosition })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { ...data, agents: [] } });
}
