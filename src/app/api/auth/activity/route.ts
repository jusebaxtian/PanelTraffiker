import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabaseServer";
import { requestInfo } from "@/lib/requestInfo";
import { ACTIVITY_COOKIE, activityCookieOptions } from "@/lib/inactivity";

// El navegador avisa aquí (como máximo una vez por minuto) que el usuario
// sigue activo. Hace dos cosas:
//  - Renueva la cookie con la que el servidor decide si la sesión de un
//    Admin se venció por inactividad. Si ya estaba vencida, getCurrentUser
//    devuelve null y NO se renueva: no se puede "revivir".
//  - Guarda la última actividad (hora, ciudad, IP y dispositivo) que se ve
//    en el Historial de actividad de Usuarios.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const info = requestInfo(request);
  await supabaseServer()
    .from("user_profiles")
    .update({
      last_seen_at: new Date().toISOString(),
      last_seen_ip: info.ip,
      last_seen_city: info.city,
      last_seen_region: info.region,
      last_seen_country: info.country,
      last_seen_ua: info.userAgent,
    })
    .eq("id", user.id);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTIVITY_COOKIE, String(Date.now()), activityCookieOptions);
  return response;
}
