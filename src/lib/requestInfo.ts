import type { NextRequest } from "next/server";

export interface RequestInfo {
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  userAgent: string | null;
}

// Ciudad, región y país vienen de los headers de geolocalización que
// Vercel agrega automáticamente a cada petición (no requiere ningún
// servicio externo). En local (fuera de Vercel) esos headers no existen.
export function requestInfo(request: NextRequest): RequestInfo {
  const city = request.headers.get("x-vercel-ip-city");
  const region = request.headers.get("x-vercel-ip-country-region");
  const country = request.headers.get("x-vercel-ip-country");
  return {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    city: city ? decodeURIComponent(city) : null,
    region: region ? decodeURIComponent(region) : null,
    country: country ?? null,
    userAgent: request.headers.get("user-agent"),
  };
}
