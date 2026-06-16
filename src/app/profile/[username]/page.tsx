import { createServerSupabase } from "@/lib/supabase-server";
import { redirect, notFound } from "next/navigation";
import { subjectColor } from "@/lib/utils";
import { fetchAndEnrichPosts } from "@/lib/post-fetcher";
import ProfileClient from "./ProfileClient";

export default async function UserProfilePage({ params }: { params: { username: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { username } = params;

  const fields = "id, username, display_name, bio, department, icon_url, target_date, target_minutes";
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);

  let { data: profile, error } = await supabase
    .from("profiles")
    .select(fields)
    .eq(isUuid ? "id" : "username", username)
    .maybeSingle();

  if (!profile && !isUuid) {
    const { data: byDisplay } = await supabase
      .from("profiles")
      .select(fields)
      .eq("display_name", username)
      .maybeSingle();
    profile = byDisplay;
  }

  if (error || !profile) notFound();

  const yearStart = `${new Date().getFullYear()}-01-01`;
  const [followResult, followersResult, followingResult, postCountResult, statsResult, unreadResult, postsData, calendarResult] = await Promise.all([
    supabase.from("follows").select("*").eq("follower_id", user.id).eq("following_id", profile.id).maybeSingle(),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id),
    supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
    supabase.from("posts").select("study_minutes, subject, created_at").eq("user_id", profile.id).gt("study_minutes", 0),
    supabase.from("notifications").select("*", { count: "exact", head: true }).eq("recipient_id", user.id).eq("is_read", false).neq("notification_type", "follow_post"),
    fetchAndEnrichPosts(supabase, user.id, { userId: profile.id }),
    supabase.from("posts").select("created_at, study_minutes").eq("user_id", profile.id).gte("created_at", yearStart).gt("study_minutes", 0),
  ]);

  const totalMinutes = (statsResult.data || []).reduce((sum: number, p: any) => sum + (p.study_minutes || 0), 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthMinutes = (statsResult.data || [])
    .filter((p: any) => new Date(p.created_at) >= monthStart)
    .reduce((sum: number, p: any) => sum + (p.study_minutes || 0), 0);

  const subjectMap = new Map<string, number>();
  (statsResult.data || []).forEach((p: any) => {
    subjectMap.set(p.subject, (subjectMap.get(p.subject) || 0) + (p.study_minutes || 0));
  });

  const fmtStudyTime = (m: number) => {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    if (h > 0 && rest > 0) return `${h}時間${rest}分`;
    if (h > 0) return `${h}時間`;
    return `${rest}分`;
  };

  const calendarData = (calendarResult.data || []).map((p: any) => ({
    date: new Date(p.created_at).toISOString().split("T")[0],
    minutes: p.study_minutes || 0,
  }));

  return (
    <ProfileClient
      user={{ id: user.id }}
      profile={profile}
      initialPosts={postsData.posts}
      isFollowing={!!followResult.data}
      subjectLabels={JSON.stringify([...subjectMap.keys()])}
      subjectData={JSON.stringify([...subjectMap.values()])}
      subjectColors={JSON.stringify([...subjectMap.keys()].map((s) => subjectColor(s)))}
      followersCount={followersResult.count || 0}
      followingCount={followingResult.count || 0}
      postCount={postCountResult.count || 0}
      totalStudyDisplay={fmtStudyTime(totalMinutes)}
      monthStudyDisplay={fmtStudyTime(monthMinutes)}
      totalStudyMinutes={totalMinutes}
      unreadCount={unreadResult.count || 0}
      calendarData={calendarData}
    />
  );
}
