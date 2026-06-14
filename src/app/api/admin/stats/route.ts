import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { count: totalUsers } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  const { count: totalPosts } = await supabase.from("posts").select("*", { count: "exact", head: true });
  const { count: totalLikes } = await supabase.from("likes").select("*", { count: "exact", head: true });
  const { count: totalComments } = await supabase.from("comments").select("*", { count: "exact", head: true });
  const { count: totalFollows } = await supabase.from("follows").select("*", { count: "exact", head: true });

  const { data: posts } = await supabase.from("posts").select("study_minutes").gt("study_minutes", 0);
  const totalStudyMinutes = (posts || []).reduce((sum, p: any) => sum + (p.study_minutes || 0), 0);

  const { data: todayPosts } = await supabase
    .from("posts")
    .select("id")
    .gte("created_at", new Date().toISOString().split("T")[0]);

  const { data: activeSessions } = await supabase
    .from("login_sessions")
    .select("user_id")
    .is("logout_at", null)
    .gte("last_seen_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

  const activeUserIds = new Set(activeSessions?.map((s: any) => s.user_id) || []);

  return NextResponse.json({
    total_users: totalUsers || 0,
    total_posts: totalPosts || 0,
    total_likes: totalLikes || 0,
    total_comments: totalComments || 0,
    total_follows: totalFollows || 0,
    total_study_minutes: totalStudyMinutes,
    total_study_display: formatStudyTime(totalStudyMinutes),
    today_posts: todayPosts?.length || 0,
    active_users_now: activeUserIds.size,
  });
}

function formatStudyTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}時間${m}分`;
  if (h > 0) return `${h}時間`;
  return `${m}分`;
}
