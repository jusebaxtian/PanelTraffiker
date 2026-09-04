import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { fetchAllAccountsInsights, conversationsStarted } from "@/lib/metaAds";
import { countContactsByTagInMonth } from "@/lib/ghl";
import { computeOffice, monthRange, type CampaignRef, type ProyeccionOffice } from "@/lib/proyeccion";
import { officeTotal } from "@/lib/distribucion";
import { requireWriteAccess } from "@/lib/auth";

interface AgentRow {
  office_id: string;
  type: "junior" | "ejecutivo";
  custom_value: number | null;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_FORCE_REFRESHES_PER_WINDOW = 2;

interface CacheRow {
  gasto_by_office: Record<string, number>;
  leads_by_office: Record<string, number>;
  leads_meta_by_office: Record<string, number>;
  window_started_at: string;
  data_updated_at: string;
  force_count: number;
}

function rowToOffice(row: {
  id: string;
  asignacion: string;
  ftd_real: number;
  campaigns: CampaignRef[];
  distribucion_office_id: string | null;
  ghl_tag: string | null;
  crm_connection_id: string | null;
  config_id: string;
  position: number;
  gasto_final: number | null;
  leads_final: number | null;
  diario_final: number | null;
  leads_meta_final: number | null;
}): ProyeccionOffice {
  return {
    id: row.id,
    asignacion: row.asignacion,
    ftd_real: Number(row.ftd_real),
    campaigns: row.campaigns ?? [],
    distribucion_office_id: row.distribucion_office_id,
    ghl_tag: row.ghl_tag,
    crm_connection_id: row.crm_connection_id,
    config_id: row.config_id,
    position: row.position,
    gasto_final: row.gasto_final,
    leads_final: row.leads_final,
    diario_final: row.diario_final,
    leads_meta_final: row.leads_meta_final,
  };
}

export async function GET(request: NextRequest) {
  const configId = request.nextUrl.searchParams.get("config_id");
  const force = request.nextUrl.searchParams.get("force") === "1";
  // configChange = se acaba de vincular/cambiar una campaña, oficina o
  // CRM: eso siempre debe reflejarse de inmediato, sin gastar ni
  // esperar el cupo limitado del botón "Actualizar".
  const configChange = request.nextUrl.searchParams.get("configChange") === "1";
  if (!configId) {
    return NextResponse.json({ error: "config_id es requerido" }, { status: 400 });
  }

  const supabase = supabaseServer();

  const [
    { data: rows, error: officesError },
    { data: config },
    { data: distribucionOffices },
    { data: distribucionAgents },
    { data: crmConnections },
    { data: cache },
  ] = await Promise.all([
    supabase.from("proyeccion_offices").select("*").eq("config_id", configId).order("position", { ascending: true }),
    supabase.from("proyeccion_config").select("*").eq("id", configId).maybeSingle(),
    supabase.from("offices").select("id, name"),
    supabase.from("agents").select("id, office_id, type, custom_value"),
    supabase.from("proyeccion_crm_connections").select("id, location_id, access_token"),
    supabase.from("proyeccion_metrics_cache").select("*").eq("config_id", configId).maybeSingle<CacheRow>(),
  ]);

  if (officesError) {
    return NextResponse.json({ error: officesError.message }, { status: 500 });
  }
  if (!config) {
    return NextResponse.json({ error: "Mes no encontrado" }, { status: 404 });
  }

  const diasFaltantes = config.days_remaining ?? 0;
  const costoFtdMes = config.costo_ftd_mes ?? 0;
  const { start, end, since, until } = monthRange(config.month_key);

  // $ Diario se toma del valor TOTAL de la oficina en Distribución
  // (suma de sus agentes), no del monto de admin.
  const diarioByOfficeId = new Map(
    (distribucionOffices ?? []).map((o: { id: string }) => [
      o.id,
      officeTotal({ agents: (distribucionAgents ?? []).filter((a: AgentRow) => a.office_id === o.id) }),
    ])
  );

  const offices = (rows ?? []).map(rowToOffice);
  const crmConnectionById = new Map(
    (crmConnections ?? []).map((c: { id: string; location_id: string; access_token: string }) => [c.id, c])
  );

  // Mes cerrado: no se vuelve a consultar Meta/GHL nunca más para este
  // mes. Los valores quedan tomados de las columnas congeladas al cerrar
  // (editables a mano mientras el cierre está desbloqueado).
  if (config.closed) {
    const data = offices.map((office) => {
      const diario = office.diario_final ?? 0;
      const gastoDelMes = office.gasto_final ?? 0;
      const leadsMetaDelMes = office.leads_meta_final ?? 0;
      const leadsDelMes = office.leads_final ?? 0;
      return computeOffice(office, diario, gastoDelMes, leadsMetaDelMes, leadsDelMes, diasFaltantes, costoFtdMes);
    });
    return NextResponse.json({
      data,
      cache: {
        updatedAt: config.closed_at,
        forceRemaining: 0,
        nextWindowAt: config.closed_at,
        closed: true,
        locked: config.locked,
      },
    });
  }

  // El gasto de Meta y los leads de GHL se guardan en caché por mes
  // (proyeccion_metrics_cache) durante 30 minutos, para no consultar esas
  // APIs en cada carga de página ni en cada edición de un campo — así se
  // evita el riesgo de bloqueo por límite de tasa cuando entran varios
  // usuarios a la vez. El botón "Actualizar" puede forzar hasta 2
  // consultas frescas dentro de esa ventana; a la tercera debe esperar a
  // que la ventana de 30 minutos se renueve sola.
  const now = Date.now();
  const windowAgeMs = cache ? now - new Date(cache.window_started_at).getTime() : Infinity;
  const windowExpired = windowAgeMs >= CACHE_TTL_MS;
  const forceAllowed = force && !windowExpired && (cache?.force_count ?? 0) < MAX_FORCE_REFRESHES_PER_WINDOW;
  const shouldFetchLive = !cache || windowExpired || forceAllowed || configChange;

  let gastoByOfficeId: Record<string, number>;
  let leadsMetaByOfficeId: Record<string, number>;
  let leadsByOfficeId: Record<string, number>;
  let cacheMeta: { updatedAt: string; forceRemaining: number; nextWindowAt: string };

  if (shouldFetchLive) {
    let insights: Awaited<ReturnType<typeof fetchAllAccountsInsights>> = [];
    try {
      insights = await fetchAllAccountsInsights({ timeRange: { since, until }, level: "campaign" });
    } catch {
      insights = [];
    }

    gastoByOfficeId = {};
    leadsMetaByOfficeId = {};
    leadsByOfficeId = {};

    await Promise.all(
      offices.map(async (office) => {
        const campaignIds = new Set(office.campaigns.map((c) => c.campaign_id));
        const officeInsights = insights.filter((i) => i.campaign_id && campaignIds.has(i.campaign_id));
        gastoByOfficeId[office.id] = officeInsights.reduce((sum, i) => sum + Number(i.spend ?? 0), 0);
        leadsMetaByOfficeId[office.id] = officeInsights.reduce((sum, i) => sum + conversationsStarted(i), 0);

        let leadsDelMes = 0;
        const connection = office.crm_connection_id ? crmConnectionById.get(office.crm_connection_id) : null;
        if (office.ghl_tag && connection) {
          try {
            leadsDelMes = await countContactsByTagInMonth(
              { locationId: connection.location_id, accessToken: connection.access_token },
              office.ghl_tag,
              start,
              end
            );
          } catch {
            leadsDelMes = 0;
          }
        }
        leadsByOfficeId[office.id] = leadsDelMes;
      })
    );

    const isNewWindow = !cache || windowExpired;
    // Un configChange no cuenta contra el cupo de refrescos manuales:
    // solo se actualizan los datos, sin tocar la ventana ni el contador.
    const nextForceCount = isNewWindow ? 0 : configChange ? cache?.force_count ?? 0 : (cache?.force_count ?? 0) + 1;
    const nextWindowStartedAt = isNewWindow ? new Date(now).toISOString() : cache!.window_started_at;

    await supabase.from("proyeccion_metrics_cache").upsert({
      config_id: configId,
      gasto_by_office: gastoByOfficeId,
      leads_meta_by_office: leadsMetaByOfficeId,
      leads_by_office: leadsByOfficeId,
      window_started_at: nextWindowStartedAt,
      data_updated_at: new Date(now).toISOString(),
      force_count: nextForceCount,
    });

    cacheMeta = {
      updatedAt: new Date(now).toISOString(),
      forceRemaining: MAX_FORCE_REFRESHES_PER_WINDOW - nextForceCount,
      nextWindowAt: new Date(new Date(nextWindowStartedAt).getTime() + CACHE_TTL_MS).toISOString(),
    };
  } else {
    gastoByOfficeId = cache!.gasto_by_office ?? {};
    leadsMetaByOfficeId = cache!.leads_meta_by_office ?? {};
    leadsByOfficeId = cache!.leads_by_office ?? {};
    cacheMeta = {
      updatedAt: cache!.data_updated_at,
      forceRemaining: MAX_FORCE_REFRESHES_PER_WINDOW - cache!.force_count,
      nextWindowAt: new Date(new Date(cache!.window_started_at).getTime() + CACHE_TTL_MS).toISOString(),
    };
  }

  const data = offices.map((office) => {
    const diario = office.distribucion_office_id ? diarioByOfficeId.get(office.distribucion_office_id) ?? 0 : 0;
    const gastoDelMes = gastoByOfficeId[office.id] ?? 0;
    const leadsMetaDelMes = leadsMetaByOfficeId[office.id] ?? 0;
    const leadsDelMes = leadsByOfficeId[office.id] ?? 0;
    return computeOffice(office, diario, gastoDelMes, leadsMetaDelMes, leadsDelMes, diasFaltantes, costoFtdMes);
  });

  return NextResponse.json({ data, cache: cacheMeta });
}

export async function POST(request: NextRequest) {
  const auth = await requireWriteAccess();
  if ("error" in auth) return auth.error;

  const supabase = supabaseServer();
  const body = await request.json();

  const asignacion = String(body.asignacion ?? "").trim();
  const configId = String(body.config_id ?? "").trim();
  if (!asignacion) {
    return NextResponse.json({ error: "El nombre de la oficina es obligatorio" }, { status: 400 });
  }
  if (!configId) {
    return NextResponse.json({ error: "config_id es requerido" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("proyeccion_offices")
    .select("position")
    .eq("config_id", configId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("proyeccion_offices")
    .insert({
      asignacion,
      config_id: configId,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: computeOffice(rowToOffice(data), 0, 0, 0, 0, 0, 0) });
}
