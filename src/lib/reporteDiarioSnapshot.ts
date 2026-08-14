import { supabaseServer } from "@/lib/supabaseServer";
import { fetchAllAccountsInsights, conversationsStarted } from "@/lib/metaAds";
import { countContactsByTagInMonth } from "@/lib/ghl";
import { officeTotal } from "@/lib/distribucion";
import { bogotaDayRange } from "@/lib/bogota";
import {
  computeReporteDiarioOffice,
  type ReporteDiarioOffice,
  type ReporteDiarioOfficeComputed,
  type CampaignRef,
} from "@/lib/reporteDiario";

interface AgentRow {
  office_id: string;
  type: "junior" | "ejecutivo";
  custom_value: number | null;
}

interface CrmConnectionRow {
  id: string;
  location_id: string;
  access_token: string;
}

interface SnapshotRow {
  office_id: string;
  gasto: number;
  leads_meta: number;
  leads_crm: number;
  created_at?: string;
}

interface RefreshState {
  window_started_at: string;
  force_count: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_MANUAL_REFRESHES_PER_WINDOW = 2;

export interface SnapshotMeta {
  updatedAt: string | null;
  forceRemaining: number;
  nextWindowAt: string;
}

function rowToOffice(row: {
  id: string;
  asignacion: string;
  campaigns: CampaignRef[];
  distribucion_office_id: string | null;
  ghl_tag: string | null;
  crm_connection_id: string | null;
  position: number;
}): ReporteDiarioOffice {
  return {
    id: row.id,
    asignacion: row.asignacion,
    campaigns: row.campaigns ?? [],
    distribucion_office_id: row.distribucion_office_id,
    ghl_tag: row.ghl_tag,
    crm_connection_id: row.crm_connection_id,
    position: row.position,
  };
}

// Un día ya guardado (reporte_diario_snapshots) queda fijo para siempre:
// solo se consulta Meta/GHL para las oficinas que todavía no tienen
// snapshot de esa fecha (día nuevo, u oficina agregada después).
//
// - opts.configChange: se acaba de vincular/cambiar una campaña, oficina
//   o CRM — siempre recalcula TODAS las oficinas de inmediato, sin
//   gastar el cupo del botón "Actualizar".
// - opts.manual: click en "Actualizar" — recalcula todo, pero limitado a
//   2 veces cada 30 minutos por día consultado (igual que Proyección),
//   para no saturar las APIs.
export async function getOrBuildSnapshot(
  dateStr: string,
  opts: { configChange?: boolean; manual?: boolean } = {}
): Promise<{ data: ReporteDiarioOfficeComputed[]; cache: SnapshotMeta }> {
  const supabase = supabaseServer();

  const [
    { data: rows, error: officesError },
    { data: distribucionOffices },
    { data: distribucionAgents },
    { data: crmConnections },
    { data: existingSnapshots },
    { data: refreshState },
  ] = await Promise.all([
    supabase.from("reporte_diario_offices").select("*").order("position", { ascending: true }),
    supabase.from("offices").select("id, name"),
    supabase.from("agents").select("id, office_id, type, custom_value"),
    supabase.from("proyeccion_crm_connections").select("id, location_id, access_token"),
    supabase
      .from("reporte_diario_snapshots")
      .select("office_id, gasto, leads_meta, leads_crm, created_at")
      .eq("snapshot_date", dateStr),
    supabase
      .from("reporte_diario_refresh_state")
      .select("window_started_at, force_count")
      .eq("snapshot_date", dateStr)
      .maybeSingle<RefreshState>(),
  ]);

  if (officesError) {
    throw new Error(officesError.message);
  }

  const offices = (rows ?? []).map(rowToOffice);
  const diarioByOfficeId = new Map(
    (distribucionOffices ?? []).map((o: { id: string }) => [
      o.id,
      officeTotal({ agents: (distribucionAgents ?? []).filter((a: AgentRow) => a.office_id === o.id) }),
    ])
  );
  const crmConnectionById = new Map((crmConnections ?? []).map((c: CrmConnectionRow) => [c.id, c]));
  const snapshotByOfficeId = new Map((existingSnapshots ?? []).map((s: SnapshotRow) => [s.office_id, s]));

  const now = Date.now();
  const windowAgeMs = refreshState ? now - new Date(refreshState.window_started_at).getTime() : Infinity;
  const windowExpired = windowAgeMs >= CACHE_TTL_MS;
  const manualAllowed =
    !!opts.manual && (windowExpired || !refreshState || refreshState.force_count < MAX_MANUAL_REFRESHES_PER_WINDOW);

  const rebuildAll = !!opts.configChange || manualAllowed;
  const missingOffices = rebuildAll ? offices : offices.filter((o) => !snapshotByOfficeId.has(o.id));
  const { since, until, start, end } = bogotaDayRange(dateStr);

  if (missingOffices.length > 0) {
    let insights: Awaited<ReturnType<typeof fetchAllAccountsInsights>> = [];
    try {
      insights = await fetchAllAccountsInsights({ timeRange: { since, until }, level: "campaign" });
    } catch {
      insights = [];
    }

    await Promise.all(
      missingOffices.map(async (office) => {
        const campaignIds = new Set(office.campaigns.map((c) => c.campaign_id));
        const officeInsights = insights.filter((i) => i.campaign_id && campaignIds.has(i.campaign_id));
        const gasto = officeInsights.reduce((sum, i) => sum + Number(i.spend ?? 0), 0);
        const leadsMeta = officeInsights.reduce((sum, i) => sum + conversationsStarted(i), 0);

        let leadsCrm = 0;
        const connection = office.crm_connection_id ? crmConnectionById.get(office.crm_connection_id) : null;
        if (office.ghl_tag && connection) {
          try {
            leadsCrm = await countContactsByTagInMonth(
              { locationId: connection.location_id, accessToken: connection.access_token },
              office.ghl_tag,
              start,
              end
            );
          } catch {
            leadsCrm = 0;
          }
        }

        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from("reporte_diario_snapshots")
          .upsert(
            { office_id: office.id, snapshot_date: dateStr, gasto, leads_meta: leadsMeta, leads_crm: leadsCrm },
            { onConflict: "office_id,snapshot_date" }
          );

        if (!error) {
          snapshotByOfficeId.set(office.id, {
            office_id: office.id,
            gasto,
            leads_meta: leadsMeta,
            leads_crm: leadsCrm,
            created_at: nowIso,
          });
        }
      })
    );
  }

  // El cupo de refrescos manuales solo se actualiza cuando el refresco
  // manual efectivamente se usó (no en cargas normales ni en configChange).
  let windowStartedAt = refreshState?.window_started_at ?? new Date(now).toISOString();
  let forceCount = refreshState?.force_count ?? 0;
  if (opts.manual) {
    if (windowExpired || !refreshState) {
      windowStartedAt = new Date(now).toISOString();
      forceCount = manualAllowed ? 1 : 0;
    } else if (manualAllowed) {
      forceCount += 1;
    }
    await supabase
      .from("reporte_diario_refresh_state")
      .upsert({ snapshot_date: dateStr, window_started_at: windowStartedAt, force_count: forceCount });
  }

  const latestUpdatedAt = Array.from(snapshotByOfficeId.values()).reduce<string | null>((max, s) => {
    if (!s.created_at) return max;
    return !max || s.created_at > max ? s.created_at : max;
  }, null);

  const cache: SnapshotMeta = {
    updatedAt: latestUpdatedAt,
    forceRemaining: MAX_MANUAL_REFRESHES_PER_WINDOW - forceCount,
    nextWindowAt: new Date(new Date(windowStartedAt).getTime() + CACHE_TTL_MS).toISOString(),
  };

  const data = offices.map((office) => {
    const diario = office.distribucion_office_id ? diarioByOfficeId.get(office.distribucion_office_id) ?? 0 : 0;
    const snap = snapshotByOfficeId.get(office.id);
    return computeReporteDiarioOffice(office, diario, snap?.gasto ?? 0, snap?.leads_meta ?? 0, snap?.leads_crm ?? 0);
  });

  return { data, cache };
}
