import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { fetchAllAccountsInsights } from "@/lib/metaAds";
import { countOpportunitiesInMonth } from "@/lib/ghl";
import { computeOffice, type CampaignRef, type ProyeccionOffice } from "@/lib/proyeccion";

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

function rowToOffice(row: {
  id: string;
  admin: string;
  asignacion: string;
  diario: number;
  gastado: number;
  costo_ftd_objetivo: number;
  ftd_real: number;
  ftd_meta_mes: number;
  campaigns: CampaignRef[];
  ghl_pipeline_id: string | null;
  ghl_pipeline_name: string | null;
  position: number;
}): ProyeccionOffice {
  return {
    id: row.id,
    admin: row.admin,
    asignacion: row.asignacion,
    diario: Number(row.diario),
    gastado: Number(row.gastado),
    costo_ftd_objetivo: Number(row.costo_ftd_objetivo),
    ftd_real: Number(row.ftd_real),
    ftd_meta_mes: Number(row.ftd_meta_mes),
    campaigns: row.campaigns ?? [],
    ghl_pipeline_id: row.ghl_pipeline_id,
    ghl_pipeline_name: row.ghl_pipeline_name,
    position: row.position,
  };
}

export async function GET() {
  const supabase = supabaseServer();

  const [{ data: rows, error: officesError }, { data: config }] = await Promise.all([
    supabase.from("proyeccion_offices").select("*").order("position", { ascending: true }),
    supabase
      .from("proyeccion_config")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (officesError) {
    return NextResponse.json({ error: officesError.message }, { status: 500 });
  }

  const diasFaltantes = config?.days_remaining ?? 0;
  const { start, end } = monthRange();

  let insights: Awaited<ReturnType<typeof fetchAllAccountsInsights>> = [];
  try {
    insights = await fetchAllAccountsInsights({ datePreset: "this_month", level: "campaign" });
  } catch {
    insights = [];
  }

  const offices = (rows ?? []).map(rowToOffice);

  const data = await Promise.all(
    offices.map(async (office) => {
      const campaignIds = new Set(office.campaigns.map((c) => c.campaign_id));
      const gastoDelMes = insights
        .filter((i) => i.campaign_id && campaignIds.has(i.campaign_id))
        .reduce((sum, i) => sum + Number(i.spend ?? 0), 0);

      let leadsDelMes = 0;
      if (office.ghl_pipeline_id) {
        try {
          leadsDelMes = await countOpportunitiesInMonth(office.ghl_pipeline_id, start, end);
        } catch {
          leadsDelMes = 0;
        }
      }

      return computeOffice(office, gastoDelMes, leadsDelMes, diasFaltantes);
    })
  );

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = supabaseServer();
  const body = await request.json();

  const asignacion = String(body.asignacion ?? "").trim();
  if (!asignacion) {
    return NextResponse.json({ error: "El nombre de la oficina es obligatorio" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("proyeccion_offices")
    .select("position")
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (existing?.[0]?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("proyeccion_offices")
    .insert({
      admin: String(body.admin ?? "").trim(),
      asignacion,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: computeOffice(rowToOffice(data), 0, 0, 0) });
}
