import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireWriteAccess } from "@/lib/auth";

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("dashboard_campaign_crm_links")
    .select("campaign_id, crm_connection_id, ghl_tag");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireWriteAccess();
  if ("error" in auth) return auth.error;

  const supabase = supabaseServer();
  const body = await request.json();

  const campaignId = String(body.campaign_id ?? "").trim();
  if (!campaignId) {
    return NextResponse.json({ error: "campaign_id es requerido" }, { status: 400 });
  }

  const crmConnectionId = body.crm_connection_id || null;
  const ghlTag = body.ghl_tag || null;

  const { data, error } = await supabase
    .from("dashboard_campaign_crm_links")
    .upsert(
      { campaign_id: campaignId, crm_connection_id: crmConnectionId, ghl_tag: ghlTag, updated_at: new Date().toISOString() },
      { onConflict: "campaign_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
