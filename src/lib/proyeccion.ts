export interface ProyeccionConfig {
  id: string;
  month_label: string;
  total_days: number;
  days_remaining: number;
  holidays_note: string | null;
}

export interface CampaignRef {
  account_id: string;
  campaign_id: string;
  campaign_name: string;
}

export interface ProyeccionOffice {
  id: string;
  admin: string;
  asignacion: string;
  diario: number;
  gastado: number;
  costo_ftd_objetivo: number;
  ftd_real: number;
  ftd_meta_mes: number;
  campaigns: CampaignRef[];
  ghl_pipeline_id: string | null;
  ghl_pipeline_name: string | null;
  position: number;
}

export interface ProyeccionOfficeComputed extends ProyeccionOffice {
  gasto: number;
  gasto_total_hoy: number;
  proyeccion_cierre: number;
  gasto_proyeccion: number;
  leads_crm: number;
  costo_x_resultado: number;
  total_mes: number;
  ftd_estimado: number;
  costo_ftd_actual: number;
  ftd_balance: number;
}

export function computeOffice(
  office: ProyeccionOffice,
  gastoDelMes: number,
  leadsDelMes: number,
  diasFaltantes: number
): ProyeccionOfficeComputed {
  const gasto = gastoDelMes;
  const gasto_total_hoy = gasto + office.gastado;
  const proyeccion_cierre = office.diario * diasFaltantes;
  const gasto_proyeccion = proyeccion_cierre;
  const leads_crm = leadsDelMes;
  const costo_x_resultado = leads_crm > 0 ? gasto_total_hoy / leads_crm : 0;
  const total_mes = gasto_total_hoy + gasto_proyeccion;
  const ftd_estimado = office.costo_ftd_objetivo > 0 ? total_mes / office.costo_ftd_objetivo : 0;
  const costo_ftd_actual = office.ftd_real > 0 ? gasto_total_hoy / office.ftd_real : 0;
  const ftd_balance = office.ftd_real - ftd_estimado;

  return {
    ...office,
    gasto,
    gasto_total_hoy,
    proyeccion_cierre,
    gasto_proyeccion,
    leads_crm,
    costo_x_resultado,
    total_mes,
    ftd_estimado,
    costo_ftd_actual,
    ftd_balance,
  };
}
