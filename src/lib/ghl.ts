const GHL_API_VERSION = "2021-07-28";
const GHL_BASE_URL = "https://services.leadconnectorhq.com";

function getAccessToken(): string {
  const token = process.env.GHL_ACCESS_TOKEN;
  if (!token) throw new Error("GHL_ACCESS_TOKEN no está configurado");
  return token;
}

function getLocationId(): string {
  const id = process.env.GHL_LOCATION_ID;
  if (!id) throw new Error("GHL_LOCATION_ID no está configurado");
  return id;
}

function ghlHeaders() {
  return {
    Authorization: `Bearer ${getAccessToken()}`,
    Version: GHL_API_VERSION,
  };
}

export interface Pipeline {
  id: string;
  name: string;
}

export async function fetchPipelines(): Promise<Pipeline[]> {
  const url = `${GHL_BASE_URL}/opportunities/pipelines?locationId=${getLocationId()}`;
  const res = await fetch(url, { headers: ghlHeaders() });
  const json = await res.json();

  if (json.error || json.statusCode >= 400) {
    throw new Error(json.message ?? "Error consultando pipelines de GoHighLevel");
  }

  return (json.pipelines ?? []).map((p: { id: string; name: string }) => ({
    id: p.id,
    name: p.name,
  }));
}

// Las opportunities vienen ordenadas por createdAt descendente, así que
// paginamos desde la más reciente y cortamos apenas encontramos una anterior
// al inicio del mes — evita recorrer pipelines con miles de registros.
export async function countOpportunitiesInMonth(
  pipelineId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<number> {
  let count = 0;
  let startAfter: number | null = null;
  let startAfterId: string | null = null;
  const limit = 100;

  for (let page = 0; page < 200; page++) {
    const url = new URL(`${GHL_BASE_URL}/opportunities/search`);
    url.searchParams.set("location_id", getLocationId());
    url.searchParams.set("pipeline_id", pipelineId);
    url.searchParams.set("limit", String(limit));
    if (startAfter && startAfterId) {
      url.searchParams.set("startAfter", String(startAfter));
      url.searchParams.set("startAfterId", startAfterId);
    }

    const res = await fetch(url.toString(), { headers: ghlHeaders() });
    const json = await res.json();

    if (json.error || json.statusCode >= 400) {
      throw new Error(json.message ?? "Error consultando leads de GoHighLevel");
    }

    const opportunities: Array<{ id: string; createdAt: string }> = json.opportunities ?? [];
    if (opportunities.length === 0) break;

    let hitOlderThanMonth = false;
    for (const opp of opportunities) {
      const created = new Date(opp.createdAt);
      if (created >= monthStart && created <= monthEnd) {
        count++;
      } else if (created < monthStart) {
        hitOlderThanMonth = true;
        break;
      }
    }

    if (hitOlderThanMonth) break;
    if (!json.meta?.nextPage) break;

    startAfter = json.meta.startAfter;
    startAfterId = json.meta.startAfterId;
  }

  return count;
}
