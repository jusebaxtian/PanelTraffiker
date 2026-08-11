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
    "Content-Type": "application/json",
  };
}

// Los contactos vienen ordenados por dateAdded descendente, así que
// paginamos desde el más reciente y cortamos apenas encontramos uno
// anterior al inicio del mes — evita recorrer miles de contactos.
export async function countContactsByTagInMonth(
  tag: string,
  monthStart: Date,
  monthEnd: Date
): Promise<number> {
  let count = 0;
  let searchAfter: [number, string] | null = null;
  const pageLimit = 100;

  for (let page = 0; page < 300; page++) {
    const body: Record<string, unknown> = {
      locationId: getLocationId(),
      pageLimit,
      filters: [{ field: "tags", operator: "contains", value: tag }],
      sort: [{ field: "dateAdded", direction: "desc" }],
    };
    if (searchAfter) body.searchAfter = searchAfter;

    const res = await fetch(`${GHL_BASE_URL}/contacts/search`, {
      method: "POST",
      headers: ghlHeaders(),
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
      if (created >= monthStart && created <= monthEnd) {
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
