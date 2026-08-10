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
