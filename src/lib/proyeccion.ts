import { BOGOTA_UTC_OFFSET_MS } from "@/lib/bogota";

export interface ProyeccionConfig {
  id: string;
  month_key: string;
  month_label: string;
  days_remaining: number;
  costo_ftd_mes: number;
  closed: boolean;
  locked: boolean;
  closed_at: string | null;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// El rango debe corresponder al mes seleccionado (month_key = "YYYY-MM"),
// alineado a la hora legal de Colombia (Bogotá, UTC-5 sin horario de
// verano), y no ir más allá de "ahora" para que los datos sean siempre
// los reales hasta el momento (en vivo).
export function monthRange(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) + BOGOTA_UTC_OFFSET_MS);
  const monthEndBoundary = new Date(Date.UTC(year, month, 1, 0, 0, 0) + BOGOTA_UTC_OFFSET_MS);
  const now = new Date();
  const end = monthEndBoundary < now ? monthEndBoundary : now;
  const lastDay = new Date(year, month, 0).getDate();
  const since = `${year}-${pad2(month)}-01`;
  const until = `${year}-${pad2(month)}-${pad2(lastDay)}`;
  return { start, end, since, until };
}

// El nombre del mes se deriva siempre de month_key ("YYYY-MM"), ya no es
// un campo editable manualmente.
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export interface CampaignRef {
  account_id: string;
  campaign_id: string;
  campaign_name: string;
}

export interface ProyeccionOffice {
  id: string;
  asignacion: string;
  ftd_real: number;
  campaigns: CampaignRef[];
  distribucion_office_id: string | null;
  ghl_tag: string | null;
  crm_connection_id: string | null;
  config_id: string;
  position: number;
  // Solo tienen valor una vez que el mes se cierra: congelan el gasto,
  // los leads y el $ diario que hasta ese momento venían en vivo, y
  // quedan editables a mano mientras el cierre está en modo edición.
  gasto_final: number | null;
  leads_final: number | null;
  diario_final: number | null;
  leads_meta_final: number | null;
}

export interface ProyeccionOfficeComputed extends ProyeccionOffice {
  diario: number;
  gasto: number;
  gasto_total_hoy: number;
  proyeccion_cierre: number;
  gasto_proyeccion: number;
  leads_meta: number;
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
  leadsMetaDelMes: number,
  leadsDelMes: number,
  diasFaltantes: number,
  costoFtdMes: number
): ProyeccionOfficeComputed {
  const gasto = gastoDelMes;
  const gasto_total_hoy = gasto;
  const proyeccion_cierre = diario * diasFaltantes;
  // Gasto Proyección = lo ya gastado + lo que falta por gastar en el
  // resto del mes (no es lo mismo que Proyección Cierre en solitario).
  const gasto_proyeccion = gasto_total_hoy + proyeccion_cierre;
  const leads_meta = leadsMetaDelMes;
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
    leads_meta,
    leads_crm,
    costo_x_resultado,
    total_mes,
    ftd_estimado,
    costo_ftd_actual,
    ftd_balance,
    ftd_meta_mes,
  };
}
