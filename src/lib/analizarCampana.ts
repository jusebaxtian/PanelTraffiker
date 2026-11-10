import { getAllAdAccountConnections, conversationsStarted, META_BASE_URL, type ActionValue } from "@/lib/metaAds";
import { creativeFormat, CPR_IDEAL, CPR_MAX } from "@/lib/adDiagnosis";
import { countryLabel, regionLabel, GENDER_LABEL } from "@/lib/geoNames";
import { bogotaDateString } from "@/lib/bogota";

// Módulo "Analizar Campaña": todo el detalle de UNA campaña en un período
// (copys, anuncios, ubicaciones, público, departamentos, edad/género,
// horas, dispositivos y día a día) y un motor que compara cada segmento
// con el costo por resultado promedio de la campaña para decir qué
// funcionó y qué no, y así replicarlo.

import {
  DIMENSION_LABEL,
  type AdRow,
  type AdsetRow,
  type CampaignAnalysis,
  type DayRow,
  type Dimension,
  type Finding,
  type Metrics,
  type Segment,
} from "@/lib/analizarCampanaTypes";

export { DIMENSION_LABEL };
export type { AdRow, AdsetRow, CampaignAnalysis, DayRow, Dimension, Finding, Metrics, Segment };

/* ---------------- llamadas a Meta ---------------- */

interface Paged<T> {
  data?: T[];
  paging?: { next?: string };
  error?: { message: string };
}

async function getJson<T>(url: URL | string): Promise<T> {
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await res.json();
  if (json?.error) throw new Error(json.error.message);
  return json as T;
}

async function fetchAll<T>(url: URL): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = url.toString();
  let guard = 0;
  while (next && guard++ < 30) {
    const json: Paged<T> = await getJson<Paged<T>>(next);
    out.push(...(json.data ?? []));
    next = json.paging?.next ?? null;
  }
  return out;
}

interface RawInsight {
  [k: string]: unknown;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  inline_link_clicks?: string;
  actions?: ActionValue[];
  video_thruplay_watched_actions?: ActionValue[];
  date_start?: string;
}

const num = (v: unknown) => Number(v ?? 0) || 0;

function metricsOf(r: RawInsight, accountId: string): Metrics {
  return {
    spend: num(r.spend),
    impressions: num(r.impressions),
    reach: num(r.reach),
    clicks: num(r.inline_link_clicks),
    results: conversationsStarted({ account_id: accountId, actions: r.actions }),
  };
}

function addInto(target: Metrics, m: Metrics) {
  target.spend += m.spend;
  target.impressions += m.impressions;
  target.reach += m.reach;
  target.clicks += m.clicks;
  target.results += m.results;
}

const EMPTY = (): Metrics => ({ spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0 });

/* ---------------- etiquetas legibles ---------------- */

const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  messenger: "Messenger",
  audience_network: "Audience Network",
  whatsapp: "WhatsApp",
  threads: "Threads",
};

const POSITION_LABEL: Record<string, string> = {
  feed: "Feed",
  facebook_reels: "Reels",
  facebook_reels_overlay: "Anuncios sobre Reels",
  instagram_reels: "Reels",
  story: "Historias",
  facebook_stories: "Historias",
  instagram_stories: "Historias",
  instream_video: "Videos in-stream",
  marketplace: "Marketplace",
  search: "Resultados de búsqueda",
  right_hand_column: "Columna derecha",
  video_feeds: "Feed de videos",
  profile_feed: "Feed del perfil",
  instagram_profile_feed: "Feed del perfil",
  instagram_explore: "Explorar",
  instagram_explore_grid_home: "Inicio de Explorar",
  instagram_search: "Búsqueda",
  messenger_inbox: "Bandeja de Messenger",
  messenger_stories: "Historias",
  notification: "Notificaciones",
  status: "Estados",
  whatsapp_status: "Estados",
  an_classic: "Nativo, banner e intersticial",
  rewarded_video: "Video con premio",
  threads_feed: "Feed",
};

