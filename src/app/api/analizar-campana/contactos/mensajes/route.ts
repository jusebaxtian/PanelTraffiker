import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/auth";
import { fetchFirstMessages } from "@/lib/campanaContactos";

// Primer mensaje que escribió cada contacto. Solo lectura.
export async function GET(request: NextRequest) {
  const auth = await requireModuleAccess("analizar-campana");
  if ("error" in auth) return auth.error;

  const p = request.nextUrl.searchParams;
  const crmId = p.get("crm_id") ?? "";
  const ids = (p.get("ids") ?? "").split(",").filter((x) => /^[A-Za-z0-9]+$/.test(x));
  if (!/^[\w-]+$/.test(crmId) || !ids.length || ids.length > 50) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }
  try {
    const data = await fetchFirstMessages(crmId, ids);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
