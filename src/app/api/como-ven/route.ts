import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/auth";
import { fetchGeoInsights } from "@/lib/geoInsights";
import { bogotaPresetToRange } from "@/lib/bogota";

// Módulo "Mapa Geográfica": solo lectura; SuperAdmin o Admin con el módulo habilitado.
export async function GET(request: NextRequest) {
  const auth = await requireModuleAccess("como-ven");
  if ("error" in auth) return auth.error;

  const params = request.nextUrl.searchParams;
  const sinceParam = params.get("since");
  const untilParam = params.get("until");
  const datePreset = params.get("date_preset") ?? "last_7d";
  const campaignIds = (params.get("campaign_ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^\d+$/.test(id));

  const range =
    sinceParam && untilParam && /^\d{4}-\d{2}-\d{2}$/.test(sinceParam) && /^\d{4}-\d{2}-\d{2}$/.test(untilParam)
      ? { since: sinceParam, until: untilParam }
      : bogotaPresetToRange(datePreset);

  try {
    const data = await fetchGeoInsights({ ...range, campaignIds });
    return NextResponse.json({ data: { ...data, range } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
