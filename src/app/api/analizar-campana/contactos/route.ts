import { NextRequest, NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/auth";
import { fetchCampaignContacts, fetchDemoContact } from "@/lib/campanaContactos";
import { bogotaRangeBetween } from "@/lib/bogota";

// Contactos de GHL que llegaron por los anuncios de una campaña. Solo lectura.
export async function GET(request: NextRequest) {
  const auth = await requireModuleAccess("analizar-campana");
  if ("error" in auth) return auth.error;

  const p = request.nextUrl.searchParams;
  const campaignId = p.get("campaign_id") ?? "";
  const since = p.get("since") ?? "";
  const until = p.get("until") ?? "";
  const adIds = (p.get("ad_ids") ?? "").split(",").filter((x) => /^\d+$/.test(x));
  const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!/^\d+$/.test(campaignId) || !isDate(since) || !isDate(until) || !adIds.length || adIds.length > 500) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  try {
    const { start, end } = bogotaRangeBetween(since, until);
    const data = await fetchCampaignContacts({ campaignId, adIds, start, end });
    // Modo prueba: solo SuperAdmin y solo en la respuesta, nada se guarda.
    const demoAd = p.get("demo_ad") ?? "";
    if (auth.user.role === "superadmin" && adIds.includes(demoAd)) {
      const demo = await fetchDemoContact(demoAd).catch(() => null);
      if (demo && !data.contacts.some((c) => c.id === demo.id)) {
        data.contacts.unshift(demo);
        if (!data.crms.includes(demo.crm_name)) data.crms.push(demo.crm_name);
      }
    }
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
