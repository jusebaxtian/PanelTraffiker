import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { fetchPhoneNumberStatus } from "@/lib/whatsapp";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseServer();
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.label === "string") updates.label = body.label.trim();
  if (typeof body.phone_number_id === "string") updates.phone_number_id = body.phone_number_id.trim();
  if (typeof body.access_token === "string" && body.access_token.trim()) {
    updates.access_token = body.access_token.trim();
  }

  const { data, error } = await supabase
    .from("api_connections")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = await fetchPhoneNumberStatus(data.phone_number_id, data.access_token);

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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseServer();
  const { error } = await supabase.from("api_connections").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
