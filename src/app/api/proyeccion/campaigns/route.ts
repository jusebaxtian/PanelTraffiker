import { NextResponse } from "next/server";
import { fetchAllAccountsCampaigns } from "@/lib/metaAds";

export async function GET() {
  try {
    const campaigns = await fetchAllAccountsCampaigns();
    const data = campaigns.map((c) => ({
      account_id: c.account_id,
      campaign_id: c.id,
      campaign_name: c.name,
      status: c.effective_status ?? c.status,
    }));
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
