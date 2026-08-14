import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildConnectionStatus } from "@/lib/whatsapp";
import { requireWriteAccess } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriteAccess();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = supabaseServer();
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.label === "string") updates.label = body.label.trim();
  if (typeof body.phone_number_id === "string") updates.phone_number_id = body.phone_number_id.trim();
  if (typeof body.waba_id === "string") updates.waba_id = body.waba_id.trim() || null;
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

  return NextResponse.json({ data: await buildConnectionStatus(data) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriteAccess();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = supabaseServer();
  const { error } = await supabase.from("api_connections").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
