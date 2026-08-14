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
export async function getOrBuildSnapshot(dateStr: string): Promise<ReporteDiarioOfficeComputed[]> {
  const supabase = supabaseServer();

  const [
    { data: rows, error: officesError },
    { data: distribucionOffices },
    { data: distribucionAgents },
    { data: crmConnections },
    { data: existingSnapshots },
  ] = await Promise.all([
    supabase.from("reporte_diario_offices").select("*").order("position", { ascending: true }),
    supabase.from("offices").select("id, name"),
    supabase.from("agents").select("id, office_id, type, custom_value"),
    supabase.from("proyeccion_crm_connections").select("id, location_id, access_token"),
    supabase.from("reporte_diario_snapshots").select("office_id, gasto, leads_meta, leads_crm").eq("snapshot_date", dateStr),
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

  const missingOffices = offices.filter((o) => !snapshotByOfficeId.has(o.id));
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

        const { error } = await supabase
          .from("reporte_diario_snapshots")
          .upsert(
            { office_id: office.id, snapshot_date: dateStr, gasto, leads_meta: leadsMeta, leads_crm: leadsCrm },
            { onConflict: "office_id,snapshot_date" }
          );

        if (!error) {
          snapshotByOfficeId.set(office.id, { office_id: office.id, gasto, leads_meta: leadsMeta, leads_crm: leadsCrm });
        }
      })
    );
  }

  return offices.map((office) => {
    const diario = office.distribucion_office_id ? diarioByOfficeId.get(office.distribucion_office_id) ?? 0 : 0;
    const snap = snapshotByOfficeId.get(office.id);
    return computeReporteDiarioOffice(office, diario, snap?.gasto ?? 0, snap?.leads_meta ?? 0, snap?.leads_crm ?? 0);
  });
}
