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
}

export interface ContactosResponse {
  contacts: ContactoCampana[];
  truncated: boolean;
  errors: string[];
  crms: string[];
}

export const ghlContactUrl = (locationId: string, contactId: string) =>
  `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${contactId}`;
