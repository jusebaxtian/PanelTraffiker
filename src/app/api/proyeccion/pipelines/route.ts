import { NextResponse } from "next/server";
import { fetchPipelines } from "@/lib/ghl";

export async function GET() {
  try {
    const data = await fetchPipelines();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
