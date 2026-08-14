import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireWriteAccess } from "@/lib/auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriteAccess();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = supabaseServer();
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.account_id === "string" && body.account_id.trim()) {
    updates.account_id = body.account_id.trim().startsWith("act_")
      ? body.account_id.trim()
      : `act_${body.account_id.trim()}`;
  }
  if (typeof body.access_token === "string" && body.access_token.trim()) updates.access_token = body.access_token.trim();

  const { data, error } = await supabase
    .from("meta_ad_accounts")
    .update(updates)
    .eq("id", id)
    .select("id, name, account_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireWriteAccess();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = supabaseServer();
  const { error } = await supabase.from("meta_ad_accounts").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