function placementLabel(platform: string, position: string): string {
  const p = PLATFORM_LABEL[platform] ?? platform;
  const pos = POSITION_LABEL[position] ?? position.replace(/_/g, " ");
  return `${p} ${pos}`;
}

const DEVICE_LABEL: Record<string, string> = {
  android_smartphone: "Celular Android",
  iphone: "iPhone",
  android_tablet: "Tablet Android",
  ipad: "iPad",
  ipod: "iPod",
  desktop: "Computador",
  other: "Otro",
};

const RANK_LABEL: Record<string, string> = {
  ABOVE_AVERAGE: "Superior al promedio",
  AVERAGE: "Promedio",
  BELOW_AVERAGE_35: "Bajo (35% inferior)",
  BELOW_AVERAGE_20: "Bajo (20% inferior)",
  BELOW_AVERAGE_10: "Muy bajo (10% inferior)",
};

const GENDER_TARGET: Record<number, string> = { 1: "Hombres", 2: "Mujeres" };

/* ---------------- público (targeting) en texto ---------------- */

interface GeoItem {
  key?: string;
  name?: string;
  country?: string;
  region?: string;
}
interface Targeting {
  age_min?: number;
  age_max?: number;
  genders?: number[];
  geo_locations?: { countries?: string[]; regions?: GeoItem[]; cities?: GeoItem[]; location_types?: string[] };
  excluded_geo_locations?: { countries?: string[]; regions?: GeoItem[]; cities?: GeoItem[] };
  flexible_spec?: Record<string, { name?: string }[]>[];
  exclusions?: Record<string, { name?: string }[]>;
  custom_audiences?: { name?: string }[];
  excluded_custom_audiences?: { name?: string }[];
  targeting_automation?: { advantage_audience?: number };
  publisher_platforms?: string[];
  facebook_positions?: string[];
  instagram_positions?: string[];
  messenger_positions?: string[];
  audience_network_positions?: string[];
  device_platforms?: string[];
  user_os?: string[];
  locales?: number[];
}

const SPEC_LABEL: Record<string, string> = {
  interests: "Intereses",
  behaviors: "Comportamientos",
  life_events: "Acontecimientos",
  industries: "Sector",
  work_positions: "Cargos",
  family_statuses: "Situación familiar",
  income: "Ingresos",
  education_statuses: "Estudios",
};

function names(list?: { name?: string }[]): string {
  return (list ?? []).map((x) => x.name).filter(Boolean).join(", ");
}

