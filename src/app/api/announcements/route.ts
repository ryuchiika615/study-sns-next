import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count } = await supabase
    .from("admin_announcements")
    .select("*", { count: "exact", head: true })
    .not("id", "in", (
      await supabase.from("announcement_reads").select("announcement_id").eq("user_id", user.id)
    ).data?.map(r => r.announcement_id) || []);

  const { data: unread } = await supabase
    .from("admin_announcements")
    .select("id, content, created_at")
    .not("id", "in", (
      await supabase.from("announcement_reads").select("announcement_id").eq("user_id", user.id)
    ).data?.map(r => r.announcement_id) || [])
    .order("created_at", { ascending: false });

  return NextResponse.json({ unreadCount: count || 0, announcements: unread || [] });
}
