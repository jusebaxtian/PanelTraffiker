import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";
import { fetchAllAccountsBilling } from "@/lib/metaAds";
import { getOrBuildSnapshot } from "@/lib/reporteDiarioSnapshot";
import { bogotaDateString, bogotaYesterdayDateString } from "@/lib/bogota";

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
  return Math.round(n).toLocaleString("es-CO");
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pad(s: string, len: number) {
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

function padLeft(s: string, len: number) {
  return s.length >= len ? s : " ".repeat(len - s.length) + s;
}

// Disparado por el cron de Vercel (ver vercel.json) una vez al día:
// arma el resumen de Status Ads (facturación) + el Reporte Diario de
// ayer y lo envía a Telegram. También se puede llamar a mano para probar.
export async function GET() {
  try {
    const yesterday = bogotaYesterdayDateString();
    const [billing, snapshot] = await Promise.all([
      fetchAllAccountsBilling(),
      getOrBuildSnapshot(yesterday),
    ]);

    const lines: string[] = [];
    lines.push(`<b>📊 Reporte diario · ${bogotaDateString()}</b>`);

    // --- Status Ads ---
    lines.push("");
    lines.push("<b>💳 Status Ads (facturación)</b>");
    const totalPending = billing.reduce((s, a) => s + (a.error ? 0 : a.balance), 0);
    lines.push(`Saldo pendiente total: <b>$ ${money(totalPending)}</b>`);
    for (const a of billing) {
      if (a.error) {
        lines.push(`⚠️ ${escapeHtml(a.name)}: no se pudo consultar`);
        continue;
      }
      const flag = a.accountStatus === 1 ? "🟢" : a.accountStatus === 9 || a.accountStatus === 3 ? "🟡" : "🔴";
      const estado = ACCOUNT_STATUS_LABEL[a.accountStatus] ?? `estado ${a.accountStatus}`;
      const debt = a.balance > 0 ? ` · saldo $ ${money(a.balance)}` : "";
      lines.push(`${flag} ${escapeHtml(a.name)} — ${estado}${debt}`);
    }

    // --- Reporte Diario de ayer ---
    lines.push("");
    lines.push(`<b>📅 Reporte Diario · Ayer (${yesterday})</b>`);

    const rows = snapshot.data;
    const table: string[] = [];
    table.push(
      pad("Oficina", 13) +
        padLeft("L.Meta", 8) +
        padLeft("L.CRM", 7) +
        padLeft("$/Lead", 9) +
        padLeft("Gasto", 12)
    );
    let totalGasto = 0;
    let totalLeadsCrm = 0;
    for (const o of rows) {
      totalGasto += o.gasto;
      totalLeadsCrm += o.leads_crm;
      table.push(
        pad(o.asignacion, 13) +
          padLeft(String(o.leads_meta), 8) +
          padLeft(String(o.leads_crm), 7) +
          padLeft(money(o.costo_x_resultado), 9) +
          padLeft(money(o.gasto), 12)
      );
    }
    lines.push(`<pre>${escapeHtml(table.join("\n"))}</pre>`);
    lines.push(`Total gasto del día: <b>$ ${money(totalGasto)}</b>`);
    lines.push(`Total leads CRM: <b>${money(totalLeadsCrm)}</b>`);

    await sendTelegramMessage(lines.join("\n"));
    return NextResponse.json({ ok: true, sent: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error enviando el reporte a Telegram" },
      { status: 500 }
    );
  }
}
