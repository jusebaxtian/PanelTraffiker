import { getAllAdAccountConnections, conversationsStarted, META_BASE_URL, type ActionValue } from "@/lib/metaAds";
import {
  creativeFormat,
  diagnose,
  type AdDay,
  type AdLifetime,
  type AdPeriodStats,
  type Diagnosis,
} from "@/lib/adDiagnosis";

// Datos del módulo "Mis Anuncios": rendimiento de cada anuncio en el
// período elegido, el período anterior equivalente, el histórico de toda
// su vida y la serie diaria, más su creativo (miniatura, texto, formato)
// y el diagnóstico automático.

export interface AdReport {
  ad_id: string;
  ad_name: string;
  account_id: string;
  account_name: string;
  campaign_id: string;
  campaign_name: string;
  adset_name: string | null;
  status: string;
  created_time: string | null;
  thumbnail: string | null;
  image_url: string | null;
  format: string;
  cta: string | null;
  body: string | null;
  title: string | null;
  preview_link: string | null;
  cur: AdPeriodStats;
  prev: AdPeriodStats | null;
  lifetime: AdLifetime | null;
  daily: AdDay[];
  diagnosis: Diagnosis;
}

interface RawRow {
  ad_id?: string;
  ad_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  inline_link_clicks?: string;
  inline_link_click_ctr?: string;
  cpm?: string;
  actions?: ActionValue[];
}

interface Paged<T> {
  data?: T[];
  paging?: { next?: string };
  error?: { message: string };
}

async function fetchAll<T>(url: URL, label: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = url.toString();
  while (next) {
    const res: Response = await fetch(next, { cache: "no-store" });
    const json: Paged<T> = await res.json();
    if (json.error) throw new Error(`${label}: ${json.error.message}`);
    out.push(...(json.data ?? []));
    next = json.paging?.next ?? null;
  }
  return out;
}

const num = (v: string | undefined) => Number(v ?? 0) || 0;

function statsOf(r: RawRow, accountId: string): AdPeriodStats {
  return {
    spend: num(r.spend),
    impressions: num(r.impressions),
    reach: num(r.reach),
    frequency: num(r.frequency),
    results: conversationsStarted({ account_id: accountId, actions: r.actions }),
    linkClicks: num(r.inline_link_clicks),
    ctr: num(r.inline_link_click_ctr),
    cpm: num(r.cpm),
  };
}

function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function daysBetween(since: string, until: string): number {
  const [y1, m1, d1] = since.split("-").map(Number);
  const [y2, m2, d2] = until.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000) + 1;
}

const INSIGHT_FIELDS =
  "ad_id,ad_name,campaign_id,campaign_name,spend,impressions,reach,frequency,inline_link_clicks,inline_link_click_ctr,cpm,actions";

function insightsUrl(
  accountId: string,
  token: string,
  params: { since?: string; until?: string; preset?: string; daily?: boolean; campaignIds: string[]; fields?: string }
) {
  const url = new URL(`${META_BASE_URL}/${accountId}/insights`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("level", "ad");
  url.searchParams.set("fields", params.fields ?? INSIGHT_FIELDS);
  if (params.preset) url.searchParams.set("date_preset", params.preset);
  else url.searchParams.set("time_range", JSON.stringify({ since: params.since, until: params.until }));
  if (params.daily) url.searchParams.set("time_increment", "1");
  url.searchParams.set("limit", "500");
  if (params.campaignIds.length > 0) {
    url.searchParams.set("filtering", JSON.stringify([{ field: "campaign.id", operator: "IN", value: params.campaignIds }]));
  }
  return url;
}

interface RawAdEntity {
  id: string;
  name?: string;
  effective_status?: string;
  created_time?: string;
  preview_shareable_link?: string;
  adset?: { name?: string };
  creative?: {
    thumbnail_url?: string;
    image_url?: string;
    video_id?: string;
    object_type?: string;
    body?: string;
    title?: string;
    call_to_action_type?: string;
  };
}

const ENTITY_FIELDS =
  "id,name,effective_status,created_time,preview_shareable_link,adset{name},creative{thumbnail_url.width(400).height(400),image_url,video_id,object_type,body,title,call_to_action_type}";

async function fetchEntities(accountId: string, token: string, ids: string[]): Promise<Map<string, RawAdEntity>> {
  const map = new Map<string, RawAdEntity>();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 40) chunks.push(ids.slice(i, i + 40));
  await Promise.all(
    chunks.map(async (chunk) => {
      const url = new URL(`${META_BASE_URL}/${accountId}/ads`);
      url.searchParams.set("access_token", token);
      url.searchParams.set("fields", ENTITY_FIELDS);
      url.searchParams.set("filtering", JSON.stringify([{ field: "id", operator: "IN", value: chunk }]));
      url.searchParams.set("limit", "50");
      try {
        const rows = await fetchAll<RawAdEntity>(url, accountId);
        for (const r of rows) map.set(r.id, r);
      } catch {
        // sin creativo: el anuncio igual se analiza con sus métricas
      }
    })
  );
  return map;
}

