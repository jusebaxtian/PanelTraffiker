// Colombia no tiene horario de verano: su hora legal es siempre UTC-5.
// Estos helpers permiten calcular "hoy"/"ahora" en hora de Bogotá sin
// depender de la zona horaria de quien ejecuta el código (el servidor
// corre en UTC, y un usuario podría abrir el panel desde otro país).
export const BOGOTA_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

// Server-side: Date cuyos getters UTC (getUTCFullYear, getUTCMonth,
// getUTCDate, ...) devuelven los valores de la hora civil de Bogotá.
// Bogotá va 5 horas DETRÁS de UTC, así que hay que restar el offset.
export function bogotaNowServer(): Date {
  return new Date(Date.now() - BOGOTA_UTC_OFFSET_MS);
}

export function bogotaMonthKey(date: Date = bogotaNowServer()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function bogotaDateString(date: Date = bogotaNowServer()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function bogotaYesterdayDateString(): string {
  const yesterday = new Date(bogotaNowServer());
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return bogotaDateString(yesterday);
}

// Rango [start, end) del día indicado (YYYY-MM-DD) en hora legal de
// Colombia, expresado como instantes UTC absolutos.
export function bogotaDayRange(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + BOGOTA_UTC_OFFSET_MS);
  const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0) + BOGOTA_UTC_OFFSET_MS);
  return { start, end, since: dateStr, until: dateStr };
}

// Rango [start, end) entre dos fechas YYYY-MM-DD (inclusive), en hora
// legal de Colombia, como instantes UTC absolutos.
export function bogotaRangeBetween(sinceStr: string, untilStr: string) {
  return { start: bogotaDayRange(sinceStr).start, end: bogotaDayRange(untilStr).end, since: sinceStr, until: untilStr };
}

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return bogotaDateString(new Date(d.getTime()));
}

// Traduce los mismos date_preset del Dashboard (today/yesterday/last_7d/
// this_month/last_month) a un rango [since, until] en hora de Colombia,
// para poder consultar el CRM con el mismo período que se ve en pantalla
// (Meta interpreta el preset por su cuenta; esto es solo para GHL).
export function bogotaPresetToRange(preset: string): { since: string; until: string } {
  const today = bogotaDateString();
  switch (preset) {
    case "today":
      return { since: today, until: today };
    case "yesterday": {
      const y = bogotaYesterdayDateString();
      return { since: y, until: y };
    }
    case "last_7d":
      return { since: addDays(today, -7), until: addDays(today, -1) };
    case "this_month": {
      const [year, month] = bogotaMonthKey().split("-");
      return { since: `${year}-${month}-01`, until: today };
    }
    case "last_month": {
      const [y, m] = bogotaMonthKey().split("-").map(Number);
      const lastMonthDate = new Date(Date.UTC(y, m - 2, 1));
      const lastMonthKey = `${lastMonthDate.getUTCFullYear()}-${String(lastMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;
      const lastDay = new Date(Date.UTC(lastMonthDate.getUTCFullYear(), lastMonthDate.getUTCMonth() + 1, 0)).getUTCDate();
      return { since: `${lastMonthKey}-01`, until: `${lastMonthKey}-${String(lastDay).padStart(2, "0")}` };
    }
    default:
      return { since: addDays(today, -30), until: today };
  }
}

// Client-side: Date cuyos getters LOCALES (getFullYear, getMonth,
// getDate, ...) devuelven los valores de la hora civil de Bogotá, sin
// importar la zona horaria del dispositivo del usuario.
export function bogotaNowClient(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");

  return new Date(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
}
