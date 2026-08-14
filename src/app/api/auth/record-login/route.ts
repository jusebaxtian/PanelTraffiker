import { NextRequest, NextResponse } from "next/server";
import { supabaseServerAuth } from "@/lib/supabaseServerAuth";
import { supabaseServer } from "@/lib/supabaseServer";

// La ciudad/país vienen de los headers de geolocalización que Vercel
// agrega automáticamente a cada petición (no requiere ningún servicio
// externo). En local (fuera de Vercel) esos headers no existen.
export async function POST(request: NextRequest) {
  const supabaseAuth = await supabaseServerAuth();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const city = request.headers.get("x-vercel-ip-city");
  const region = request.headers.get("x-vercel-ip-country-region");
  const country = request.headers.get("x-vercel-ip-country");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const supabase = supabaseServer();
  await supabase.from("user_login_history").insert({
    user_id: user.id,
    ip_address: ip,
    city: city ? decodeURIComponent(city) : null,
    region: region ? decodeURIComponent(region) : null,
    country: country ?? null,
    user_agent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
