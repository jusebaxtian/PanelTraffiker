import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { getAllAdAccountConnections, META_BASE_URL } from "@/lib/metaAds";

// Devuelve la URL del iframe de vista previa oficial de Meta para un
// anuncio, para poder mostrarlo dentro del panel tal como lo ve la gente.
const FORMATS = ["MOBILE_FEED_STANDARD", "INSTAGRAM_STANDARD", "INSTAGRAM_STORY"] as const;

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const params = request.nextUrl.searchParams;
  const adId = params.get("ad_id") ?? "";
  const accountId = params.get("account_id") ?? "";
  const format = (FORMATS as readonly string[]).includes(params.get("format") ?? "") ? params.get("format")! : "MOBILE_FEED_STANDARD";

  if (!/^\d+$/.test(adId) || !accountId) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  try {
    const accounts = await getAllAdAccountConnections();
    const account = accounts.find((a) => a.accountId === accountId);
    if (!account) return NextResponse.json({ error: "Cuenta publicitaria no encontrada" }, { status: 404 });

    const url = new URL(`${META_BASE_URL}/${adId}/previews`);
    url.searchParams.set("access_token", account.accessToken);
    url.searchParams.set("ad_format", format);
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (json.error) return NextResponse.json({ error: json.error.message }, { status: 502 });

    const body: string = json.data?.[0]?.body ?? "";
    const match = body.match(/src="([^"]+)"/);
    if (!match) return NextResponse.json({ error: "Meta no devolvió vista previa para este anuncio" }, { status: 404 });

    const src = match[1].replace(/&amp;/g, "&");
    const size = {
      width: Number(body.match(/width="(\d+)"/)?.[1] ?? 335),
      height: Number(body.match(/height="(\d+)"/)?.[1] ?? 450),
    };
    return NextResponse.json({ data: { src, ...size, format } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
