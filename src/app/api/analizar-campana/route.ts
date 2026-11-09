import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/auth";
import { fetchCampaignAnalysis } from "@/lib/analizarCampana";
import { bogotaPresetToRange } from "@/lib/bogota";

// Módulo "Analizar Campaña": solo lectura; SuperAdmin o Admin con el módulo habilitado.
export async function GET(request: NextRequest) {
  const auth = await requireModuleAccess("analizar-campana");
  if ("error" in auth) return auth.error;

  const p = request.nextUrl.searchParams;
  const accountId = p.get("account_id") ?? "";
  const campaignId = p.get("campaign_id") ?? "";
  if (!/^act_\d+$/.test(accountId) || !/^\d+$/.test(campaignId)) {
    return NextResponse.json({ error: "Elige una campaña" }, { status: 400 });
  }
  const since = p.get("since");
  const until = p.get("until");
  const preset = p.get("date_preset") ?? "lifetime";
  const isDate = (d: string | null) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

  try {
    const options =
      isDate(since) && isDate(until)
        ? { since: since!, until: until! }
        : preset === "lifetime"
          ? { lifetime: true }
          : bogotaPresetToRange(preset);
    const data = await fetchCampaignAnalysis({ accountId, campaignId, ...options });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
