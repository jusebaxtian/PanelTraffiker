// Cierre automático de sesión por inactividad. Aplica SOLO al rol Admin: el
// SuperAdmin puede dejar la sesión abierta todo el tiempo que quiera.
//
// Cómo funciona:
//  - El navegador detecta actividad (mouse, teclado, scroll, toque) y la
//    guarda en localStorage (compartida entre pestañas) y, cada minuto,
//    avisa al servidor para renovar la cookie `pt_last_active`.
//  - Si pasan 30 minutos sin actividad, el navegador cierra la sesión solo
//    y sin avisar.
//  - El servidor revisa la misma cookie en cada página y al validar la
//    sesión: si el usuario Admin vuelve después de más de 30 minutos (por
//    ejemplo, tenía la pestaña abierta o la computadora dormida) la sesión
//    ya no es válida.
// 30 minutos por defecto; NEXT_PUBLIC_INACTIVITY_MINUTES solo existe para
// poder probar el cierre sin esperar media hora.
export const INACTIVITY_MS = (Number(process.env.NEXT_PUBLIC_INACTIVITY_MINUTES) || 30) * 60 * 1000;
export const ACTIVITY_COOKIE = "pt_last_active";
export const ACTIVITY_STORAGE_KEY = "pt_last_activity";

// Cada cuánto, como máximo, el navegador renueva la cookie del servidor.
export const ACTIVITY_PING_MS = 60 * 1000;

// Para no llenar el historial: solo se registra "volvió a la app" si el
// último registro del usuario tiene más de este tiempo.
export const RESUME_LOG_THROTTLE_MS = 30 * 60 * 1000;

export type LoginEvent = "login" | "resume" | "timeout";

export const LOGIN_EVENTS: LoginEvent[] = ["login", "resume", "timeout"];

export const LOGIN_EVENT_LABEL: Record<string, string> = {
  login: "Inició sesión",
  resume: "Volvió a la app",
  timeout: "Sesión cerrada por inactividad",
};

export const activityCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

// Momento de la última actividad conocida: lo más reciente entre la cookie
// de actividad y el último inicio de sesión (así un ingreso nuevo nunca se
// considera vencido por una cookie vieja).
export function lastActivityMs(cookieValue: string | undefined | null, lastSignInAt: string | undefined | null): number | null {
  const fromCookie = cookieValue ? Number(cookieValue) : NaN;
  const fromSignIn = lastSignInAt ? Date.parse(lastSignInAt) : NaN;
  const candidates = [fromCookie, fromSignIn].filter((n) => Number.isFinite(n));
  return candidates.length > 0 ? Math.max(...candidates) : null;
}

export function isSessionExpired(
  role: "superadmin" | "admin",
  cookieValue: string | undefined | null,
  lastSignInAt: string | undefined | null,
  now: number = Date.now()
): boolean {
  if (role === "superadmin") return false;
  const last = lastActivityMs(cookieValue, lastSignInAt);
  if (last === null) return false;
  return now - last > INACTIVITY_MS;
}
