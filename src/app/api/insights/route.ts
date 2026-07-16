import { NextRequest, NextResponse } from "next/server";
import { fetchAllAccountsInsights } from "@/lib/metaAds";

export async function GET(request: NextRequest) {
  const datePreset = request.nextUrl.searchParams.get("date_preset") ?? "last_30d";

  try {
    const insights = await fetchAllAccountsInsights({ datePreset });
    return NextResponse.json({ data: insights });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
