import { NextResponse } from "next/server";
import { fetchRecentTags } from "@/lib/ghl";

export async function GET() {
  try {
    const tags = await fetchRecentTags();
    return NextResponse.json({ data: tags });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error consultando etiquetas de GoHighLevel" },
      { status: 500 }
    );
  }
}
