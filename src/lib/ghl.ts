const GHL_API_VERSION = "2021-07-28";
const GHL_BASE_URL = "https://services.leadconnectorhq.com";

export interface GhlCredentials {
  locationId: string;
  accessToken: string;
}

function ghlHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Version: GHL_API_VERSION,
    "Content-Type": "application/json",
  };
}

// Los contactos vienen ordenados por dateAdded descendente, así que
// paginamos desde el más reciente y cortamos apenas encontramos uno
// anterior al inicio del mes — evita recorrer miles de contactos.
export async function countContactsByTagInMonth(
  creds: GhlCredentials,
  tag: string,
  monthStart: Date,
  monthEnd: Date
): Promise<number> {
  let count = 0;
  let searchAfter: [number, string] | null = null;
  const pageLimit = 100;

  for (let page = 0; page < 300; page++) {
    const body: Record<string, unknown> = {
      locationId: creds.locationId,
      pageLimit,
      filters: [{ field: "tags", operator: "contains", value: tag }],
      sort: [{ field: "dateAdded", direction: "desc" }],
    };
    if (searchAfter) body.searchAfter = searchAfter;

    const res = await fetch(`${GHL_BASE_URL}/contacts/search`, {
      method: "POST",
      headers: ghlHeaders(creds.accessToken),
      body: JSON.stringify(body),
    });
    const json = await res.json();

    if (json.error || json.statusCode >= 400) {
      throw new Error(json.message ?? "Error consultando leads de GoHighLevel");
    }

    const contacts: Array<{ dateAdded: string; searchAfter: [number, string] }> = json.contacts ?? [];
    if (contacts.length === 0) break;

    let hitOlderThanMonth = false;
    for (const c of contacts) {
      const created = new Date(c.dateAdded);
      if (created >= monthStart && created < monthEnd) {
        count++;
      } else if (created < monthStart) {
        hitOlderThanMonth = true;
        break;
      }
    }

    if (hitOlderThanMonth) break;
    if (contacts.length < pageLimit) break;

    searchAfter = contacts[contacts.length - 1].searchAfter;
  }

  return count;
}

// La cuenta no tiene scope para /locations/{id}/tags, así que se arma la
// lista de etiquetas disponibles muestreando los contactos más recientes.
export async function fetchRecentTags(creds: GhlCredentials, sampleSize = 500): Promise<string[]> {
  const tags = new Set<string>();
  let searchAfter: [number, string] | null = null;
  const pageLimit = 100;
  let fetched = 0;

  for (let page = 0; page < 20 && fetched < sampleSize; page++) {
    const body: Record<string, unknown> = {
      locationId: creds.locationId,
      pageLimit,
      sort: [{ field: "dateAdded", direction: "desc" }],
    };
    if (searchAfter) body.searchAfter = searchAfter;

    const res = await fetch(`${GHL_BASE_URL}/contacts/search`, {
      method: "POST",
      headers: ghlHeaders(creds.accessToken),
      body: JSON.stringify(body),
    });
    const json = await res.json();

    if (json.error || json.statusCode >= 400) {
      throw new Error(json.message ?? "Error consultando etiquetas de GoHighLevel");
    }

    const contacts: Array<{ tags?: string[]; searchAfter: [number, string] }> = json.contacts ?? [];
    if (contacts.length === 0) break;

    for (const c of contacts) {
      (c.tags ?? []).forEach((t) => tags.add(t));
    }
    fetched += contacts.length;

    if (contacts.length < pageLimit) break;
    searchAfter = contacts[contacts.length - 1].searchAfter;
  }

  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}
