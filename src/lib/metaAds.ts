const META_API_VERSION = "v21.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

function getAccessToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN no está configurado");
  return token;
}

export function getAdAccountIds(): string[] {
  const ids = process.env.META_AD_ACCOUNT_IDS;
  if (!ids) throw new Error("META_AD_ACCOUNT_IDS no está configurado");
  return ids.split(",").map((id) => id.trim());
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
  date_start?: string;
  date_stop?: string;
}

export interface Campaign {
  id: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
}

const CONVERSATION_ACTION_TYPES = [
  "onsite_conversion.messaging_conversation_started_7d",
  "onsite_conversion.total_messaging_connection",
  "messaging_conversation_started_7d",
];

export function conversationsStarted(insight: AdInsight): number {
  if (!insight.actions) return 0;
  return insight.actions
    .filter((a) => CONVERSATION_ACTION_TYPES.includes(a.action_type))
    .reduce((sum, a) => sum + Number(a.value ?? 0), 0);
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
].join(",");

export interface TimeRange {
  since: string;
  until: string;
}

export async function fetchAccountInsights(
  adAccountId: string,
  options: { datePreset?: string; timeRange?: TimeRange; level?: string } = {}
): Promise<AdInsight[]> {
  const { datePreset, timeRange, level = "campaign" } = options;
  const url = new URL(`${META_BASE_URL}/${adAccountId}/insights`);
  url.searchParams.set("access_token", getAccessToken());
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

export async function fetchAllAccountsInsights(
  options: { datePreset?: string; timeRange?: TimeRange; level?: string } = {}
): Promise<AdInsight[]> {
  const accountIds = getAdAccountIds();
  const results = await Promise.all(
    accountIds.map((id) => fetchAccountInsights(id, options))
  );
  return results.flat();
}

interface MetaCampaignsResponse {
  data: Campaign[];
  paging?: { next?: string };
  error?: { message: string; type: string; code: number };
}

export async function fetchAccountCampaigns(adAccountId: string): Promise<Campaign[]> {
  const url = new URL(`${META_BASE_URL}/${adAccountId}/campaigns`);
  url.searchParams.set("access_token", getAccessToken());
  url.searchParams.set("fields", "id,objective,status,effective_status,daily_budget");
  url.searchParams.set("limit", "500");

  const results: Campaign[] = [];
  let nextUrl: string | null = url.toString();

  while (nextUrl) {
    const res: Response = await fetch(nextUrl);
    const json: MetaCampaignsResponse = await res.json();

    if (json.error) {
      throw new Error(`Meta API error (${adAccountId}): ${json.error.message}`);
    }

    results.push(...json.data);
    nextUrl = json.paging?.next ?? null;
  }

  return results;
}

export async function fetchAllAccountsCampaigns(): Promise<Campaign[]> {
  const accountIds = getAdAccountIds();
  const results = await Promise.all(accountIds.map((id) => fetchAccountCampaigns(id)));
  return results.flat();
}
