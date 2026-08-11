import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { fetchRecentTags } from "@/lib/ghl";

export async function GET(request: NextRequest) {
  const connectionId = request.nextUrl.searchParams.get("connection_id");
  if (!connectionId) {
    return NextResponse.json({ error: "connection_id es requerido" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data: connection, error: connectionError } = await supabase
    .from("proyeccion_crm_connections")
    .select("location_id, access_token")
    .eq("id", connectionId)
    .maybeSingle();

  if (connectionError) {
    return NextResponse.json({ error: connectionError.message }, { status: 500 });
  }
  if (!connection) {
    return NextResponse.json({ error: "Conexión de CRM no encontrada" }, { status: 404 });
  }

  try {
    const tags = await fetchRecentTags({ locationId: connection.location_id, accessToken: connection.access_token });
    return NextResponse.json({ data: tags });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error consultando etiquetas de GoHighLevel" },
      { status: 500 }
    );
  }
}
