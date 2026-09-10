import { NextResponse } from "next/server";
import { fetchAllAccountsBilling } from "@/lib/metaAds";
import { checkAdAccountStatusChanges } from "@/lib/adStatusWatch";

export async function GET() {
  try {
    const data = await fetchAllAccountsBilling();

    // Al abrir la página también se revisa si alguna cuenta cambió de
    // estado desde la última consulta y se avisa por Telegram. Reusa los
    // datos ya traídos y no bloquea ni rompe la respuesta de la tabla.
    checkAdAccountStatusChanges(data).catch(() => {});

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
