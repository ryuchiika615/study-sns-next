import { createServerSupabase } from "@/lib/supabase-server";
import { fetchAndEnrichPosts } from "@/lib/post-fetcher";
import WholeHomeClient from "./WholeHomeClient";

export default async function HomeContent({ userId, profile, search }: { userId: string; profile: any; search?: string }) {
  const supabase = createServerSupabase();

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 29);
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = today.toISOString().split("T")[0];

  const [profileResult, postsResult] = await Promise.all([
    supabase.from("profiles")
      .select("id, display_name, username, icon_url, points, exchange_points, current_title_id, current_avatar_id, target_date, target_minutes, is_admin, bio, department, theme_color")
      .eq("id", userId)
      .single(),
    supabase.from("posts")
      .select("study_minutes")
      .eq("user_id", userId)
      .gt("study_minutes", 0)
      .gte("created_at", startStr)
      .lte("created_at", endStr + "T23:59:59Z"),
  ]);

  const totalMinutes = (postsResult.data || []).reduce((sum: number, p: any) => sum + (p.study_minutes || 0), 0);

  const { posts: initialPosts, totalPages: initialTotalPages } = await fetchAndEnrichPosts(supabase, userId, { search });

  return (
    <WholeHomeClient
      userId={userId}
      profile={profile || profileResult.data}
      totalMinutes={totalMinutes}
      initialPosts={initialPosts}
      initialTotalPages={initialTotalPages}
    />
  );
}
