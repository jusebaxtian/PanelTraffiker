// Tipos de la pestaña "Contactos" de Analizar Campaña (sirven al cliente).
export type Red = "Facebook" | "Instagram" | "Sin dato";

export interface ContactoCampana {
  id: string;
  crm_id: string;
  crm_name: string;
  location_id: string;
  name: string;
  phone: string | null;
  date: string; // ISO, fecha en que entró a GHL
  ad_id: string;
  red: Red;
  asesor: string | null; // usuario de GHL asignado al contacto
  ftd: string | null; // campo "ID Plataforma" (FTD)
  ftd_date: string | null; // cuándo se llenó el FTD
  ftd_date_exact: boolean; // false = se toma la última edición del contacto (aproximado)
  demo?: boolean; // contacto de prueba agregado solo en la vista (?demo=1), no cambia nada en GHL
}

export interface ContactosResponse {
  contacts: ContactoCampana[];
  truncated: boolean;
  errors: string[];
  crms: string[];
  ftd_field: boolean; // alguna subcuenta tiene el campo ID Plataforma
}

// Días entre que el contacto entró al CRM y se llenó el FTD.
export function ftdDays(c: ContactoCampana): number | null {
  if (!c.ftd || !c.ftd_date) return null;
  const d = (new Date(c.ftd_date).getTime() - new Date(c.date).getTime()) / 86400000;
  return Math.max(0, Math.floor(d));
}

export const ghlContactUrl = (locationId: string, contactId: string) =>
  `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${contactId}`;
