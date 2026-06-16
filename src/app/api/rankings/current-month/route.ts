import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01T00:00:00Z`;

  const { data: posts } = await supabase
    .from("posts")
    .select("user_id, study_minutes")
    .gte("created_at", monthStart);

  const totals = new Map<string, number>();
  for (const p of (posts || [])) {
    totals.set(p.user_id, (totals.get(p.user_id) || 0) + (p.study_minutes || 0));
  }

  const sorted = Array.from(totals.entries())
    .map(([user_id, total]) => ({ user_id, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  // Fetch user profiles
  const userIds = sorted.map(s => s.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username, icon_url")
    .in("id", userIds);

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  const top3 = sorted.map(s => ({
    user: profileMap.get(s.user_id) || null,
    totalMinutes: s.total,
    displayTime: `${Math.floor(s.total / 60)}h${s.total % 60}m`,
  }));

  // Days remaining in month
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysRemaining = Math.ceil((lastDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return NextResponse.json({ top3, daysRemaining, month: now.getMonth() + 1 });
}
