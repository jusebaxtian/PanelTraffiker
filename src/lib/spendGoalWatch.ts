import { supabaseServer } from "@/lib/supabaseServer";
import { getAllAdAccountConnections } from "@/lib/metaAds";
import { sendTelegramMessage } from "@/lib/telegram";

// Metas de gasto mensual que avisan por Telegram a medida que se acercan.
// "Elite" = toda campaña con "Elite" en el nombre, o cualquier campaña de una
// cuenta publicitaria con "Elite" en el nombre, sumando todas las cuentas.
// Por pedido de Sebastián: solo noviembre de 2026.
interface SpendGoal {
  key: string; // se guarda en ad_account_status.account_id para no repetir avisos
  label: string;
  match: RegExp;
  goal: number;
  since: string;
  until: string;
}

const GOALS: SpendGoal[] = [
  {
    key: "meta:elite-2026-11",
    label: "Elite",
    match: /elite/i,
    goal: 28_500_000,
    since: "2026-11-01",
    until: "2026-11-30",
  },
];

// Etapas: 1 = seguimiento activado, 2 = 75 %, 3 = 90 %, 4 = le falta un día
// de gasto o menos, 5 = meta cumplida. Cada etapa avisa una sola vez.
const STAGE_ACTIVE = 1;
const STAGE_75 = 2;
const STAGE_90 = 3;
const STAGE_LAST_DAY = 4;
const STAGE_DONE = 5;

function money(n: number) {
  return "$" + Math.round(n).toLocaleString("es-CO");
}

function bogotaToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }); // YYYY-MM-DD
}

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Gasto por día (suma de campañas que coinciden) en el rango de la meta.
export async function spendByDay(goal: SpendGoal): Promise<Map<string, number>> {
  const byDay = new Map<string, number>();
  const accounts = await getAllAdAccountConnections();
  await Promise.all(
    accounts.map(async (a) => {
      const accountMatches = goal.match.test(a.name ?? "");
      const url = new URL(`https://graph.facebook.com/v21.0/${a.accountId}/insights`);
      url.searchParams.set("level", "campaign");
      url.searchParams.set("fields", "campaign_name,spend");
      url.searchParams.set("time_increment", "1");
      url.searchParams.set("time_range", JSON.stringify({ since: goal.since, until: goal.until }));
      url.searchParams.set("limit", "500");
      url.searchParams.set("access_token", a.accessToken);
      let next: string | null = url.toString();
      while (next) {
        const json: {
          data?: { campaign_name?: string; spend?: string; date_start: string }[];
          paging?: { next?: string };
          error?: unknown;
        } = await (await fetch(next)).json();
        if (json.error) return; // cuenta sin acceso: no suma
        for (const r of json.data ?? []) {
          if (!accountMatches && !goal.match.test(r.campaign_name ?? "")) continue;
          byDay.set(r.date_start, (byDay.get(r.date_start) ?? 0) + Number(r.spend ?? 0));
        }
        next = json.paging?.next ?? null;
      }
    })
  );
  return byDay;
}

export async function checkSpendGoals(): Promise<{ sent: number }> {
  const today = bogotaToday();
  const supabase = supabaseServer();
  let sent = 0;

  for (const goal of GOALS) {
    if (today < goal.since || today > goal.until) continue;

    const { data: row } = await supabase
      .from("ad_account_status")
      .select("last_status")
      .eq("account_id", goal.key)
      .maybeSingle();
    const prevStage = row?.last_status ?? 0;
    if (prevStage >= STAGE_DONE) continue;

    const byDay = await spendByDay(goal);
    const total = Array.from(byDay.values()).reduce((s, v) => s + v, 0);

    // Ritmo diario: promedio de los últimos 3 días completos (sin hoy).
    const lastDays = [1, 2, 3].map((n) => addDays(today, -n).toISOString().slice(0, 10)).filter((d) => d >= goal.since);
    const rate = lastDays.length ? lastDays.reduce((s, d) => s + (byDay.get(d) ?? 0), 0) / lastDays.length : 0;
    const remaining = Math.max(0, goal.goal - total);
    const pct = (total / goal.goal) * 100;

    let stage = STAGE_ACTIVE;
    if (total >= goal.goal) stage = STAGE_DONE;
    else if (rate > 0 && remaining <= rate) stage = STAGE_LAST_DAY;
    else if (pct >= 90) stage = STAGE_90;
    else if (pct >= 75) stage = STAGE_75;
    if (stage <= prevStage) continue;

    // Reclama la etapa antes de avisar, así dos revisiones simultáneas no
    // mandan el mismo mensaje dos veces.
    const now = new Date().toISOString();
    let claimed = false;
    if (!row) {
      const { error } = await supabase
        .from("ad_account_status")
        .insert({ account_id: goal.key, account_name: `Meta de gasto ${goal.label}`, last_status: stage, last_balance: total, updated_at: now });
      claimed = !error;
    } else {
      const { data } = await supabase
        .from("ad_account_status")
        .update({ last_status: stage, last_balance: total, updated_at: now })
        .eq("account_id", goal.key)
        .eq("last_status", prevStage)
        .select("account_id");
      claimed = !!data?.length;
    }
    if (!claimed) continue;

    let text: string;
    if (stage === STAGE_DONE) {
      text = `✅ <b>${goal.label} completó su meta ${goal.goal.toLocaleString("es-CO")} y va en ${money(total)}</b>`;
    } else {
      const days = rate > 0 ? remaining / rate : null;
      const eta =
        days !== null
          ? addDays(today, Math.ceil(days)).toLocaleDateString("es-CO", { day: "numeric", month: "long", timeZone: "UTC" })
          : null;
      const head =
        stage === STAGE_LAST_DAY
          ? `⚠️ <b>${goal.label} está a menos de un día de su meta</b>`
          : stage === STAGE_ACTIVE
            ? `📊 <b>Seguimiento de meta activado: ${goal.label}</b>`
            : `⏳ <b>${goal.label} llegó al ${Math.floor(pct)}% de su meta</b>`;
      text =
        `${head}\n\n` +
        `Va en ${money(total)} de ${money(goal.goal)} (${pct.toFixed(0)}%)\n` +
        `Le faltan ${money(remaining)}\n` +
        (rate > 0
          ? `Gasta ~${money(rate)} al día: la alcanza en ~${days! < 1 ? "menos de 1 día" : `${Math.ceil(days!)} días`} (aprox. ${eta})`
          : "Sin gasto en los últimos días: no se puede proyectar la fecha");
    }
    try {
      await sendTelegramMessage(text);
      sent++;
    } catch {
      // si Telegram falla no rompemos la revisión de cuentas
    }
  }

  return { sent };
}
