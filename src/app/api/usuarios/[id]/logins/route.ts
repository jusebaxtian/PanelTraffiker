import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { requireSuperAdmin } from "@/lib/auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("user_login_history")
    .select("*")
    .eq("user_id", id)
    .order("logged_in_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
