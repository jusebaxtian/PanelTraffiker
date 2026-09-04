import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { monthLabel, monthRange, type CampaignRef } from "@/lib/proyeccion";
import { fetchAllAccountsInsights, conversationsStarted } from "@/lib/metaAds";
import { countContactsByTagInMonth } from "@/lib/ghl";
import { officeTotal } from "@/lib/distribucion";
import { requireModuleWriteAccess, requireWriteAccess } from "@/lib/auth";
import { bogotaMonthKey, bogotaNowServer } from "@/lib/bogota";

export async function GET(request: NextRequest, { params }: { params: Promise<{ monthKey: string }> }) {
  const { monthKey } = await params;
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("proyeccion_config")
    .select("*")
    .eq("month_key", monthKey)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Mes no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ data: { ...data, month_label: monthLabel(data.month_key) } });
}

interface AgentRow {
  office_id: string;
  type: "junior" | "ejecutivo";
  custom_value: number | null;
}

interface OfficeRow {
  id: string;
  campaigns: CampaignRef[];
  distribucion_office_id: string | null;
  ghl_tag: string | null;
  crm_connection_id: string | null;
}

// Cierra el mes: toma una última foto en vivo de gasto (Meta), leads
// (GHL) y $ diario (Distribución) por oficina, la deja guardada en las
// columnas *_final, y a partir de ahí este mes no vuelve a consultar
// esas APIs nunca más.
async function freezeMonth(configId: string, monthKey: string) {
  const supabase = supabaseServer();
  const { start, end, since, until } = monthRange(monthKey);

  const [{ data: offices }, { data: distribucionOffices }, { data: distribucionAgents }, { data: crmConnections }] =
    await Promise.all([
      supabase
        .from("proyeccion_offices")
        .select("id, campaigns, distribucion_office_id, ghl_tag, crm_connection_id")
        .eq("config_id", configId),
      supabase.from("offices").select("id, name"),
      supabase.from("agents").select("id, office_id, type, custom_value"),
      supabase.from("proyeccion_crm_connections").select("id, location_id, access_token"),
    ]);

  const diarioByOfficeId = new Map(
    (distribucionOffices ?? []).map((o: { id: string }) => [
      o.id,
      officeTotal({ agents: (distribucionAgents ?? []).filter((a: AgentRow) => a.office_id === o.id) }),
    ])
  );
  const crmConnectionById = new Map(
    (crmConnections ?? []).map((c: { id: string; location_id: string; access_token: string }) => [c.id, c])
  );

  let insights: Awaited<ReturnType<typeof fetchAllAccountsInsights>> = [];
  try {
    insights = await fetchAllAccountsInsights({ timeRange: { since, until }, level: "campaign" });
  } catch {
    insights = [];
  }

  await Promise.all(
    (offices ?? []).map(async (office: OfficeRow) => {
      const campaignIds = new Set((office.campaigns ?? []).map((c) => c.campaign_id));
      const officeInsights = insights.filter((i) => i.campaign_id && campaignIds.has(i.campaign_id));
      const gastoFinal = officeInsights.reduce((sum, i) => sum + Number(i.spend ?? 0), 0);
      const leadsMetaFinal = officeInsights.reduce((sum, i) => sum + conversationsStarted(i), 0);

      let leadsFinal = 0;
      const connection = office.crm_connection_id ? crmConnectionById.get(office.crm_connection_id) : null;
      if (office.ghl_tag && connection) {
        try {
          leadsFinal = await countContactsByTagInMonth(
            { locationId: connection.location_id, accessToken: connection.access_token },
            office.ghl_tag,
            start,
            end
          );
        } catch {
          leadsFinal = 0;
        }
      }

      const diarioFinal = office.distribucion_office_id ? diarioByOfficeId.get(office.distribucion_office_id) ?? 0 : 0;

      await supabase
        .from("proyeccion_offices")
        .update({ gasto_final: gastoFinal, leads_meta_final: leadsMetaFinal, leads_final: leadsFinal, diario_final: diarioFinal })
        .eq("id", office.id);
    })
  );
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ monthKey: string }> }) {
  const { monthKey } = await params;
  const supabase = supabaseServer();
  const body = await request.json();

  // Cerrar/reabrir el mes es una acción más sensible que ajustar Días
  // faltantes o $ FTD: solo SuperAdmin puede hacerlo.
  if (body.action === "close" || body.action === "reopen") {
    const auth = await requireWriteAccess();
    if ("error" in auth) return auth.error;

    const { data: current, error: fetchError } = await supabase
      .from("proyeccion_config")
      .select("*")
      .eq("month_key", monthKey)
      .maybeSingle();
    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!current) return NextResponse.json({ error: "Mes no encontrado" }, { status: 404 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.action === "close") {
      if (!current.closed) {
        // El mes en curso solo se puede cerrar el último día (hora de
        // Colombia), para evitar cerrarlo por error a mitad de mes. Un
        // mes ya pasado siempre se puede cerrar.
        const nowBogota = bogotaNowServer();
        const isCurrentMonth = monthKey === bogotaMonthKey(nowBogota);
        if (isCurrentMonth) {
          const lastDayOfMonth = new Date(Date.UTC(nowBogota.getUTCFullYear(), nowBogota.getUTCMonth() + 1, 0)).getUTCDate();
          if (nowBogota.getUTCDate() !== lastDayOfMonth) {
            return NextResponse.json(
              { error: "El mes en curso solo se puede cerrar el último día del mes" },
              { status: 400 }
            );
          }
        }
        await freezeMonth(current.id, monthKey);
        updates.closed = true;
        updates.closed_at = new Date().toISOString();
      }
      // Si ya estaba cerrado, "Cerrar mes" solo vuelve a bloquear la
      // edición (no se recongela: se conservan los ajustes manuales).
      updates.locked = true;
    } else {
      if (!current.closed) {
        return NextResponse.json({ error: "El mes todavía no está cerrado" }, { status: 400 });
      }
      // Reabrir solo desbloquea la edición de los valores congelados;
      // "closed" nunca vuelve a false, no se reconecta nada en vivo.
      updates.locked = false;
    }

    const { data, error } = await supabase
      .from("proyeccion_config")
      .update(updates)
      .eq("month_key", monthKey)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: { ...data, month_label: monthLabel(data.month_key) } });
  }

  const auth = await requireModuleWriteAccess("proyeccion");
  if ("error" in auth) return auth.error;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.days_remaining === "number") updates.days_remaining = body.days_remaining;
  if (typeof body.costo_ftd_mes === "number") updates.costo_ftd_mes = body.costo_ftd_mes;

  const { data, error } = await supabase
    .from("proyeccion_config")
    .update(updates)
    .eq("month_key", monthKey)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { ...data, month_label: monthLabel(data.month_key) } });
}
