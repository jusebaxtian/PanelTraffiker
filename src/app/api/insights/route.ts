import { NextRequest, NextResponse } from "next/server";
import {
  fetchAllAccountsInsights,
  fetchAllAccountsCampaigns,
  fetchAllAccountsBilling,
  conversationsStarted,
  type AdInsight,
} from "@/lib/metaAds";
import { supabaseServer } from "@/lib/supabaseServer";
import { countContactsByTagInMonth } from "@/lib/ghl";
import { bogotaPresetToRange, bogotaRangeBetween } from "@/lib/bogota";

interface CrmLinkRow {
  campaign_id: string;
  crm_connection_id: string | null;
  ghl_tag: string | null;
}

interface CrmConnectionRow {
  id: string;
  location_id: string;
  access_token: string;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const since = params.get("since");
  const until = params.get("until");
  const datePreset = params.get("date_preset") ?? "last_30d";
  const timeRange = since && until ? { since, until } : undefined;
  const isToday = !timeRange && datePreset === "today";

  try {
    const supabase = supabaseServer();
    const [metaInsights, todayInsights, campaigns, billing, { data: links }, { data: crmConnections }] = await Promise.all([
      fetchAllAccountsInsights(timeRange ? { timeRange } : { datePreset }),
      isToday
        ? Promise.resolve<Awaited<ReturnType<typeof fetchAllAccountsInsights>>>([])
        : fetchAllAccountsInsights({ datePreset: "today" }),
      fetchAllAccountsCampaigns(),
      fetchAllAccountsBilling().catch(() => []),
      supabase.from("dashboard_campaign_crm_links").select("campaign_id, crm_connection_id, ghl_tag"),
      supabase.from("proyeccion_crm_connections").select("id, location_id, access_token"),
    ]);

    const campaignById = new Map(campaigns.map((c) => [c.id, c]));

    // Meta solo devuelve métricas de campañas que gastaron en el rango, así
    // que una campaña activa que aún no entrega (p. ej. temprano en el día)
    // no salía en la tabla. Se agregan en cero, salvo las de cuentas
    // deshabilitadas o cerradas, cuyas campañas "activas" no pueden entregar.
    const blockedAccounts = new Set(
      billing.filter((b) => b.accountStatus === 2 || b.accountStatus === 101).map((b) => b.accountId.replace("act_", ""))
    );
    const withData = new Set(metaInsights.map((i) => i.campaign_id));
    const idleActive: AdInsight[] = campaigns
      .filter(
        (c) =>
          c.effective_status === "ACTIVE" &&
          !withData.has(c.id) &&
          !blockedAccounts.has((c.account_id ?? "").replace("act_", ""))
      )
      .map((c) => ({
        account_id: c.account_id ?? "",
        campaign_id: c.id,
        campaign_name: c.name,
        spend: "0",
        impressions: "0",
        clicks: "0",
        reach: "0",
        ctr: "0",
        frequency: "0",
        unique_clicks: "0",
      }));
    const insights = [...metaInsights, ...idleActive];
    const todaySpendByCampaign = new Map(
      (isToday ? insights : todayInsights).map((i) => [i.campaign_id, Number(i.spend ?? 0)])
    );

    // Rango de fechas equivalente en hora de Colombia, para consultar el
    // CRM con el mismo período que se está viendo (Meta interpreta el
    // date_preset por su cuenta, esto es aparte solo para GHL).
    const { since: ghlSince, until: ghlUntil } = timeRange ?? bogotaPresetToRange(datePreset);
    const ghlRange = bogotaRangeBetween(ghlSince, ghlUntil);

    const linkByCampaignId = new Map((links ?? []).map((l: CrmLinkRow) => [l.campaign_id, l]));
    const connectionById = new Map((crmConnections ?? []).map((c: CrmConnectionRow) => [c.id, c]));

    // Un mismo CRM+etiqueta puede estar vinculado a varias campañas: se
    // consulta una sola vez por combinación, no una vez por campaña.
    const leadsCache = new Map<string, Promise<number>>();
    function leadsFor(connectionId: string, tag: string): Promise<number> {
      const key = `${connectionId}::${tag}`;
      if (!leadsCache.has(key)) {
        const connection = connectionById.get(connectionId);
        const promise = connection
          ? countContactsByTagInMonth(
              { locationId: connection.location_id, accessToken: connection.access_token },
              tag,
              ghlRange.start,
              ghlRange.end
            ).catch(() => 0)
          : Promise.resolve(0);
        leadsCache.set(key, promise);
      }
      return leadsCache.get(key)!;
    }

    const data = await Promise.all(
      insights.map(async (row) => {
        const campaign = row.campaign_id ? campaignById.get(row.campaign_id) : undefined;
        const link = row.campaign_id ? linkByCampaignId.get(row.campaign_id) : undefined;
        const leadsCrm =
          link?.crm_connection_id && link.ghl_tag ? await leadsFor(link.crm_connection_id, link.ghl_tag) : null;
        return {
          ...row,
          result: conversationsStarted(row),
          account_name: campaign?.account_name ?? null,
          status: campaign?.effective_status ?? campaign?.status,
          objective: campaign?.objective,
          daily_budget: campaign?.daily_budget,
          budget_level: campaign?.budget_level ?? null,
          today_spend: row.campaign_id ? todaySpendByCampaign.get(row.campaign_id) ?? 0 : 0,
          leads_crm: leadsCrm,
          crm_connection_id: link?.crm_connection_id ?? null,
          ghl_tag: link?.ghl_tag ?? null,
        };
      })
    );

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
