import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { fetchAllAccountsInsights } from "@/lib/metaAds";
import { countContactsByTagInMonth } from "@/lib/ghl";
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
  gastado: number;
  ftd_real: number;
  ftd_meta_mes: number;
  campaigns: CampaignRef[];
  distribucion_office_id: string | null;
  ghl_tag: string | null;
  position: number;
}): ProyeccionOffice {
  return {
    id: row.id,
    admin: row.admin,
    asignacion: row.asignacion,
    gastado: Number(row.gastado),
    ftd_real: Number(row.ftd_real),
    ftd_meta_mes: Number(row.ftd_meta_mes),
    campaigns: row.campaigns ?? [],
    distribucion_office_id: row.distribucion_office_id,
    ghl_tag: row.ghl_tag,
    position: row.position,
  };
}

export async function GET() {
  const supabase = supabaseServer();

  const [{ data: rows, error: officesError }, { data: config }, { data: distribucionOffices }] =
    await Promise.all([
      supabase.from("proyeccion_offices").select("*").order("position", { ascending: true }),
      supabase
        .from("proyeccion_config")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("offices").select("id, name, admin_amount"),
    ]);

  if (officesError) {
    return NextResponse.json({ error: officesError.message }, { status: 500 });
  }

  const diasFaltantes = config?.days_remaining ?? 0;
  const costoFtdMes = config?.costo_ftd_mes ?? 0;
  const { start, end } = monthRange();

  const diarioByOfficeId = new Map(
    (distribucionOffices ?? []).map((o: { id: string; admin_amount: number }) => [o.id, Number(o.admin_amount)])
  );

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

      const diario = office.distribucion_office_id
        ? diarioByOfficeId.get(office.distribucion_office_id) ?? 0
        : 0;

      let leadsDelMes = 0;
      if (office.ghl_tag) {
        try {
          leadsDelMes = await countContactsByTagInMonth(office.ghl_tag, start, end);
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

  return NextResponse.json({ data: computeOffice(rowToOffice(data), 0, 0, 0, 0, 0) });
}
