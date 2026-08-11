import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

// El access_token nunca se expone al cliente: solo se usa server-side
// para consultar la API de GoHighLevel.
export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("proyeccion_crm_connections")
    .select("id, name, location_id")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = supabaseServer();
  const body = await request.json();

  const name = String(body.name ?? "").trim();
  const locationId = String(body.location_id ?? "").trim();
  const accessToken = String(body.access_token ?? "").trim();

  if (!name || !locationId || !accessToken) {
    return NextResponse.json({ error: "Nombre, Location ID y Token son obligatorios" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("proyeccion_crm_connections")
    .insert({ name, location_id: locationId, access_token: accessToken })
    .select("id, name, location_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
