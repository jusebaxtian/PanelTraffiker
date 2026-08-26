import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireSuperAdmin } from "@/lib/auth";

// Solo para rellenar el formulario de "vincular cuenta" cuando se reutiliza
// el token de una cuenta del mismo portafolio, evitando pedirlo de nuevo.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("api_connections")
    .select("access_token")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ access_token: data.access_token });
}
