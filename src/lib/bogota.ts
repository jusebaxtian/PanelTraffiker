// Colombia no tiene horario de verano: su hora legal es siempre UTC-5.
// Estos helpers permiten calcular "hoy"/"ahora" en hora de Bogotá sin
// depender de la zona horaria de quien ejecuta el código (el servidor
// corre en UTC, y un usuario podría abrir el panel desde otro país).
export const BOGOTA_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

// Server-side: Date cuyos getters UTC (getUTCFullYear, getUTCMonth,
// getUTCDate, ...) devuelven los valores de la hora civil de Bogotá.
export function bogotaNowServer(): Date {
  return new Date(Date.now() + BOGOTA_UTC_OFFSET_MS);
}

export function bogotaMonthKey(date: Date = bogotaNowServer()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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
