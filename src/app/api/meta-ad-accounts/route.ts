import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireWriteAccess } from "@/lib/auth";

// El access_token nunca se expone al cliente: solo se usa server-side
// para consultar la API de Meta.
export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("meta_ad_accounts")
    .select("id, name, account_id")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const auth = await requireWriteAccess();
  if ("error" in auth) return auth.error;

  const supabase = supabaseServer();
  const body = await request.json();

  const name = String(body.name ?? "").trim();
  let accountId = String(body.account_id ?? "").trim();
  const accessToken = String(body.access_token ?? "").trim();

  if (!name || !accountId || !accessToken) {
    return NextResponse.json({ error: "Nombre, Account ID y Token son obligatorios" }, { status: 400 });
  }

  if (!accountId.startsWith("act_")) {
    accountId = `act_${accountId}`;
  }

  const { data, error } = await supabase
    .from("meta_ad_accounts")
    .insert({ name, account_id: accountId, access_token: accessToken })
    .select("id, name, account_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
