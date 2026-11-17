const GRAPH_API_VERSION = "v21.0";

export type QualityRating = "GREEN" | "YELLOW" | "RED" | "UNKNOWN";

export interface PhoneNumberStatus {
  id: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: QualityRating;
  messaging_limit_tier?: string;
  // Límite de conversaciones iniciadas por la empresa en 24 h. Desde 2025 Meta
  // lo da a nivel de portafolio en este campo; el de arriba casi siempre viene vacío.
  whatsapp_business_manager_messaging_limit?: string;
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
  const base = "display_phone_number,verified_name,quality_rating,messaging_limit_tier";
  const get = async (fields: string) => {
    const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("access_token", accessToken);
    return (await fetch(url.toString())).json();
  };

  // Si el token no puede leer el límite nuevo, se repite la consulta sin él.
  let json = await get(`${base},whatsapp_business_manager_messaging_limit`);
  if (json.error) json = await get(base);

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
    messaging_limit:
      result.data?.whatsapp_business_manager_messaging_limit ?? result.data?.messaging_limit_tier ?? null,
    business_name: business?.name ?? null,
    error: result.ok ? null : result.error,
  };
}
