import { NextResponse } from "next/server";
import { fetchAllAccountsBilling } from "@/lib/metaAds";

export async function GET() {
  try {
    const data = await fetchAllAccountsBilling();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
