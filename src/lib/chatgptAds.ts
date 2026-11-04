import { supabaseServer } from "@/lib/supabaseServer";

// Módulo "ChatGPT Ads": lectura de la cuenta publicitaria de ChatGPT por
// la Advertiser API de OpenAI (solo se hacen consultas GET). La llave es
// por cuenta y se guarda en chatgpt_ads_accounts, igual que los tokens de
// Meta en meta_ad_accounts.
const BASE_URL = "https://api.ads.openai.com/v1";
const BOGOTA_OFFSET_S = 5 * 60 * 60;

export interface GptMetrics {
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  cpa: number | null;
  cvr: number;
}

export interface GptDay extends GptMetrics {
  date: string;
  ads: (GptMetrics & { ad_id: string; ad_name: string })[];
}

export interface GptAd extends GptMetrics {
  id: string;
  name: string;
  status: string;
  review_status: string;
  title: string | null;
  body: string | null;
  target_url: string | null;
  ad_group_name: string | null;
  campaign_name: string | null;
}

export interface GptSegment {
  key: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
}

export interface GptReport {
  account: { name: string; status: string; currency: string; timezone: string };
  range: { since: string; until: string };
  totals: GptMetrics;
  days: GptDay[];
  ads: GptAd[];
  campaigns: {
    id: string;
    name: string;
    status: string;
    daily_budget: number | null;
    countries: string[];
    conversion_events: string[];
    context_hints: string[];
  }[];
  devices: GptSegment[];
  platforms: GptSegment[];
}

type Row = Record<string, unknown>;

async function getApiKey(): Promise<string> {
  const { data, error } = await supabaseServer()
    .from("chatgpt_ads_accounts")
    .select("api_key")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.api_key) throw new Error("No hay una cuenta de ChatGPT Ads conectada");
  return data.api_key;
}

async function apiGet(key: string, path: string, params: [string, string][] = []): Promise<Row> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of params) url.searchParams.append(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`ChatGPT Ads (${path}): ${json?.error?.message ?? res.status}`);
  }
  return json;
}

// Las listas e insights paginan con has_more + last_id.
async function apiList(key: string, path: string, params: [string, string][] = []): Promise<Row[]> {
  const rows: Row[] = [];
  let after: string | null = null;
  for (let page = 0; page < 20; page++) {
    const json: Row = await apiGet(key, path, after ? [...params, ["after", after]] : params);
    rows.push(...((json.data as Row[]) ?? []));
    if (!json.has_more || !json.last_id) break;
    after = json.last_id as string;
  }
  return rows;
}

const n = (v: unknown) => Number(v ?? 0) || 0;

function metrics(r: Row | undefined): GptMetrics {
  return {
    impressions: n(r?.impressions),
    clicks: n(r?.clicks),
    spend: n(r?.spend),
    ctr: n(r?.ctr),
    cpc: n(r?.cpc),
    cpm: n(r?.cpm),
    conversions: n(r?.conversions),
    // Sin conversiones la API devuelve null, no 0.
    cpa: r?.cpa === null || r?.cpa === undefined ? null : Number(r.cpa),
    cvr: n(r?.post_click_cvr),
  };
}

function bogotaDate(epochSeconds: unknown): string {
  return new Date((n(epochSeconds) - BOGOTA_OFFSET_S) * 1000).toISOString().slice(0, 10);
}

const FULL = ["impressions", "clicks", "spend", "ctr", "cpc", "cpm", "conversions", "cpa", "post_click_cvr"];
const DELIVERY = ["impressions", "clicks", "spend", "ctr"];