export async function fetchMisAnuncios(options: {
  since: string;
  until: string;
  campaignIds: string[];
}): Promise<{ ads: AdReport[]; errors: string[]; prevRange: { since: string; until: string } }> {
  const { since, until, campaignIds } = options;
  const length = daysBetween(since, until);
  const prevUntil = shiftDate(since, -1);
  const prevSince = shiftDate(prevUntil, -(length - 1));

  const accounts = await getAllAdAccountConnections();
  const ads: AdReport[] = [];
  const errors: string[] = [];

  await Promise.all(
    accounts.map(async (a) => {
      const accountName = a.name ?? a.accountId.replace("act_", "");
      try {
        const [curRows, prevRows, lifeRows, dayRows] = await Promise.all([
          fetchAll<RawRow>(insightsUrl(a.accountId, a.accessToken, { since, until, campaignIds }), accountName),
          fetchAll<RawRow>(insightsUrl(a.accountId, a.accessToken, { since: prevSince, until: prevUntil, campaignIds }), accountName).catch(
            () => [] as RawRow[]
          ),
          fetchAll<RawRow>(
            insightsUrl(a.accountId, a.accessToken, { preset: "maximum", campaignIds, fields: "ad_id,spend,impressions,frequency,actions" }),
            accountName
          ).catch(() => [] as RawRow[]),
          fetchAll<RawRow>(
            insightsUrl(a.accountId, a.accessToken, {
              since,
              until,
              daily: true,
              campaignIds,
              fields: "ad_id,spend,impressions,inline_link_clicks,actions",
            }),
            accountName
          ).catch(() => [] as RawRow[]),
        ]);

        const withActivity = curRows.filter((r) => num(r.impressions) > 0 || num(r.spend) > 0);
        if (withActivity.length === 0) return;

        const prevById = new Map(prevRows.map((r) => [r.ad_id ?? "", r]));
        const lifeById = new Map(lifeRows.map((r) => [r.ad_id ?? "", r]));
        const dailyById = new Map<string, AdDay[]>();
        for (const r of dayRows) {
          const id = r.ad_id ?? "";
          const list = dailyById.get(id) ?? [];
          list.push({
            date: r.date_start ?? "",
            spend: num(r.spend),
            impressions: num(r.impressions),
            results: conversationsStarted({ account_id: a.accountId, actions: r.actions }),
            linkClicks: num(r.inline_link_clicks),
          });
          dailyById.set(id, list);
        }

        const entities = await fetchEntities(a.accountId, a.accessToken, withActivity.map((r) => r.ad_id ?? "").filter(Boolean));

        for (const r of withActivity) {
          const id = r.ad_id ?? "";
          const ent = entities.get(id);
          const cur = statsOf(r, a.accountId);
          const prevRow = prevById.get(id);
          const prev = prevRow ? statsOf(prevRow, a.accountId) : null;
          const lifeRow = lifeById.get(id);
          const lifetime: AdLifetime | null = lifeRow
            ? {
                spend: num(lifeRow.spend),
                impressions: num(lifeRow.impressions),
                frequency: num(lifeRow.frequency),
                results: conversationsStarted({ account_id: a.accountId, actions: lifeRow.actions }),
              }
            : null;
          const daily = (dailyById.get(id) ?? []).sort((x, y) => x.date.localeCompare(y.date));
          const status = ent?.effective_status ?? "UNKNOWN";
          const cr = ent?.creative;

          ads.push({
            ad_id: id,
            ad_name: r.ad_name ?? ent?.name ?? "-",
            account_id: a.accountId,
            account_name: accountName,
            campaign_id: r.campaign_id ?? "",
            campaign_name: r.campaign_name ?? "-",
            adset_name: ent?.adset?.name ?? null,
            status,
            created_time: ent?.created_time ?? null,
            thumbnail: cr?.thumbnail_url ?? null,
            image_url: cr?.image_url ?? null,
            format: creativeFormat(cr?.object_type, cr?.video_id, cr?.image_url),
            cta: cr?.call_to_action_type ?? null,
            body: cr?.body ?? null,
            title: cr?.title ?? null,
            preview_link: ent?.preview_shareable_link ?? null,
            cur,
            prev,
            lifetime,
            daily,
            diagnosis: diagnose({ cur, prev, lifetime, daily, active: status === "ACTIVE" }),
          });
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    })
  );

  return { ads, errors, prevRange: { since: prevSince, until: prevUntil } };
}
