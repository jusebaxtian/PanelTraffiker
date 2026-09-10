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

function statusName(s: number) {
  return STATUS_LABEL[s] ?? `estado ${s}`;
}

function money(n: number) {
  return Math.round(n).toLocaleString("es-CO");
}

interface StoredRow {
  account_id: string;
  last_status: number | null;
  last_balance: number | null;
}

// Compara el estado actual de cada cuenta publicitaria contra el último
// guardado; si cambió, manda una alerta a Telegram y actualiza el
// registro. La primera vez que ve una cuenta solo guarda la línea base
// (no alerta). Está pensado para llamarse tanto desde el cron diario
// como al abrir la página Status Ads (sin bloquear la respuesta).
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
  for (const a of billing) {
    if (a.error) continue;

    const prev = prevByAccount.get(a.accountId);
    if (prev && prev.last_status != null && prev.last_status !== a.accountStatus) {
      changed++;
      const emoji = a.accountStatus === 1 ? "✅" : a.accountStatus === 9 || a.accountStatus === 3 ? "⚠️" : "🔴";
      try {
        await sendTelegramMessage(
          `${emoji} <b>Cambio de estado — cuenta publicitaria</b>\n\n` +
            `<b>${a.name}</b>\n` +
            `${statusName(prev.last_status)} → <b>${statusName(a.accountStatus)}</b>\n` +
            `Saldo pendiente: $ ${money(a.balance)}`
        );
      } catch {
        // si Telegram falla no rompemos el resto; igual actualizamos el estado
      }
    }

    await supabase.from("ad_account_status").upsert({
      account_id: a.accountId,
      account_name: a.name,
      last_status: a.accountStatus,
      last_balance: a.balance,
      updated_at: new Date().toISOString(),
    });
  }

  return { changed };
}
