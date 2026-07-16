import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllAccountsInsights,
  fetchAllAccountsCampaigns,
  conversationsStarted,
} from "@/lib/metaAds";

export async function GET(request: NextRequest) {
  const datePreset = request.nextUrl.searchParams.get("date_preset") ?? "last_30d";

  try {
    const [insights, todayInsights, campaigns] = await Promise.all([
      fetchAllAccountsInsights({ datePreset }),
      datePreset === "today"
        ? Promise.resolve<Awaited<ReturnType<typeof fetchAllAccountsInsights>>>([])
        : fetchAllAccountsInsights({ datePreset: "today" }),
      fetchAllAccountsCampaigns(),
    ]);

    const campaignById = new Map(campaigns.map((c) => [c.id, c]));
    const todaySpendByCampaign = new Map(
      (datePreset === "today" ? insights : todayInsights).map((i) => [
        i.campaign_id,
        Number(i.spend ?? 0),
      ])
    );

    const data = insights.map((row) => {
      const campaign = row.campaign_id ? campaignById.get(row.campaign_id) : undefined;
      return {
        ...row,
        result: conversationsStarted(row),
        status: campaign?.effective_status ?? campaign?.status,
        objective: campaign?.objective,
        daily_budget: campaign?.daily_budget,
        today_spend: row.campaign_id ? todaySpendByCampaign.get(row.campaign_id) ?? 0 : 0,
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