function describeTargeting(t: Targeting | undefined): { label: string; value: string }[] {
  if (!t) return [];
  const out: { label: string; value: string }[] = [];
  out.push({ label: "Edad", value: `${t.age_min ?? 18} a ${t.age_max && t.age_max < 65 ? t.age_max : "65+"} años` });
  out.push({ label: "Género", value: t.genders && t.genders.length === 1 ? GENDER_TARGET[t.genders[0]] ?? "Todos" : "Todos" });
  const geo: string[] = [];
  for (const c of t.geo_locations?.countries ?? []) geo.push(countryLabel(c));
  for (const r of t.geo_locations?.regions ?? []) geo.push(`${r.name}${r.country ? ` (${r.country})` : ""}`);
  for (const c of t.geo_locations?.cities ?? []) geo.push(`${c.name}${c.region ? `, ${c.region}` : ""}`);
  if (geo.length) out.push({ label: "Ubicación", value: geo.join(", ") });
  const ex: string[] = [];
  for (const c of t.excluded_geo_locations?.countries ?? []) ex.push(countryLabel(c));
  for (const r of t.excluded_geo_locations?.regions ?? []) ex.push(r.name ?? "");
  for (const c of t.excluded_geo_locations?.cities ?? []) ex.push(c.name ?? "");
  if (ex.filter(Boolean).length) out.push({ label: "Excluye zonas", value: ex.filter(Boolean).join(", ") });
  (t.flexible_spec ?? []).forEach((spec, i) => {
    for (const [k, v] of Object.entries(spec)) {
      const n = names(v);
      if (n) out.push({ label: `${SPEC_LABEL[k] ?? k}${(t.flexible_spec?.length ?? 0) > 1 ? ` (grupo ${i + 1})` : ""}`, value: n });
    }
  });
  for (const [k, v] of Object.entries(t.exclusions ?? {})) {
    const n = names(v);
    if (n) out.push({ label: `Excluye ${(SPEC_LABEL[k] ?? k).toLowerCase()}`, value: n });
  }
  if (t.custom_audiences?.length) out.push({ label: "Públicos personalizados", value: names(t.custom_audiences) });
  if (t.excluded_custom_audiences?.length) out.push({ label: "Públicos excluidos", value: names(t.excluded_custom_audiences) });
  out.push({ label: "Público Advantage+", value: t.targeting_automation?.advantage_audience === 1 ? "Activado (Meta puede salirse del público)" : "Desactivado" });
  if (!t.publisher_platforms) {
    out.push({ label: "Ubicaciones", value: "Advantage+ (automáticas)" });
  } else {
    const parts: string[] = [];
    const pos: Record<string, string[] | undefined> = {
      facebook: t.facebook_positions,
      instagram: t.instagram_positions,
      messenger: t.messenger_positions,
      audience_network: t.audience_network_positions,
    };
    for (const p of t.publisher_platforms) {
      const list = pos[p];
      parts.push(`${PLATFORM_LABEL[p] ?? p}${list?.length ? ` (${list.map((x) => POSITION_LABEL[x] ?? x).join(", ")})` : ""}`);
    }
    out.push({ label: "Ubicaciones", value: parts.join(" · ") });
  }
  if (t.device_platforms?.length) out.push({ label: "Dispositivos", value: t.device_platforms.map((d) => (d === "mobile" ? "Celular" : d === "desktop" ? "Computador" : d)).join(", ") });
  if (t.user_os?.length) out.push({ label: "Sistema", value: t.user_os.join(", ") });
  return out;
}

/* ---------------- mensaje prellenado de WhatsApp ---------------- */

