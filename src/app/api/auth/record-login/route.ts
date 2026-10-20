import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseServerAuth } from "@/lib/supabaseServerAuth";
import { getCurrentUser } from "@/lib/auth";
import { MAX_LOGINS_PER_USER } from "@/lib/loginHistory";
import {
  ACTIVITY_COOKIE,
  LOGIN_EVENTS,
  RESUME_LOG_THROTTLE_MS,
  activityCookieOptions,
  type LoginEvent,
} from "@/lib/inactivity";

// La ciudad/país vienen de los headers de geolocalización que Vercel
// agrega automáticamente a cada petición (no requiere ningún servicio
// externo). En local (fuera de Vercel) esos headers no existen.
export async function POST(request: NextRequest) {
  // Tipo de registro: inicio de sesión (por defecto), vuelta a la app con
  // la sesión ya abierta, o cierre automático por inactividad.
  let event: LoginEvent = "login";
  try {
    const body = await request.json();
    if (LOGIN_EVENTS.includes(body?.event)) event = body.event;
  } catch {
    // sin cuerpo: se asume inicio de sesión
  }

  // El aviso de cierre por inactividad llega justo cuando la sesión del
  // Admin ya está vencida para el servidor: ese caso solo exige que la
  // sesión de acceso exista (no que esté activa).
  let userId: string | null = null;
  if (event === "timeout") {
    const {
      data: { user: authUser },
    } = await (await supabaseServerAuth()).auth.getUser();
    userId = authUser?.id ?? null;
  } else {
    userId = (await getCurrentUser())?.id ?? null;
  }
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const user = { id: userId };

  const supabase = supabaseServer();

  // "Volvió a la app" se registra solo si el último registro del usuario
  // tiene más de 30 minutos: así recargar varias veces seguidas no llena el
  // historial (que solo guarda los últimos ingresos).
  if (event === "resume") {
    const { data: last } = await supabase
      .from("user_login_history")
      .select("logged_in_at")
      .eq("user_id", user.id)
      .order("logged_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && Date.now() - new Date(last.logged_in_at).getTime() < RESUME_LOG_THROTTLE_MS) {
      return NextResponse.json({ ok: true, skipped: true });
    }
  }

  const city = request.headers.get("x-vercel-ip-city");
  const region = request.headers.get("x-vercel-ip-country-region");
  const country = request.headers.get("x-vercel-ip-country");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  await supabase.from("user_login_history").insert({
    user_id: user.id,
    event,
    ip_address: ip,
    city: city ? decodeURIComponent(city) : null,
    region: region ? decodeURIComponent(region) : null,
    country: country ?? null,
    user_agent: request.headers.get("user-agent"),
  });

  // Solo se conservan los últimos MAX_LOGINS_PER_USER ingresos por
  // usuario: lo que pase de ahí se borra.
  const { data: extra } = await supabase
    .from("user_login_history")
    .select("id")
    .eq("user_id", user.id)
    .order("logged_in_at", { ascending: false })
    .range(MAX_LOGINS_PER_USER, MAX_LOGINS_PER_USER + 999);
  if (extra && extra.length > 0) {
    await supabase
      .from("user_login_history")
      .delete()
      .in(
        "id",
        extra.map((r: { id: string }) => r.id)
      );
  }

  const response = NextResponse.json({ ok: true });
  if (event !== "timeout") response.cookies.set(ACTIVITY_COOKIE, String(Date.now()), activityCookieOptions);
  return response;
}
