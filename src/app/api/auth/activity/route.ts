import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ACTIVITY_COOKIE, activityCookieOptions } from "@/lib/inactivity";

// El navegador avisa aquí (como máximo una vez por minuto) que el usuario
// sigue activo. Renueva la cookie con la que el servidor decide si la
// sesión de un Admin se venció por inactividad. Si ya estaba vencida,
// getCurrentUser devuelve null y NO se renueva: no se puede "revivir".
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTIVITY_COOKIE, String(Date.now()), activityCookieOptions);
  return response;
}
