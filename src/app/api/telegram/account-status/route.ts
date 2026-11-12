import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { checkAdAccountStatusChanges } from "@/lib/adStatusWatch";

// Revisión frecuente del estado de pago de las cuentas publicitarias
// (Activa, Periodo de gracia, Sin liquidar…). La llama GitHub Actions cada
// pocos minutos (.github/workflows/account-status.yml) y avisa por Telegram
// solo cuando una cuenta cambia de estado. No devuelve datos de las cuentas
// y, aunque la llamen muchas veces, consulta Meta como máximo una vez por minuto.
const MIN_INTERVAL_MS = 60_000;

export async function GET() {
  try {
    const supabase = supabaseServer();
    const { data: last } = await supabase
      .from("ad_account_status")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last?.updated_at && Date.now() - new Date(last.updated_at).getTime() < MIN_INTERVAL_MS) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const { changed } = await checkAdAccountStatusChanges();
    return NextResponse.json({ ok: true, changed });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
