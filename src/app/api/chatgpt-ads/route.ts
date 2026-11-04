import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/auth";
import { fetchChatgptAdsReport } from "@/lib/chatgptAds";
import { bogotaPresetToRange } from "@/lib/bogota";

// Módulo "ChatGPT Ads": solo lectura; SuperAdmin o Admin con el módulo habilitado.
export async function GET(request: NextRequest) {
  const auth = await requireModuleAccess("chatgpt-ads");
  if ("error" in auth) return auth.error;

  const params = request.nextUrl.searchParams;
  const since = params.get("since");
  const until = params.get("until");
  const validDate = (d: string | null) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
  const range =
    validDate(since) && validDate(until)
      ? { since: since as string, until: until as string }
      : bogotaPresetToRange(params.get("date_preset") ?? "last_7d");

  try {
    const data = await fetchChatgptAdsReport(range.since, range.until);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
