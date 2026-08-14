import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildConnectionStatus } from "@/lib/whatsapp";
import { requireWriteAccess } from "@/lib/auth";

export async function GET() {
  const supabase = supabaseServer();
  const { data: connections, error } = await supabase
    .from("api_connections")
    .select("*")
    .order("position", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const data = await Promise.all(connections.map(buildConnectionStatus));

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = await requireWriteAccess();
  if ("error" in auth) return auth.error;

  const supabase = supabaseServer();
  const body = await request.json();

  const label = String(body.label ?? "").trim();
  const phoneNumberId = String(body.phone_number_id ?? "").trim();
  const accessToken = String(body.access_token ?? "").trim();
  const wabaId = String(body.waba_id ?? "").trim() || null;

  if (!label || !phoneNumberId || !accessToken) {
    return NextResponse.json(
      { error: "Nombre, ID de número y token son obligatorios" },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("api_connections")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("api_connections")
    .insert({
      label,
      phone_number_id: phoneNumberId,
      access_token: accessToken,
      waba_id: wabaId,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: await buildConnectionStatus(data) });
}
