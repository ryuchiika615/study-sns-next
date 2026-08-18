import { createServerSupabase } from "@/lib/supabase-server";
import { getProStatus, type ProGrant } from "@/lib/pro";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabase.from("pro_grants").select("id, source, starts_at, expires_at, revoked_at").eq("user_id", user.id);
  return NextResponse.json(getProStatus((data || []) as ProGrant[]));
}
