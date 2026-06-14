import { createServerSupabase } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { subjectColor, formatStudyTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // プロフィール
  const profilePromise = supabase
    .from("profiles")
    .select("id, display_name, username, icon_url, points, exchange_points, current_title_id, current_avatar_id, target_date, target_minutes, is_admin, bio, department, theme_color")
    .eq("id", user.id)
    .single();

  // 未読通知数
  const unreadPromise = supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .eq("is_read", false);

  // 週間データ（30日分）
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 29);
  const startStr = weekAgo.toISOString().split("T")[0];
  const endStr = today.toISOString().split("T")[0];

  const postsPromise = supabase
    .from("posts")
    .select("created_at, study_minutes, subject")
    .eq("user_id", user.id)
    .gt("study_minutes", 0)
    .gte("created_at", startStr)
    .lte("created_at", endStr + "T23:59:59Z")
    .order("created_at", { ascending: true });

  const [profileResult, unreadResult, postsResult] = await Promise.all([
    profilePromise,
    unreadPromise,
    postsPromise,
  ]);

  const profile = profileResult.data;
  const unreadCount = unreadResult.count || 0;
  const posts = postsResult.data || [];

  // 週間ラベル
  const weeklyLabels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    weeklyLabels.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }

  // 科目別の週間データ
  const weeklySubjects = new Map<string, number[]>();
  posts.forEach((post: any) => {
    const postDate = post.created_at.split("T")[0];
    const weeklyIndex = weeklyLabels.findIndex((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0] === postDate;
    });
    if (weeklyIndex >= 0) {
      if (!weeklySubjects.has(post.subject)) {
        weeklySubjects.set(post.subject, new Array(7).fill(0));
      }
      weeklySubjects.get(post.subject)![weeklyIndex] += post.study_minutes || 0;
    }
  });

  const datasets = Array.from(weeklySubjects.entries()).map(([subject, data]) => ({
    label: subject,
    data,
    backgroundColor: subjectColor(subject),
  }));

  if (datasets.length === 0) {
    datasets.push({
      label: "勉強時間",
      data: new Array(7).fill(0),
      backgroundColor: "#1877f2",
    });
  }

  const totalMinutes = posts.reduce((sum, p) => sum + (p.study_minutes || 0), 0);

  return NextResponse.json({
    profile,
    unread_count: unreadCount,
    weekly_labels: JSON.stringify(weeklyLabels),
    weekly_datasets: JSON.stringify(datasets),
    total_minutes: totalMinutes,
  });
}
