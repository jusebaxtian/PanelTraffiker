import { NextResponse } from "next/server";
import { getOrBuildSnapshot } from "@/lib/reporteDiarioSnapshot";
import { bogotaYesterdayDateString } from "@/lib/bogota";

// Disparado automáticamente por el cron de Vercel (ver vercel.json) una
// vez al día, para que el snapshot de "ayer" quede guardado sin que
// nadie tenga que abrir el panel.
export async function GET() {
  const date = bogotaYesterdayDateString();
  try {
    const data = await getOrBuildSnapshot(date);
    return NextResponse.json({ ok: true, date, offices: data.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error construyendo el reporte diario" },
      { status: 500 }
    );
  }
}
