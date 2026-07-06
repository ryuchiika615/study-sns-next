import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data } = await supabase
    .from("ranking_rewards")
    .select("user_id")
    .eq("year_month", yearMonth)
    .eq("rank", 1)
    .maybeSingle();

  return NextResponse.json({ user_id: data?.user_id || null });
}
