import { supabaseServer } from "@/lib/supabaseServer";
import { fetchAllAccountsBilling, type AdAccountBilling } from "@/lib/metaAds";
import { sendTelegramMessage } from "@/lib/telegram";

const STATUS_LABEL: Record<number, string> = {
  1: "Activa",
  2: "Deshabilitada",
  3: "Sin liquidar",
  7: "En revisión de riesgo",
  8: "Pendiente de liquidación",
  9: "Periodo de gracia",
  100: "Pendiente de cierre",
  101: "Cerrada",
};

// Qué hacer en cada estado de pago, para que el aviso diga si toca pagar.
const STATUS_HINT: Record<number, string> = {
  1: "Ya está al día, los anuncios pueden entregar normal.",
  3: "Hay un saldo sin pagar: paga ya para que los anuncios no se detengan.",
  8: "Meta está procesando el cobro: revisa que el método de pago tenga fondos.",
  9: "Está en periodo de gracia: paga el saldo pendiente antes de que pase a Sin liquidar y se frenen los anuncios.",
};

function statusName(s: number) {
  return STATUS_LABEL[s] ?? `estado ${s}`;
}

function money(n: number) {
  return Math.round(n).toLocaleString("es-CO");
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface StoredRow {
  account_id: string;
  last_status: number | null;
  last_balance: number | null;
}

// Compara el estado actual de cada cuenta publicitaria contra el último
// guardado; si cambió, manda una alerta a Telegram. La primera vez que ve
// una cuenta solo guarda la línea base (no alerta). Se llama cada pocos
// minutos desde GitHub Actions (/api/telegram/account-status), además del
// cron diario y al abrir Status Ads. El cambio se "reclama" con una
// actualización condicionada al estado anterior, así dos revisiones al mismo
// tiempo no mandan el mismo aviso dos veces.
export async function checkAdAccountStatusChanges(
  prefetchedBilling?: AdAccountBilling[]
): Promise<{ changed: number }> {
  const supabase = supabaseServer();
  const [billing, { data: stored }] = await Promise.all([
    prefetchedBilling ? Promise.resolve(prefetchedBilling) : fetchAllAccountsBilling(),
    supabase.from("ad_account_status").select("account_id, last_status, last_balance"),
  ]);

  const prevByAccount = new Map<string, StoredRow>(
    (stored ?? []).map((r: StoredRow) => [r.account_id, r])
  );

  let changed = 0;
  const now = new Date().toISOString();
  for (const a of billing) {
    if (a.error) continue;

    const prev = prevByAccount.get(a.accountId);
    const row = { account_name: a.name, last_status: a.accountStatus, last_balance: a.balance, updated_at: now };

    if (!prev || prev.last_status == null) {
      await supabase.from("ad_account_status").upsert({ account_id: a.accountId, ...row });
      continue;
    }

    if (prev.last_status === a.accountStatus) {
      await supabase.from("ad_account_status").update(row).eq("account_id", a.accountId);
      continue;
    }

    // Solo avisa quien logre pasar el registro del estado anterior al nuevo.
    const { data: claimed } = await supabase
      .from("ad_account_status")
      .update(row)
      .eq("account_id", a.accountId)
      .eq("last_status", prev.last_status)
      .select("account_id");
    if (!claimed?.length) continue;

    changed++;
    const emoji = a.accountStatus === 1 ? "✅" : a.accountStatus === 9 || a.accountStatus === 8 ? "⚠️" : "🔴";
    const hint = STATUS_HINT[a.accountStatus];
    try {
      await sendTelegramMessage(
        `${emoji} <b>Cambio de estado — cuenta publicitaria</b>\n\n` +
          `<b>${escapeHtml(a.name)}</b>\n` +
          `${statusName(prev.last_status)} → <b>${statusName(a.accountStatus)}</b>\n` +
          `Saldo pendiente: $ ${money(a.balance)}` +
          (hint ? `\n\n${hint}` : "")
      );
    } catch {
      // si Telegram falla no rompemos el resto
    }
  }

  return { changed };
}
