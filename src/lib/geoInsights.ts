import { getAllAdAccountConnections, conversationsStarted, META_BASE_URL, type ActionValue } from "@/lib/metaAds";

// Datos del módulo "Mapa Geográfica": rendimiento por país y
// región (departamento/estado) y, aparte, por género y edad. Meta NO
// permite cruzar región/país con género/edad en la misma consulta
// (error "combinación de desgloses inválida"), así que son dos vistas
// independientes: la demografía es de las campañas filtradas completas,
// no de una zona puntual.

export interface GeoZoneRow {
  country: string;
  region: string;
  spend: number;
  impressions: number;
  reach: number;
  results: number;
}

export interface GeoAdRow extends GeoZoneRow {
  account_id: string;
  account_name: string;
  campaign_id: string;
  campaign_name: string;
  ad_id: string;
  ad_name: string;
}

export interface DemoRow {
  age: string;
  gender: string;
  spend: number;
  impressions: number;
  reach: number;
  results: number;
}

export interface GeoInsightsResult {
  ads: GeoAdRow[];
  demo: DemoRow[];
  errors: string[];
}

interface RawRow {
  country?: string;
  region?: string;
  age?: string;
  gender?: string;
  campaign_id?: string;
  campaign_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  actions?: ActionValue[];
}

interface RawResponse {
  data?: RawRow[];
  paging?: { next?: string };
  error?: { message: string };
}

async function fetchPaged(url: URL, label: string): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  let next: string | null = url.toString();
  while (next) {
    const res: Response = await fetch(next, { cache: "no-store" });
    const json: RawResponse = await res.json();
    if (json.error) throw new Error(`${label}: ${json.error.message}`);
    rows.push(...(json.data ?? []));
    next = json.paging?.next ?? null;
  }
  return rows;
}

function baseUrl(accountId: string, token: string, since: string, until: string, campaignIds: string[], fields: string, breakdowns: string, level: string) {
  const url = new URL(`${META_BASE_URL}/${accountId}/insights`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("fields", fields);
  url.searchParams.set("breakdowns", breakdowns);
  url.searchParams.set("level", level);
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("limit", "500");
  if (campaignIds.length > 0) {
    url.searchParams.set("filtering", JSON.stringify([{ field: "campaign.id", operator: "IN", value: campaignIds }]));
  }
  return url;
}

const num = (v: string | undefined) => Number(v ?? 0) || 0;

export async function fetchGeoInsights(options: {
  since: string;
  until: string;
  campaignIds: string[];
}): Promise<GeoInsightsResult> {
  const { since, until, campaignIds } = options;
  const accounts = await getAllAdAccountConnections();
  const ads: GeoAdRow[] = [];
  const demoMap = new Map<string, DemoRow>();
  const errors: string[] = [];

  await Promise.all(
    accounts.map(async (a) => {
      const accountName = a.name ?? a.accountId.replace("act_", "");
      const geoFields = "ad_id,ad_name,campaign_id,campaign_name,spend,impressions,reach,actions";
      const demoFields = "spend,impressions,reach,actions";
      const [geo, demo] = await Promise.allSettled([
        fetchPaged(baseUrl(a.accountId, a.accessToken, since, until, campaignIds, geoFields, "country,region", "ad"), accountName),
        fetchPaged(baseUrl(a.accountId, a.accessToken, since, until, campaignIds, demoFields, "age,gender", "account"), accountName),
      ]);

      if (geo.status === "fulfilled") {
        for (const r of geo.value) {
          const spend = num(r.spend);
          const results = conversationsStarted({ account_id: a.accountId, actions: r.actions });
          if (spend === 0 && results === 0 && num(r.impressions) === 0) continue;
          ads.push({
            account_id: a.accountId,
            account_name: accountName,
            campaign_id: r.campaign_id ?? "",
            campaign_name: r.campaign_name ?? "-",
            ad_id: r.ad_id ?? "",
            ad_name: r.ad_name ?? "-",
            country: r.country ?? "ZZ",
            region: r.region ?? "Unknown",
            spend,
            impressions: num(r.impressions),
            reach: num(r.reach),
            results,
          });
        }
      } else {
        errors.push(String(geo.reason?.message ?? geo.reason));
      }

      if (demo.status === "fulfilled") {
        for (const r of demo.value) {
          const age = r.age ?? "unknown";
          const gender = r.gender ?? "unknown";
          const key = `${age}|${gender}`;
          const cur = demoMap.get(key) ?? { age, gender, spend: 0, impressions: 0, reach: 0, results: 0 };
          cur.spend += num(r.spend);
          cur.impressions += num(r.impressions);
          cur.reach += num(r.reach);
          cur.results += conversationsStarted({ account_id: a.accountId, actions: r.actions });
          demoMap.set(key, cur);
        }
      } else {
        errors.push(String(demo.reason?.message ?? demo.reason));
      }
    })
  );

  return { ads, demo: [...demoMap.values()], errors };
}
