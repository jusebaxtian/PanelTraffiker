// Trazabilidad de contactos: qué contacto de GHL llegó por qué anuncio de Meta.
// GHL guarda en cada contacto el anuncio que lo trajo (attributionSource.adId)
// y el enlace de la publicación (fb.me = Facebook, instagram.com = Instagram).
// Solo lectura. Los tokens de GHL nunca salen de aquí.
import { supabaseServer } from "@/lib/supabaseServer";
import type { ContactoCampana, Red } from "@/lib/campanaContactosTypes";

const GHL_BASE_URL = "https://services.leadconnectorhq.com";
const MAX_PAGES = 80; // 8.000 contactos por subcuenta como tope

interface Connection {
  id: string;
  name: string;
  location_id: string;
  access_token: string;
}

interface Attribution {
  adId?: string;
  url?: string;
  medium?: string;
  sessionSource?: string;
}

interface GhlContact {
  id: string;
  contactName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateAdded: string;
  dateUpdated?: string;
  assignedTo?: string;
  customFields?: { id: string; value?: unknown }[];
  attributionSource?: Attribution;
  lastAttributionSource?: Attribution;
  searchAfter: [number, string];
}

function headers(token: string, version: string) {
  return { Authorization: `Bearer ${token}`, Version: version, "Content-Type": "application/json", Accept: "application/json" };
}

async function ghlFetch(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url, { ...init, cache: "no-store" });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      continue;
    }
    const json = await res.json();
    if (!res.ok) throw new Error((json as { message?: string }).message ?? `GoHighLevel respondió ${res.status}`);
    return json;
  }
  throw new Error("GoHighLevel no respondió");
}

function redDe(a: Attribution | undefined): Red {
  const u = (a?.url ?? "").toLowerCase();
  if (u.includes("instagram.com")) return "Instagram";
  if (u.includes("fb.me") || u.includes("facebook.com")) return "Facebook";
  const m = (a?.medium ?? "").toLowerCase();
  if (m === "instagram") return "Instagram";
  if (m === "facebook") return "Facebook";
  return "Sin dato";
}

