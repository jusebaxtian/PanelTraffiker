const GRAPH_API_VERSION = "v21.0";

export type QualityRating = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

export interface PhoneNumberStatus {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: QualityRating;
  messaging_limit_tier?: string;
}

export interface FetchStatusResult {
  ok: boolean;
  data?: PhoneNumberStatus;
  error?: string;
}

export async function fetchPhoneNumberStatus(
  phoneNumberId: string,
  accessToken: string
): Promise<FetchStatusResult> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}`);
  url.searchParams.set(
    "fields",
    "display_phone_number,verified_name,quality_rating,messaging_limit_tier"
  );
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const json = await res.json();

  if (json.error) {
    return { ok: false, error: json.error.message as string };
  }

  return { ok: true, data: json as PhoneNumberStatus };
}

export interface OwnerBusinessInfo {
  id: string;
  name: string;
}

export async function fetchOwnerBusinessInfo(
  wabaId: string,
  accessToken: string
): Promise<OwnerBusinessInfo | null> {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}`);
  url.searchParams.set("fields", "owner_business_info");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const json = await res.json();

  if (json.error || !json.owner_business_info) return null;
  return json.owner_business_info as OwnerBusinessInfo;
}

export interface ApiConnectionRecord {
  id: string;
  label: string;
  phone_number_id: string;
  waba_id: string | null;
  access_token: string;
}

export async function buildConnectionStatus(conn: ApiConnectionRecord) {
  const [result, business] = await Promise.all([
    fetchPhoneNumberStatus(conn.phone_number_id, conn.access_token),
    conn.waba_id ? fetchOwnerBusinessInfo(conn.waba_id, conn.access_token) : Promise.resolve(null),
  ]);

  return {
    id: conn.id,
    label: conn.label,
    phone_number_id: conn.phone_number_id,
    waba_id: conn.waba_id,
    display_phone_number: result.data?.display_phone_number ?? null,
    verified_name: result.data?.verified_name ?? null,
    quality_rating: result.ok ? result.data?.quality_rating ?? "UNKNOWN" : null,
    business_name: business?.name ?? null,
    error: result.ok ? null : result.error,
  };
}
