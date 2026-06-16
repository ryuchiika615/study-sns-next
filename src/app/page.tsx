import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { subjectColor } from "@/lib/utils";
import AppShell from "@/components/AppShell";
import HomeClient from "./HomeClient";

export default async function HomePage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 29);
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = today.toISOString().split("T")[0];

  const [profileResult, unreadResult, postsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, username, icon_url, points, exchange_points, current_title_id, current_avatar_id, target_date, target_minutes, is_admin, bio, department, theme_color")
      .eq("id", user.id)
      .single(),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false)
      .neq("notification_type", "follow_post"),
    supabase
      .from("posts")
      .select("created_at, study_minutes, subject")
      .eq("user_id", user.id)
      .gt("study_minutes", 0)
      .gte("created_at", startStr)
      .lte("created_at", endStr + "T23:59:59Z")
      .order("created_at", { ascending: true }),
  ]);

  const profile = profileResult.data;
  const unreadCount = unreadResult.count || 0;
  const rawPosts = postsResult.data || [];

  const weeklyLabels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    weeklyLabels.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }

  const weeklySubjects = new Map<string, number[]>();
  rawPosts.forEach((post: any) => {
    const postDate = post.created_at.split("T")[0];
    const idx = weeklyLabels.findIndex((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0] === postDate;
    });
    if (idx >= 0) {
      if (!weeklySubjects.has(post.subject)) {
        weeklySubjects.set(post.subject, new Array(7).fill(0));
      }
      weeklySubjects.get(post.subject)![idx] += post.study_minutes || 0;
    }
  });

  let datasets: { label: string; data: number[]; backgroundColor: string }[];
  if (weeklySubjects.size === 0) {
    datasets = [{ label: "勉強時間", data: new Array(7).fill(0), backgroundColor: "#1877f2" }];
  } else {
    datasets = Array.from(weeklySubjects.entries()).map(([subject, data]) => ({
      label: subject,
      data,
      backgroundColor: subjectColor(subject),
    }));
  }

  const totalMinutes = rawPosts.reduce((sum: number, p: any) => sum + (p.study_minutes || 0), 0);

  return (
    <AppShell unreadCount={unreadCount}>
      <HomeClient
        user={{ id: user.id }}
        profile={profile}
        unreadCount={unreadCount}
        weeklyLabels={weeklyLabels}
        weeklyDatasets={datasets}
        totalMinutes={totalMinutes}
      />
    </AppShell>
  );
}
