import { NextRequest, NextResponse } from "next/server";
import { getOrBuildSnapshot } from "@/lib/reporteDiarioSnapshot";
import { bogotaYesterdayDateString } from "@/lib/bogota";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? bogotaYesterdayDateString();
  const force = request.nextUrl.searchParams.get("force") === "1";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  try {
    const data = await getOrBuildSnapshot(date, force);
    return NextResponse.json({ data, date });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error construyendo el reporte diario" },
      { status: 500 }
    );
  }
}
