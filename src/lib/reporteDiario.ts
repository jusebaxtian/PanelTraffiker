import type { CampaignRef } from "@/lib/proyeccion";

export type { CampaignRef };

export interface ReporteDiarioOffice {
  id: string;
  asignacion: string;
  campaigns: CampaignRef[];
  distribucion_office_id: string | null;
  ghl_tag: string | null;
  crm_connection_id: string | null;
  position: number;
}

export interface ReporteDiarioOfficeComputed extends ReporteDiarioOffice {
  diario: number;
  gasto: number;
  leads_meta: number;
  leads_crm: number;
  costo_x_resultado: number;
}

export function computeReporteDiarioOffice(
  office: ReporteDiarioOffice,
  diario: number,
  gasto: number,
  leadsMeta: number,
  leadsCrm: number
): ReporteDiarioOfficeComputed {
  const costo_x_resultado = leadsCrm > 0 ? gasto / leadsCrm : 0;
  return { ...office, diario, gasto, leads_meta: leadsMeta, leads_crm: leadsCrm, costo_x_resultado };
}