export async function fetchChatgptAdsReport(since: string, until: string): Promise<GptReport> {
  const key = await getApiKey();
  const range = JSON.stringify({ type: "date_range", since, until });

  const insights = (fields: string[], extra: [string, string][]) =>
    apiList(key, "/ad_account/insights", [
      ["time_ranges[]", range],
      ["limit", "2000"],
      ...fields.map((f): [string, string] => ["fields[]", f]),
      ...extra,
    ]);

  const adFields = [...FULL, "ad_id", "ad_name"];
  const [account, campaigns, adGroups, ads, eventSettings, total, daily, byAd, byAdDay, devices, platforms] = await Promise.all([
    apiGet(key, "/ad_account"),
    apiList(key, "/campaigns", [["limit", "500"]]),
    apiList(key, "/ad_groups", [["limit", "500"]]),
    apiList(key, "/ads", [["limit", "500"]]),
    apiList(key, "/conversions/event_settings", [["limit", "100"]]).catch(() => [] as Row[]),
    insights(FULL, [["time_granularity", "none"]]),
    insights(FULL, [["time_granularity", "daily"]]),
    insights(adFields, [["aggregation_level", "ad"], ["time_granularity", "none"]]),
    insights(adFields, [["aggregation_level", "ad"], ["time_granularity", "daily"]]),
    // Los segmentos solo admiten métricas de entrega, no conversiones.
    insights(DELIVERY, [["time_granularity", "none"], ["segments[]", "device"]]),
    insights(DELIVERY, [["time_granularity", "none"], ["segments[]", "platform"]]),
  ]);

  const adDayByDate = new Map<string, GptDay["ads"]>();
  for (const r of byAdDay) {
    const date = bogotaDate(r.start_time);
    const list = adDayByDate.get(date) ?? [];
    list.push({ ...metrics(r), ad_id: String(r.ad_id ?? ""), ad_name: String(r.ad_name ?? "-") });
    adDayByDate.set(date, list);
  }

  const days: GptDay[] = daily
    .map((r) => {
      const date = bogotaDate(r.start_time);
      return { ...metrics(r), date, ads: (adDayByDate.get(date) ?? []).sort((a, b) => b.spend - a.spend) };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const metricsByAd = new Map(byAd.map((r) => [String(r.ad_id), r]));
  const firstGroup = adGroups[0];
  const firstCampaign = campaigns[0];

  const adRows: GptAd[] = ads
    .map((a) => {
      const creative = (a.creative ?? {}) as Row;
      return {
        ...metrics(metricsByAd.get(String(a.id))),
        id: String(a.id),
        name: String(a.name ?? "-"),
        status: String(a.status ?? "-"),
        review_status: String(a.review_status ?? "-"),
        title: (creative.title as string) ?? null,
        body: (creative.body as string) ?? null,
        target_url: (creative.target_url as string) ?? null,
        // La lista de anuncios no trae a qué conjunto pertenece: se nombra
        // solo cuando hay un único conjunto y una única campaña.
        ad_group_name: adGroups.length === 1 ? String(firstGroup.name ?? "") : null,
        campaign_name: campaigns.length === 1 ? String(firstCampaign.name ?? "") : null,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  const segment = (rows: Row[], field: string): GptSegment[] =>
    rows
      .map((r) => ({ key: String(r[field] ?? "-"), impressions: n(r.impressions), clicks: n(r.clicks), spend: n(r.spend), ctr: n(r.ctr) }))
      .sort((a, b) => b.impressions - a.impressions);

  return {
    account: {
      name: String(account.name ?? "-"),
      status: String(account.status ?? "-"),
      currency: String(account.currency_code ?? "COP"),
      timezone: String(account.timezone ?? "-"),
    },
    range: { since, until },
    totals: metrics(total[0]),
    days,
    ads: adRows,
    campaigns: campaigns.map((c) => {
      const budget = (c.budget ?? {}) as Row;
      const include = (((c.targeting ?? {}) as Row).locations as Row | undefined)?.include as Row[] | undefined;
      return {
        id: String(c.id),
        name: String(c.name ?? "-"),
        status: String(c.status ?? "-"),
        // Los presupuestos vienen en micros (1.000.000 = 1 unidad de moneda).
        daily_budget: budget.daily_spend_limit_micros ? n(budget.daily_spend_limit_micros) / 1_000_000 : null,
        countries: (include ?? []).map((l) => String(l.name ?? l.country_code ?? "-")),
        conversion_events: eventSettings
          .filter((e) => ((e.campaigns as Row[]) ?? []).some((ec) => ec.id === c.id))
          .map((e) => String(e.name ?? "-")),
        context_hints: adGroups.flatMap((g) => (g.campaign_id && g.campaign_id !== c.id ? [] : ((g.context_hints as string[]) ?? []))),
      };
    }),
    devices: segment(devices, "device_type"),
    platforms: segment(platforms, "platform"),
  };
}
