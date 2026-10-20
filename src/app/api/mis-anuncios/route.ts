import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/auth";
import { fetchMisAnuncios } from "@/lib/misAnuncios";
import { bogotaPresetToRange } from "@/lib/bogota";

// Módulo "Mis Anuncios": solo lectura; SuperAdmin o Admin con el módulo habilitado.
export async function GET(request: NextRequest) {
  const auth = await requireModuleAccess("mis-anuncios");
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
    const result = await fetchMisAnuncios({ ...range, campaignIds });
    return NextResponse.json({ data: { ...result, range } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
