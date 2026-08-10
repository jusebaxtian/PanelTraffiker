import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { fetchPhoneNumberStatus } from "@/lib/whatsapp";

export async function GET() {
  const supabase = supabaseServer();
  const { data: connections, error } = await supabase
    .from("api_connections")
    .select("*")
    .order("position", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const data = await Promise.all(
    connections.map(async (conn) => {
      const result = await fetchPhoneNumberStatus(conn.phone_number_id, conn.access_token);
      return {
        id: conn.id,
        label: conn.label,
        phone_number_id: conn.phone_number_id,
        display_phone_number: result.data?.display_phone_number ?? null,
        verified_name: result.data?.verified_name ?? null,
        quality_rating: result.ok ? result.data?.quality_rating ?? "UNKNOWN" : null,
        error: result.ok ? null : result.error,
      };
    })
  );

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = supabaseServer();
  const body = await request.json();

  const label = String(body.label ?? "").trim();
  const phoneNumberId = String(body.phone_number_id ?? "").trim();
  const accessToken = String(body.access_token ?? "").trim();

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
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = await fetchPhoneNumberStatus(phoneNumberId, accessToken);

  return NextResponse.json({
    data: {
      id: data.id,
      label: data.label,
      phone_number_id: data.phone_number_id,
      display_phone_number: result.data?.display_phone_number ?? null,
      verified_name: result.data?.verified_name ?? null,
      quality_rating: result.ok ? result.data?.quality_rating ?? "UNKNOWN" : null,
      error: result.ok ? null : result.error,
    },
  });
}
