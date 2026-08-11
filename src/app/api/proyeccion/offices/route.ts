import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { fetchAllAccountsInsights } from "@/lib/metaAds";
import { countContactsByTagInMonth } from "@/lib/ghl";
import { computeOffice, type CampaignRef, type ProyeccionOffice } from "@/lib/proyeccion";
import { officeTotal } from "@/lib/distribucion";

interface AgentRow {
  office_id: string;
  type: "junior" | "ejecutivo";
  custom_value: number | null;
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
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
  };
}

export async function GET(request: NextRequest) {
  const configId = request.nextUrl.searchParams.get("config_id");
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
  ] = await Promise.all([
    supabase.from("proyeccion_offices").select("*").eq("config_id", configId).order("position", { ascending: true }),
    supabase.from("proyeccion_config").select("*").eq("id", configId).maybeSingle(),
    supabase.from("offices").select("id, name"),
    supabase.from("agents").select("id, office_id, type, custom_value"),
    supabase.from("proyeccion_crm_connections").select("id, location_id, access_token"),
  ]);

  if (officesError) {
    return NextResponse.json({ error: officesError.message }, { status: 500 });
  }

  const diasFaltantes = config?.days_remaining ?? 0;
  const costoFtdMes = config?.costo_ftd_mes ?? 0;
  const { start, end } = monthRange();

  // $ Diario se toma del valor TOTAL de la oficina en Distribución
  // (suma de sus agentes), no del monto de admin.
  const diarioByOfficeId = new Map(
    (distribucionOffices ?? []).map((o: { id: string }) => [
      o.id,
      officeTotal({ agents: (distribucionAgents ?? []).filter((a: AgentRow) => a.office_id === o.id) }),
    ])
  );

  let insights: Awaited<ReturnType<typeof fetchAllAccountsInsights>> = [];
  try {
    insights = await fetchAllAccountsInsights({ datePreset: "this_month", level: "campaign" });
  } catch {
    insights = [];
  }

  const offices = (rows ?? []).map(rowToOffice);

  const crmConnectionById = new Map(
    (crmConnections ?? []).map((c: { id: string; location_id: string; access_token: string }) => [c.id, c])
  );

  const data = await Promise.all(
    offices.map(async (office) => {
      const campaignIds = new Set(office.campaigns.map((c) => c.campaign_id));
      const gastoDelMes = insights
        .filter((i) => i.campaign_id && campaignIds.has(i.campaign_id))
        .reduce((sum, i) => sum + Number(i.spend ?? 0), 0);

      const diario = office.distribucion_office_id
        ? diarioByOfficeId.get(office.distribucion_office_id) ?? 0
        : 0;

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

      return computeOffice(office, diario, gastoDelMes, leadsDelMes, diasFaltantes, costoFtdMes);
    })
  );

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
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

  return NextResponse.json({ data: computeOffice(rowToOffice(data), 0, 0, 0, 0, 0) });
}
