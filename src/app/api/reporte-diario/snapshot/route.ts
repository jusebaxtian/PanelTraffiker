import { NextRequest, NextResponse } from "next/server";
import { getOrBuildSnapshot } from "@/lib/reporteDiarioSnapshot";
import { bogotaYesterdayDateString } from "@/lib/bogota";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? bogotaYesterdayDateString();
  const configChange = request.nextUrl.searchParams.get("configChange") === "1";
  const manual = request.nextUrl.searchParams.get("manual") === "1";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  try {
    const { data, cache } = await getOrBuildSnapshot(date, { configChange, manual });
    return NextResponse.json({ data, date, cache });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error construyendo el reporte diario" },
      { status: 500 }
    );
  }
}
