import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";
import { fetchAllAccountsBilling } from "@/lib/metaAds";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildConnectionStatus, type ApiConnectionRecord } from "@/lib/whatsapp";
import { bogotaDateString } from "@/lib/bogota";

const ACCOUNT_STATUS_LABEL: Record<number, string> = {
  1: "Activa",
  2: "Deshabilitada",
  3: "Sin liquidar",
  7: "En revisión de riesgo",
  8: "Pendiente de liquidación",
  9: "Periodo de gracia",
  100: "Pendiente de cierre",
  101: "Cerrada",
};

function money(n: number) {
  return n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

// Disparado por el cron de Vercel (ver vercel.json) una vez al día:
// arma el resumen de Status Ads (facturación) + Status API (WhatsApp) y
// lo envía a Telegram. También se puede llamar a mano para probar.
export async function GET() {
  try {
    const supabase = supabaseServer();
    const [billing, { data: connections }] = await Promise.all([
      fetchAllAccountsBilling(),
      supabase.from("api_connections").select("*").order("position", { ascending: true }),
    ]);

    const whatsapp = await Promise.all(((connections ?? []) as ApiConnectionRecord[]).map(buildConnectionStatus));

    const lines: string[] = [];
    lines.push(`<b>📊 Reporte diario · ${bogotaDateString()}</b>`);

    // --- Status Ads ---
    lines.push("");
    lines.push("<b>💳 Status Ads (facturación)</b>");
    const totalPending = billing.reduce((s, a) => s + (a.error ? 0 : a.balance), 0);
    lines.push(`Saldo pendiente total: <b>$ ${money(totalPending)}</b>`);
    for (const a of billing) {
      if (a.error) {
        lines.push(`⚠️ ${a.name}: no se pudo consultar`);
        continue;
      }
      const flag = a.accountStatus === 1 ? "🟢" : a.accountStatus === 9 || a.accountStatus === 3 ? "🟡" : "🔴";
      const estado = ACCOUNT_STATUS_LABEL[a.accountStatus] ?? `estado ${a.accountStatus}`;
      const debt = a.balance > 0 ? ` · saldo $ ${money(a.balance)}` : "";
      lines.push(`${flag} ${a.name} — ${estado}${debt}`);
    }

    // --- Status API (WhatsApp) ---
    lines.push("");
    lines.push("<b>📱 Status API (WhatsApp)</b>");
    for (const c of whatsapp) {
      let dot = "⚪️";
      if (c.error) dot = "⚠️";
      else if (c.quality_rating === "GREEN") dot = "🟢";
      else if (c.quality_rating === "YELLOW") dot = "🟡";
      else if (c.quality_rating === "RED") dot = "🔴";
      const num = c.display_phone_number ?? c.phone_number_id;
      lines.push(`${dot} ${c.label} — ${num}`);
    }

    await sendTelegramMessage(lines.join("\n"));
    return NextResponse.json({ ok: true, sent: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error enviando el reporte a Telegram" },
      { status: 500 }
    );
  }
}
