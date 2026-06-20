import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: p } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!p?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { count } = await supabase.rpc("cleanup_old_notifications", { days_old: 30 });
  return NextResponse.json({ deleted: count });
}
