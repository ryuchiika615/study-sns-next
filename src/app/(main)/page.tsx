import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import PostFormSection from "./PostFormSection";
import HomeContent from "./HomeContent";
import StatsCards from "./StatsCards";


function ContentSkeleton() {
  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 animate-pulse">
      <div className="h-48 bg-gray-200 rounded-xl" />
      <div className="h-32 bg-gray-200 rounded-xl" />
      <div className="h-24 bg-gray-200 rounded-xl" />
      <div className="h-24 bg-gray-200 rounded-xl" />
    </div>
  );
}

export default async function HomePage({ searchParams }: { searchParams?: { q?: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const today = new Date();
  const endStr = today.toISOString().split("T")[0];

  const [profileResult, postsResult] = await Promise.all([
    supabase.from("profiles")
      .select("id, display_name, username, icon_url, points, exchange_points, current_title_id, current_avatar_id, target_date, target_start_date, target_minutes, is_admin, bio, department, theme_color, default_post_card_theme")
      .eq("id", user.id)
      .single(),
    supabase.from("posts")
      .select("study_minutes, workout_minutes, created_at")
      .eq("user_id", user.id)
      .or("study_minutes.gt.0,workout_minutes.gt.0"),
  ]);

  const profile = profileResult.data;
  const allPosts = postsResult.data || [];

  const totalMinutes = allPosts.reduce((sum: number, p: any) => sum + (p.study_minutes || 0), 0);
  const totalWorkoutMinutes = allPosts.reduce((sum: number, p: any) => sum + (p.workout_minutes || 0), 0);

  // 目標期間中の勉強時間
  const goalStart = profile?.target_start_date;
  const goalEnd = profile?.target_date;
  const goalMinutes = goalStart && goalEnd
    ? allPosts.filter((p: any) => {
        const d = p.created_at?.slice(0, 10);
        return d >= goalStart && d <= goalEnd;
      }).reduce((sum: number, p: any) => sum + (p.study_minutes || 0), 0)
    : totalMinutes;

  return (
    <>
      <StatsCards profile={profile} totalMinutes={totalMinutes} goalMinutes={goalMinutes} totalWorkoutMinutes={totalWorkoutMinutes} />
      <PostFormSection userId={user.id} profile={profile} />
      <Suspense fallback={<ContentSkeleton />}>
        <HomeContent userId={user.id} profile={profile} totalMinutes={goalMinutes} search={searchParams?.q} />
      </Suspense>
    </>
  );
}
