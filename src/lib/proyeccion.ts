export interface ProyeccionConfig {
  id: string;
  month_label: string;
  total_days: number;
  days_remaining: number;
  costo_ftd_mes: number;
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
  gastado: number;
  ftd_real: number;
  campaigns: CampaignRef[];
  distribucion_office_id: string | null;
  ghl_tag: string | null;
  position: number;
}

export interface ProyeccionOfficeComputed extends ProyeccionOffice {
  diario: number;
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
  ftd_meta_mes: number;
}

export function computeOffice(
  office: ProyeccionOffice,
  diario: number,
  gastoDelMes: number,
  leadsDelMes: number,
  diasFaltantes: number,
  costoFtdMes: number
): ProyeccionOfficeComputed {
  const gasto = gastoDelMes;
  const gasto_total_hoy = gasto + office.gastado;
  const proyeccion_cierre = diario * diasFaltantes;
  // Gasto Proyección = lo ya gastado + lo que falta por gastar en el
  // resto del mes (no es lo mismo que Proyección Cierre en solitario).
  const gasto_proyeccion = gasto_total_hoy + proyeccion_cierre;
  const leads_crm = leadsDelMes;
  const costo_x_resultado = leads_crm > 0 ? gasto_total_hoy / leads_crm : 0;
  const total_mes = gasto_proyeccion;
  const ftd_estimado = costoFtdMes > 0 ? gasto_total_hoy / costoFtdMes : 0;
  const ftd_meta_mes = costoFtdMes > 0 ? total_mes / costoFtdMes : 0;
  const costo_ftd_actual = office.ftd_real > 0 ? gasto_total_hoy / office.ftd_real : 0;
  const ftd_balance = office.ftd_real - ftd_estimado;

  return {
    ...office,
    diario,
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
    ftd_meta_mes,
  };
}