function welcomeFrom(oss: Record<string, unknown> | undefined): string | null {
  if (!oss) return null;
  for (const k of ["video_data", "link_data", "photo_data"]) {
    const d = oss[k] as { page_welcome_message?: string } | undefined;
    if (d?.page_welcome_message) {
      try {
        const j = JSON.parse(d.page_welcome_message);
        return j?.text_format?.message?.autofill_message?.content ?? j?.text_format?.message?.text ?? null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/* ---------------- motor: qué funciona y qué no ---------------- */

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

function cprOf(m: Metrics) {
  return m.results > 0 ? m.spend / m.results : 0;
}

// Dimensiones que entran al motor (algunas son agregados de otras).
const ENGINE_DIMS: Dimension[] = ["anuncio", "copy", "titulo", "mensaje", "formato", "conjunto", "ubicacion", "region", "edad", "genero", "hora", "dispositivo"];

function analyze(segments: Record<Dimension, Segment[]>, totals: Metrics) {
  const avg = cprOf(totals);
  const works: Finding[] = [];
  const fails: Finding[] = [];
  const recipe: Finding[] = [];
  if (totals.spend <= 0) return { works, fails, recipe };
  const minSpend = Math.max(totals.spend * 0.03, CPR_IDEAL * 2);

  for (const dim of ENGINE_DIMS) {
    const rows = segments[dim] ?? [];
    if (rows.length < 2) continue;
    const scored = rows
      .filter((r) => r.spend >= minSpend)
      .map((r) => {
        const cpr = cprOf(r);
        const deltaPct = avg > 0 && cpr > 0 ? ((cpr - avg) / avg) * 100 : 0;
        return { r, cpr, deltaPct, share: (r.spend / totals.spend) * 100 };
      });

    const mk = (x: (typeof scored)[number], text: string): Finding => ({
      dimension: dim,
      label: x.r.label,
      sub: x.r.sub,
      spend: x.r.spend,
      results: x.r.results,
      cpr: x.cpr,
      deltaPct: x.deltaPct,
      share: x.share,
      text,
    });

    const good = scored
      .filter((x) => x.r.results >= 3 && x.cpr > 0 && (x.cpr <= avg * 0.8 || (avg > CPR_MAX && x.cpr <= CPR_IDEAL)))
      .sort((a, b) => a.cpr - b.cpr);
    for (const x of good.slice(0, 3)) {
      works.push(
        mk(
          x,
          `${fmt(x.cpr)} por resultado, ${Math.abs(Math.round(x.deltaPct))}% más barato que el promedio (${fmt(avg)}). ${x.r.results} resultados con ${fmt(x.r.spend)} (${Math.round(x.share)}% del gasto).`
        )
      );
    }

    const bad = scored
      .filter((x) => (x.r.results === 0 && x.r.spend >= Math.max(minSpend, CPR_MAX * 1.5)) || (x.r.results > 0 && x.cpr >= avg * 1.3 && x.cpr > CPR_IDEAL))
      .sort((a, b) => (b.r.results === 0 ? Infinity : b.cpr) - (a.r.results === 0 ? Infinity : a.cpr));
    for (const x of bad.slice(0, 3)) {
      fails.push(
        mk(
          x,
          x.r.results === 0
            ? `Gastó ${fmt(x.r.spend)} (${Math.round(x.share)}% del gasto) sin ningún resultado.`
            : `${fmt(x.cpr)} por resultado, ${Math.round(x.deltaPct)}% más caro que el promedio (${fmt(avg)}). Se llevó ${fmt(x.r.spend)} (${Math.round(x.share)}% del gasto) para ${x.r.results} resultados.`
        )
      );
    }

    // Receta: el mejor de cada dimensión con datos suficientes
    const champion = scored.filter((x) => x.r.results >= 3 && x.cpr > 0).sort((a, b) => a.cpr - b.cpr)[0];
    if (champion && champion.cpr <= avg) recipe.push(mk(champion, `${fmt(champion.cpr)} por resultado con ${champion.r.results} resultados.`));
  }

  works.sort((a, b) => a.deltaPct - b.deltaPct);
  fails.sort((a, b) => (b.results === 0 ? 1e9 : b.deltaPct) - (a.results === 0 ? 1e9 : a.deltaPct));
  return { works, fails, recipe };
}

/* ---------------- consulta principal ---------------- */

interface RawCampaign {
  id: string;
  name?: string;
  effective_status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  bid_strategy?: string;
}

interface RawAdset {
  id: string;
  name?: string;
  effective_status?: string;
  daily_budget?: string;
  optimization_goal?: string;
  destination_type?: string;
  targeting?: Targeting;
}

interface RawAd {
  id: string;
  name?: string;
  effective_status?: string;
  preview_shareable_link?: string;
  adset_id?: string;
  creative?: {
    thumbnail_url?: string;
    image_url?: string;
    video_id?: string;
    object_type?: string;
    body?: string;
    title?: string;
    asset_feed_spec?: { bodies?: { text?: string }[]; titles?: { text?: string }[] };
    object_story_spec?: Record<string, unknown>;
  };
}

function shortText(s: string | null | undefined, n = 90) {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

export async function fetchCampaignAnalysis(options: {
  accountId: string;
  campaignId: string;
  since?: string;
  until?: string;
  lifetime?: boolean;
}): Promise<CampaignAnalysis> {
  const { accountId, campaignId } = options;
  const accounts = await getAllAdAccountConnections();
  const account = accounts.find((a) => a.accountId === accountId);
  if (!account) throw new Error("Cuenta publicitaria no encontrada");
  const token = account.accessToken;

  const node = (path: string, params: Record<string, string>) => {
    const url = new URL(`${META_BASE_URL}/${path}`);
    url.searchParams.set("access_token", token);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url;
  };

  const campaign = await getJson<RawCampaign>(
    node(campaignId, { fields: "id,name,effective_status,objective,daily_budget,lifetime_budget,start_time,bid_strategy" })
  );

  const today = bogotaDateString();
  const range =
    options.lifetime || !options.since || !options.until
      ? { since: (campaign.start_time ?? today).slice(0, 10), until: today }
      : { since: options.since, until: options.until };

  const base = { time_range: JSON.stringify(range), limit: "500" };
  const ins = (fields: string, extra: Record<string, string> = {}) => fetchAll<RawInsight>(node(`${campaignId}/insights`, { ...base, fields, ...extra }));
  const M = "spend,impressions,reach,inline_link_clicks,actions";
  const soft = <T>(p: Promise<T[]>) => p.catch(() => [] as T[]);
  const notes: string[] = [];

  const [adsets, ads, totalRows, adsetRows, adRows, placeRows, regionRows, ageGenderRows, hourRows, deviceRows, bodyRows, titleRows, dayRows] = await Promise.all([
    soft(fetchAll<RawAdset>(node(`${campaignId}/adsets`, { fields: "id,name,effective_status,daily_budget,optimization_goal,destination_type,targeting", limit: "100" }))),
    soft(
      fetchAll<RawAd>(
        node(`${campaignId}/ads`, {
          fields:
            "id,name,effective_status,preview_shareable_link,adset_id,creative{thumbnail_url.width(400).height(400),image_url,video_id,object_type,body,title,asset_feed_spec{bodies,titles},object_story_spec}",
          limit: "100",
        })
      )
    ),
    ins(`${M},frequency,cpm,inline_link_click_ctr`),
    soft(ins(`adset_id,${M}`, { level: "adset" })),
    soft(ins(`ad_id,ad_name,${M},frequency,video_thruplay_watched_actions,quality_ranking,engagement_rate_ranking,conversion_rate_ranking`, { level: "ad" })),
    soft(ins(M, { breakdowns: "publisher_platform,platform_position" })),
    soft(ins(M, { breakdowns: "country,region" })),
    soft(ins(M, { breakdowns: "age,gender" })),
    soft(ins(M, { breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone" })),
    soft(ins(M, { breakdowns: "impression_device" })),
    soft(ins(M, { breakdowns: "body_asset" })),
    soft(ins(M, { breakdowns: "title_asset" })),
    soft(ins(M, { time_increment: "1" })),
  ]);

  const tRow = totalRows[0] ?? {};
  const totalsBase = metricsOf(tRow, accountId);
  const totals = {
    ...totalsBase,
    frequency: num(tRow.frequency),
    cpm: num(tRow.cpm),
    ctr: num(tRow.inline_link_click_ctr),
  };

  // ---- anuncios
  const adEntity = new Map(ads.map((a) => [a.id, a]));
  const adsetName = new Map(adsets.map((s) => [s.id, s.name ?? "-"]));
  const adList: AdRow[] = adRows
    .map((r) => {
      const id = String(r.ad_id ?? "");
      const e = adEntity.get(id);
      const cr = e?.creative;
      const bodies = (cr?.asset_feed_spec?.bodies ?? []).map((b) => b.text).filter(Boolean) as string[];
      return {
        ad_id: id,
        name: String(r.ad_name ?? e?.name ?? "-"),
        adset_name: adsetName.get(e?.adset_id ?? "") ?? "-",
        status: e?.effective_status ?? "UNKNOWN",
        format: creativeFormat(cr?.object_type, cr?.video_id, cr?.image_url),
        thumbnail: cr?.thumbnail_url ?? cr?.image_url ?? null,
        body: cr?.body ?? bodies[0] ?? null,
        title: cr?.title ?? cr?.asset_feed_spec?.titles?.[0]?.text ?? null,
        message: welcomeFrom(cr?.object_story_spec),
        preview_link: e?.preview_shareable_link ?? null,
        frequency: num(r.frequency),
        video3s: num(r.actions?.find((x) => x.action_type === "video_view")?.value),
        thruplays: (r.video_thruplay_watched_actions ?? []).reduce((t, x) => t + num(x.value), 0),
        quality: RANK_LABEL[String(r.quality_ranking)] ?? null,
        engagement: RANK_LABEL[String(r.engagement_rate_ranking)] ?? null,
        conversion: RANK_LABEL[String(r.conversion_rate_ranking)] ?? null,
        ...metricsOf(r, accountId),
      };
    })
    .filter((a) => a.spend > 0 || a.impressions > 0)
    .sort((a, b) => b.spend - a.spend);

  // ---- conjuntos (público)
  const adsetMetrics = new Map(adsetRows.map((r) => [String(r.adset_id ?? ""), metricsOf(r, accountId)]));
  const adsetList: AdsetRow[] = adsets
    .map((s) => ({
      adset_id: s.id,
      name: s.name ?? "-",
      status: s.effective_status ?? "UNKNOWN",
      daily_budget: s.daily_budget ? Number(s.daily_budget) : null,
      optimization: s.optimization_goal ?? null,
      destination: s.destination_type ?? null,
      audience: describeTargeting(s.targeting),
      ...(adsetMetrics.get(s.id) ?? EMPTY()),
    }))
    .filter((s) => s.spend > 0 || s.status === "ACTIVE")
    .sort((a, b) => b.spend - a.spend);

  // ---- segmentos
  const group = (rows: { key: string; label: string; sub?: string; m: Metrics }[]): Segment[] => {
    const map = new Map<string, Segment>();
    for (const r of rows) {
      const s = map.get(r.key) ?? { key: r.key, label: r.label, sub: r.sub, ...EMPTY() };
      addInto(s, r.m);
      map.set(r.key, s);
    }
    return [...map.values()].filter((s) => s.spend > 0 || s.results > 0).sort((a, b) => b.spend - a.spend);
  };

  const seg = {} as Record<Dimension, Segment[]>;
  seg.anuncio = adList.map((a) => ({ key: a.ad_id, label: a.name, sub: a.adset_name, spend: a.spend, impressions: a.impressions, reach: a.reach, clicks: a.clicks, results: a.results }));
  seg.conjunto = adsetList.map((s) => ({ key: s.adset_id, label: s.name, spend: s.spend, impressions: s.impressions, reach: s.reach, clicks: s.clicks, results: s.results }));

  // Copys: el desglose por texto de Meta (anuncios con varias opciones de
  // texto) si cubre casi todo el gasto; si no, se agrupan los anuncios por
  // su texto principal.
  const bodyAsset = group(
    bodyRows.map((r) => {
      const b = r.body_asset as { id?: string; text?: string } | undefined;
      return { key: b?.text ?? b?.id ?? "?", label: shortText(b?.text, 140) || "(sin texto)", m: metricsOf(r, accountId) };
    })
  );
  const bodyAssetSpend = bodyAsset.reduce((s, x) => s + x.spend, 0);
  if (bodyAsset.length > 0 && bodyAssetSpend >= totals.spend * 0.8) {
    seg.copy = bodyAsset;
    if (adList.some((a) => (adEntity.get(a.ad_id)?.creative?.asset_feed_spec?.bodies?.length ?? 0) > 1))
      notes.push("Los anuncios tienen varias opciones de texto: Meta reparte cada copy por separado, por eso el gasto por copy no coincide con el de cada anuncio.");
  } else {
    seg.copy = group(adList.map((a) => ({ key: a.body ?? "(sin texto)", label: shortText(a.body, 140) || "(sin texto)", sub: undefined, m: a })));
  }
  const titleAsset = group(
    titleRows.map((r) => {
      const t = r.title_asset as { text?: string } | undefined;
      return { key: t?.text ?? "?", label: shortText(t?.text, 80) || "(sin titular)", m: metricsOf(r, accountId) };
    })
  );
  seg.titulo =
    titleAsset.length > 0 && titleAsset.reduce((s, x) => s + x.spend, 0) >= totals.spend * 0.8
      ? titleAsset
      : group(adList.map((a) => ({ key: a.title ?? "(sin titular)", label: shortText(a.title, 80) || "(sin titular)", m: a })));
  seg.mensaje = group(adList.filter((a) => a.message).map((a) => ({ key: a.message!, label: shortText(a.message, 120), m: a })));
  seg.formato = group(adList.map((a) => ({ key: a.format, label: a.format === "VIDEO" ? "Video" : a.format === "IMAGEN" ? "Imagen" : "Otro", m: a })));

  seg.ubicacion = group(
    placeRows.map((r) => {
      const p = String(r.publisher_platform ?? "");
      const pos = String(r.platform_position ?? "");
      return { key: `${p}|${pos}`, label: placementLabel(p, pos), m: metricsOf(r, accountId) };
    })
  );
  seg.plataforma = group(
    placeRows.map((r) => {
      const p = String(r.publisher_platform ?? "");
      return { key: p, label: PLATFORM_LABEL[p] ?? p, m: metricsOf(r, accountId) };
    })
  );
  seg.region = group(
    regionRows.map((r) => {
      const c = String(r.country ?? "");
      const reg = String(r.region ?? "");
      return { key: `${c}|${reg}`, label: regionLabel(c, reg), sub: countryLabel(c), m: metricsOf(r, accountId) };
    })
  );
  seg.pais = group(
    regionRows.map((r) => {
      const c = String(r.country ?? "");
      return { key: c, label: countryLabel(c), m: metricsOf(r, accountId) };
    })
  );
  seg.edad_genero = group(
    ageGenderRows.map((r) => {
      const age = String(r.age ?? "");
      const g = String(r.gender ?? "");
      return { key: `${age}|${g}`, label: `${GENDER_LABEL[g] ?? g} ${age}`, m: metricsOf(r, accountId) };
    })
  );
  seg.edad = group(ageGenderRows.map((r) => ({ key: String(r.age ?? ""), label: `${r.age} años`, m: metricsOf(r, accountId) })));
  seg.genero = group(
    ageGenderRows.map((r) => {
      const g = String(r.gender ?? "");
      return { key: g, label: GENDER_LABEL[g] ?? g, m: metricsOf(r, accountId) };
    })
  );
  seg.hora = group(
    hourRows.map((r) => {
      const h = String(r.hourly_stats_aggregated_by_advertiser_time_zone ?? "").slice(0, 2);
      return { key: h, label: `${h}:00 – ${h}:59`, m: metricsOf(r, accountId) };
    })
  ).sort((a, b) => a.key.localeCompare(b.key));
  seg.dispositivo = group(
    deviceRows.map((r) => {
      const d = String(r.impression_device ?? "");
      return { key: d, label: DEVICE_LABEL[d] ?? d, m: metricsOf(r, accountId) };
    })
  );

  const daily: DayRow[] = dayRows.map((r) => ({ date: String(r.date_start ?? ""), ...metricsOf(r, accountId) })).sort((a, b) => a.date.localeCompare(b.date));

  if (adsetList.some((s) => s.audience.some((x) => x.label.startsWith("Intereses"))))
    notes.push("Meta no reporta resultados por interés individual: los intereses se evalúan por conjunto completo.");
  notes.push("Los resultados son conversaciones iniciadas según Meta; no todas llegan al CRM.");

  // Si cada anuncio tiene su propio copy, el copy rinde igual que el
  // anuncio: no se repite en las conclusiones.
  const copyIsAd = seg.copy.length === seg.anuncio.length && seg.copy.every((c, i) => Math.round(c.spend) === Math.round(seg.anuncio[i]?.spend ?? -1));
  if (copyIsAd && seg.copy.length > 1) notes.push("Cada anuncio usa su propio copy: el resultado de cada copy es el mismo de su anuncio (en las conclusiones aparece como anuncio).");

  const { works, fails, recipe } = analyze(copyIsAd ? { ...seg, copy: [] } : seg, totalsBase);

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name ?? "-",
      account_id: accountId,
      account_name: account.name ?? accountId.replace("act_", ""),
      status: campaign.effective_status ?? "UNKNOWN",
      objective: campaign.objective ?? null,
      daily_budget: campaign.daily_budget ? Number(campaign.daily_budget) : null,
      lifetime_budget: campaign.lifetime_budget ? Number(campaign.lifetime_budget) : null,
      start_time: campaign.start_time ?? null,
      bid_strategy: campaign.bid_strategy ?? null,
    },
    range,
    totals,
    ads: adList,
    adsets: adsetList,
    segments: seg,
    daily,
    works,
    fails,
    recipe,
    notes,
  };
}
