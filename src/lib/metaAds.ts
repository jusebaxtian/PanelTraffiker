import { supabaseServer } from "@/lib/supabaseServer";

const META_API_VERSION = "v21.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export interface AdAccountConnection {
  accountId: string;
  accessToken: string;
  name?: string;
}

// Combina las cuentas configuradas por variables de entorno (token
// compartido, legado) con las que el usuario agrega desde el panel
// (nombre + Account ID + token propio, guardadas en meta_ad_accounts).
export async function getAllAdAccountConnections(): Promise<AdAccountConnection[]> {
  const envToken = process.env.META_ACCESS_TOKEN;
  const envIds = (process.env.META_AD_ACCOUNT_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const envAccounts: AdAccountConnection[] = envToken
    ? envIds.map((accountId) => ({ accountId, accessToken: envToken }))
    : [];

  const supabase = supabaseServer();
  const { data } = await supabase.from("meta_ad_accounts").select("account_id, access_token, name");
  const dbAccounts: AdAccountConnection[] = (data ?? []).map(
    (a: { account_id: string; access_token: string; name: string }) => ({
      accountId: a.account_id,
      accessToken: a.access_token,
      name: a.name,
    })
  );

  return [...envAccounts, ...dbAccounts];
}

export interface AdAccountBilling {
  accountId: string;
  name: string;
  businessName: string | null;
  currency: string;
  amountSpent: number;
  spendCap: number;
  balance: number;
  accountStatus: number;
  disableReason: number;
  error: string | null;
}

interface BatchResponseItem {
  code: number;
  body: string;
}

const BILLING_FIELDS = "name,account_id,currency,amount_spent,spend_cap,balance,account_status,disable_reason,business_name";

function billingErrorRow(a: AdAccountConnection, message: string): AdAccountBilling {
  return {
    accountId: a.accountId,
    name: a.name ?? a.accountId.replace("act_", ""),
    businessName: null,
    currency: "",
    amountSpent: 0,
    spendCap: 0,
    balance: 0,
    accountStatus: 0,
    disableReason: 0,
    error: message,
  };
}

function billingRowFromMeta(a: AdAccountConnection, data: Record<string, unknown>): AdAccountBilling {
  return {
    accountId: (data.account_id as string) ?? a.accountId,
    name: (data.name as string) ?? a.name ?? a.accountId,
    businessName: (data.business_name as string) || null,
    currency: (data.currency as string) ?? "",
    amountSpent: Number(data.amount_spent ?? 0),
    spendCap: Number(data.spend_cap ?? 0),
    balance: Number(data.balance ?? 0),
    accountStatus: Number(data.account_status ?? 0),
    disableReason: Number(data.disable_reason ?? 0),
    error: null,
  };
}

// Trae el estado de facturación (saldo pendiente, estado de cuenta, gasto
// total) de todas las cuentas publicitarias usando el "Batch API" de Meta,
// para no hacer una llamada HTTP por cuenta. El batch de Meta exige que el
// access_token "paraguas" de la petición sea de la MISMA app que los
// tokens de cada ítem (si no, responde 403 aunque el ítem lleve su propio
// token) — así que se agrupa por token: una sola llamada batch por cada
// token distinto, no una por cuenta.
export async function fetchAllAccountsBilling(): Promise<AdAccountBilling[]> {
  const accounts = await getAllAdAccountConnections();
  if (accounts.length === 0) return [];

  const groups = new Map<string, AdAccountConnection[]>();
  for (const a of accounts) {
    if (!groups.has(a.accessToken)) groups.set(a.accessToken, []);
    groups.get(a.accessToken)!.push(a);
  }

  const resultByAccountId = new Map<string, AdAccountBilling>();

  await Promise.all(
    Array.from(groups.entries()).map(async ([token, groupAccounts]) => {
      const batch = groupAccounts.map((a) => ({
        method: "GET",
        relative_url: `${a.accountId}?fields=${BILLING_FIELDS}`,
      }));

      try {
        const res = await fetch(META_BASE_URL, {
          method: "POST",
          body: new URLSearchParams({ access_token: token, batch: JSON.stringify(batch) }),
        });
        const items: BatchResponseItem[] = await res.json();

        groupAccounts.forEach((a, i) => {
          const item = items?.[i];
          if (!item || item.code !== 200) {
            resultByAccountId.set(a.accountId, billingErrorRow(a, "No se pudo consultar esta cuenta"));
            return;
          }
          try {
            resultByAccountId.set(a.accountId, billingRowFromMeta(a, JSON.parse(item.body)));
          } catch {
            resultByAccountId.set(a.accountId, billingErrorRow(a, "Respuesta inválida de Meta"));
          }
        });
      } catch {
        groupAccounts.forEach((a) => resultByAccountId.set(a.accountId, billingErrorRow(a, "No se pudo consultar esta cuenta")));
      }
    })
  );

  return accounts.map((a) => resultByAccountId.get(a.accountId) ?? billingErrorRow(a, "No se pudo consultar esta cuenta"));
}

// Nombre real de la cuenta publicitaria en Meta, para las que no se
// agregaron con un nombre propio (cuentas legado por variable de entorno).
export async function fetchAccountName(adAccountId: string, accessToken: string): Promise<string | null> {
  const url = new URL(`${META_BASE_URL}/${adAccountId}`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fields", "name");
  try {
    const res = await fetch(url.toString());
    const json = await res.json();
    return json.name ?? null;
  } catch {
    return null;
  }
}

export interface ActionValue {
  action_type: string;
  value: string;
}

export interface AdInsight {
  account_id: string;
  campaign_id?: string;
  campaign_name?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  reach?: string;
  frequency?: string;
  unique_clicks?: string;
  actions?: ActionValue[];
  cost_per_action_type?: ActionValue[];
  video_avg_time_watched_actions?: ActionValue[];
  date_start?: string;
  date_stop?: string;
}

export interface Campaign {
  id: string;
  account_id?: string;
  account_name?: string;
  name?: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
}

// Orden de prioridad: se usa el PRIMER tipo de acción disponible, nunca se
// suman los que se solapan. El "resultado" de Meta para campañas de mensajes
// es messaging_conversation_started_7d; total_messaging_connection es una
// métrica más amplia que, sumada, duplicaría el conteo de leads.
const CONVERSATION_ACTION_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
];

export function conversationsStarted(insight: AdInsight): number {
  if (!insight.actions) return 0;
  for (const type of CONVERSATION_ACTION_TYPES) {
    const action = insight.actions.find((a) => a.action_type === type);
    if (action) return Number(action.value ?? 0);
  }
  return 0;
}

function firstActionValue(actions: ActionValue[] | undefined): number {
  if (!actions || actions.length === 0) return 0;
  return Number(actions[0].value ?? 0);
}

// Las reproducciones de video de 3 segundos se reportan dentro del
// arreglo estándar "actions" con action_type "video_view" (no es un
// campo aparte en la API de Meta).
export function video3SecWatched(insight: AdInsight): number {
  if (!insight.actions) return 0;
  const action = insight.actions.find((a) => a.action_type === "video_view");
  return Number(action?.value ?? 0);
}

// Porcentaje de reproducciones de video de 3s sobre las impresiones.
export function video3SecWatchRate(insight: AdInsight): number {
  const impressions = Number(insight.impressions ?? 0);
  if (impressions <= 0) return 0;
  return (video3SecWatched(insight) / impressions) * 100;
}

// Tiempo promedio de reproducción del video, en segundos.
export function videoAvgTimeWatched(insight: AdInsight): number {
  return firstActionValue(insight.video_avg_time_watched_actions);
}

interface MetaInsightsResponse {
  data: AdInsight[];
  paging?: { next?: string };
  error?: { message: string; type: string; code: number };
}

const DEFAULT_FIELDS = [
  "campaign_id",
  "campaign_name",
  "impressions",
  "clicks",
  "spend",
  "cpc",
  "cpm",
  "ctr",
  "reach",
  "frequency",
  "unique_clicks",
  "actions",
  "cost_per_action_type",
  "video_avg_time_watched_actions",
].join(",");

export interface TimeRange {
  since: string;
  until: string;
}

export async function fetchAccountInsights(
  adAccountId: string,
  accessToken: string,
  options: { datePreset?: string; timeRange?: TimeRange; level?: string } = {}
): Promise<AdInsight[]> {
  const { datePreset, timeRange, level = "campaign" } = options;
  const url = new URL(`${META_BASE_URL}/${adAccountId}/insights`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fields", DEFAULT_FIELDS);
  if (timeRange) {
    url.searchParams.set("time_range", JSON.stringify(timeRange));
  } else {
    url.searchParams.set("date_preset", datePreset ?? "last_30d");
  }
  url.searchParams.set("level", level);
  url.searchParams.set("limit", "500");

  const results: AdInsight[] = [];
  let nextUrl: string | null = url.toString();

  while (nextUrl) {
    const res: Response = await fetch(nextUrl);
    const json: MetaInsightsResponse = await res.json();

    if (json.error) {
      throw new Error(`Meta API error (${adAccountId}): ${json.error.message}`);
    }

    results.push(...json.data.map((d) => ({ ...d, account_id: adAccountId })));
    nextUrl = json.paging?.next ?? null;
  }

  return results;
}

// Una cuenta con token inválido no debe tumbar las demás: se atrapa el
// error por cuenta y esa se omite en vez de fallar todo el batch.
export async function fetchAllAccountsInsights(
  options: { datePreset?: string; timeRange?: TimeRange; level?: string } = {}
): Promise<AdInsight[]> {
  const accounts = await getAllAdAccountConnections();
  const results = await Promise.all(
    accounts.map((a) =>
      fetchAccountInsights(a.accountId, a.accessToken, options).catch(() => [] as AdInsight[])
    )
  );
  return results.flat();
}

interface MetaCampaignsResponse {
  data: Campaign[];
  paging?: { next?: string };
  error?: { message: string; type: string; code: number };
}

export async function fetchAccountCampaigns(adAccountId: string, accessToken: string): Promise<Campaign[]> {
  const url = new URL(`${META_BASE_URL}/${adAccountId}/campaigns`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("fields", "id,name,objective,status,effective_status,daily_budget");
  url.searchParams.set("limit", "500");

  const results: Campaign[] = [];
  let nextUrl: string | null = url.toString();

  while (nextUrl) {
    const res: Response = await fetch(nextUrl);
    const json: MetaCampaignsResponse = await res.json();

    if (json.error) {
      throw new Error(`Meta API error (${adAccountId}): ${json.error.message}`);
    }

    results.push(...json.data.map((d) => ({ ...d, account_id: adAccountId })));
    nextUrl = json.paging?.next ?? null;
  }

  return results;
}

export async function fetchAllAccountsCampaigns(): Promise<Campaign[]> {
  const accounts = await getAllAdAccountConnections();
  const results = await Promise.all(
    accounts.map(async (a) => {
      const accountName = a.name ?? (await fetchAccountName(a.accountId, a.accessToken).catch(() => null));
      const campaigns = await fetchAccountCampaigns(a.accountId, a.accessToken).catch(() => [] as Campaign[]);
      return campaigns.map((c) => ({ ...c, account_name: accountName ?? a.accountId.replace("act_", "") }));
    })
  );
  return results.flat();
}