// Conexiones a revisar: la vinculada a la campaña (si existe) o todas.
async function connectionsFor(campaignId: string): Promise<Connection[]> {
  const supabase = supabaseServer();
  const [{ data: links }, { data: conns }] = await Promise.all([
    supabase.from("dashboard_campaign_crm_links").select("crm_connection_id").eq("campaign_id", campaignId),
    supabase.from("proyeccion_crm_connections").select("id, name, location_id, access_token"),
  ]);
  const all = (conns ?? []) as Connection[];
  const linked = (links ?? []).map((l: { crm_connection_id: string | null }) => l.crm_connection_id).filter(Boolean);
  const pick = all.filter((c) => linked.includes(c.id));
  return pick.length ? pick : all;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Campo "ID Plataforma" (FTD), un posible campo de fecha del FTD y los asesores.
async function locationMeta(conn: Connection) {
  const [fields, users] = await Promise.all([
    ghlFetch(`${GHL_BASE_URL}/locations/${conn.location_id}/customFields`, { headers: headers(conn.access_token, "2021-07-28") }).catch(() => ({})),
    ghlFetch(`${GHL_BASE_URL}/users/?locationId=${conn.location_id}`, { headers: headers(conn.access_token, "2021-07-28") }).catch(() => ({})),
  ]);
  const list = ((fields as { customFields?: { id: string; name?: string; dataType?: string }[] }).customFields ?? []);
  const ftd = list.find((f) => norm(f.name ?? "").includes("idplataforma"));
  const ftdDate = list.find((f) => {
    const n = norm(f.name ?? "");
    return f.dataType === "DATE" && (n.includes("fechaftd") || n.includes("ftdfecha") || n.includes("fechaidplataforma"));
  });
  const names = new Map<string, string>();
  for (const u of ((users as { users?: { id: string; name?: string; firstName?: string; lastName?: string }[] }).users ?? [])) {
    names.set(u.id, u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.id);
  }
  return { ftdId: ftd?.id ?? null, ftdDateId: ftdDate?.id ?? null, users: names };
}

function fieldValue(c: GhlContact, id: string | null): string | null {
  if (!id) return null;
  const v = c.customFields?.find((f) => f.id === id)?.value;
  const s = v === undefined || v === null ? "" : String(v).trim();
  return s || null;
}

function toIso(v: string | null): string | null {
  if (!v) return null;
  const d = /^\d+$/.test(v) ? new Date(Number(v)) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function contactsOf(conn: Connection, adIds: Set<string>, start: Date, end: Date) {
  const out: ContactoCampana[] = [];
  const meta = await locationMeta(conn);
  let searchAfter: [number, string] | null = null;
  let truncated = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const body: Record<string, unknown> = {
      locationId: conn.location_id,
      pageLimit: 100,
      sort: [{ field: "dateAdded", direction: "desc" }],
    };
    if (searchAfter) body.searchAfter = searchAfter;
    const json = await ghlFetch(`${GHL_BASE_URL}/contacts/search`, {
      method: "POST",
      headers: headers(conn.access_token, "2021-07-28"),
      body: JSON.stringify(body),
    });
    const contacts = (json.contacts ?? []) as GhlContact[];
    if (!contacts.length) break;
    let older = false;
    for (const c of contacts) {
      const created = new Date(c.dateAdded);
      if (created >= end) continue;
      if (created < start) {
        older = true;
        break;
      }
      const first = c.attributionSource;
      const last = c.lastAttributionSource;
      const hit = first?.adId && adIds.has(first.adId) ? first : last?.adId && adIds.has(last.adId) ? last : null;
      if (!hit?.adId) continue;
      const name = c.contactName || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || "Sin nombre";
      const ftd = fieldValue(c, meta.ftdId);
      const exactDate = ftd ? toIso(fieldValue(c, meta.ftdDateId)) : null;
      out.push({
        id: c.id,
        crm_id: conn.id,
        crm_name: conn.name,
        location_id: conn.location_id,
        name,
        phone: c.phone ?? null,
        date: c.dateAdded,
        ad_id: hit.adId,
        red: redDe(hit),
        asesor: c.assignedTo ? meta.users.get(c.assignedTo) ?? (meta.users.size ? "Asesor sin nombre" : "Asignado (sin permiso para ver el nombre)") : null,
        ftd,
        ftd_date: ftd ? exactDate ?? c.dateUpdated ?? null : null,
        ftd_date_exact: !!exactDate,
      });
    }
    if (older || contacts.length < 100) break;
    searchAfter = contacts[contacts.length - 1].searchAfter;
    if (page === MAX_PAGES - 1) truncated = true;
  }
  return { contacts: out, truncated, hasFtd: !!meta.ftdId };
}

// Modo prueba (?demo=1, solo SuperAdmin): muestra el contacto "jp" de
// JuanFDianaC, que tiene ID Plataforma lleno, como si hubiera llegado por el
// anuncio indicado. Solo se agrega a la respuesta: no se toca nada en GHL.
const DEMO_CRM = "JuanFDianaC";
const DEMO_CONTACT_ID = "BAHk0qL9pDku917osRG7";

export async function fetchDemoContact(adId: string): Promise<ContactoCampana | null> {
  const supabase = supabaseServer();
  const { data } = await supabase.from("proyeccion_crm_connections").select("id, name, location_id, access_token").eq("name", DEMO_CRM).maybeSingle();
  const conn = data as Connection | null;
  if (!conn) return null;
  const meta = await locationMeta(conn);
  const json = await ghlFetch(`${GHL_BASE_URL}/contacts/${DEMO_CONTACT_ID}`, { headers: headers(conn.access_token, "2021-07-28") });
  const c = json.contact as GhlContact | undefined;
  if (!c) return null;
  const ftd = fieldValue(c, meta.ftdId);
  const exactDate = ftd ? toIso(fieldValue(c, meta.ftdDateId)) : null;
  return {
    id: c.id,
    crm_id: conn.id,
    crm_name: conn.name,
    location_id: conn.location_id,
    name: c.contactName || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone || "Sin nombre",
    phone: c.phone ?? null,
    date: c.dateAdded,
    ad_id: adId,
    red: "Facebook",
    asesor: c.assignedTo ? meta.users.get(c.assignedTo) ?? "Asesor sin nombre" : null,
    ftd,
    ftd_date: ftd ? exactDate ?? c.dateUpdated ?? null : null,
    ftd_date_exact: !!exactDate,
    demo: true,
  };
}

export async function fetchCampaignContacts(opts: { campaignId: string; adIds: string[]; start: Date; end: Date }) {
  const conns = await connectionsFor(opts.campaignId);
  const adIds = new Set(opts.adIds);
  const results = await Promise.all(
    conns.map((c) =>
      contactsOf(c, adIds, opts.start, opts.end).catch((e: unknown) => ({
        contacts: [] as ContactoCampana[],
        truncated: false,
        error: `${c.name}: ${e instanceof Error ? e.message : "error"}`,
      }))
    )
  );
  const contacts = results.flatMap((r) => r.contacts).sort((a, b) => b.date.localeCompare(a.date));
  return {
    contacts,
    truncated: results.some((r) => r.truncated),
    errors: results.map((r) => ("error" in r ? r.error : null)).filter(Boolean) as string[],
    crms: [...new Set(contacts.map((c) => c.crm_name))],
    ftd_field: results.some((r) => "hasFtd" in r && r.hasFtd),
  };
}

// GHL antepone al primer mensaje la ficha del anuncio ("*Headline:* …" y
// "*Source URL:* …"); se quita para dejar solo lo que escribió la persona.
function cleanBody(body: string | undefined): string {
  return (body ?? "")
    .split("\n")
    .filter((l) => !/^\*(Headline|Source URL|Body|Source ID|Source Type):\*/i.test(l.trim()))
    .join("\n")
    .trim();
}

// Primer mensaje que escribió cada contacto (se pide al abrir "Ver más").
export async function fetchFirstMessages(crmId: string, contactIds: string[]): Promise<Record<string, string | null>> {
  const supabase = supabaseServer();
  const { data } = await supabase.from("proyeccion_crm_connections").select("id, name, location_id, access_token").eq("id", crmId).maybeSingle();
  const conn = data as Connection | null;
  if (!conn) throw new Error("Subcuenta no encontrada");
  const out: Record<string, string | null> = {};
  const queue = [...contactIds];
  async function worker() {
    while (queue.length) {
      const id = queue.shift()!;
      try {
        const q = new URLSearchParams({ locationId: conn!.location_id, contactId: id, limit: "1" });
        const cv = await ghlFetch(`${GHL_BASE_URL}/conversations/search?${q}`, { headers: headers(conn!.access_token, "2021-04-15") });
        const conv = ((cv.conversations ?? []) as { id: string }[])[0];
        if (!conv) {
          out[id] = null;
          continue;
        }
        const mj = await ghlFetch(`${GHL_BASE_URL}/conversations/${conv.id}/messages?limit=100`, { headers: headers(conn!.access_token, "2021-04-15") });
        const box = mj.messages as { messages?: unknown[] } | unknown[] | undefined;
        const list = (Array.isArray(box) ? box : box?.messages ?? []) as { direction?: string; body?: string; dateAdded?: string }[];
        const inbound = list
          .filter((m) => m.direction === "inbound")
          .sort((a, b) => (a.dateAdded ?? "").localeCompare(b.dateAdded ?? ""))
          .map((m) => cleanBody(m.body))
          .filter(Boolean);
        out[id] = inbound[0]?.slice(0, 300) ?? null;
      } catch {
        out[id] = null;
      }
    }
  }
  await Promise.all(Array.from({ length: 5 }, worker));
  return out;
}
