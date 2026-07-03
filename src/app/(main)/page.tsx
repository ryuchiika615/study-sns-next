import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import PostFormSection from "./PostFormSection";
import HomeContent from "./HomeContent";
import BgmToggle from "@/components/BgmToggle";

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

function StatsCards({ profile, totalMinutes }: { profile: any; totalMinutes: number }) {
  const formatRemaining = (minutes: number) => {
    if (minutes <= 0) return "目標達成！🎉";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}時間${m}分`;
    if (h > 0) return `${h}時間`;
    return `${m}分`;
  };

  const isTargetExpired = profile?.target_date
    ? new Date(profile.target_date + "T23:59:59") < new Date()
    : false;

  return (
    <div className="mx-4 mb-3 space-y-3">
      {totalMinutes > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900 to-blue-700 text-white border border-blue-400 text-center shadow-sm">
          <p className="text-sm text-blue-200">総勉強時間</p>
          <p className="text-2xl font-bold">{formatRemaining(totalMinutes)}</p>
        </div>
      )}
      {profile?.target_date && profile?.target_minutes > 0 && !isTargetExpired && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 text-white border border-yellow-600 text-center shadow-sm">
          <h4 className="text-yellow-500 m-0 mb-2"><i className="fas fa-bullseye" /> {profile.target_date} までの目標</h4>
          <p className="text-sm text-gray-400">目標合計 {Math.floor(profile.target_minutes / 60)}時間{profile.target_minutes % 60}分</p>
          <p className="text-lg text-yellow-400 font-bold mt-1">あと {formatRemaining(profile.target_minutes - totalMinutes)}</p>
        </div>
      )}
    </div>
  );
}

export default async function HomePage({ searchParams }: { searchParams?: { q?: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 29);
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = today.toISOString().split("T")[0];

  const [profileResult, postsResult] = await Promise.all([
    supabase.from("profiles")
      .select("id, display_name, username, icon_url, points, exchange_points, current_title_id, current_avatar_id, target_date, target_minutes, is_admin, bio, department, theme_color")
      .eq("id", user.id)
      .single(),
    supabase.from("posts")
      .select("study_minutes")
      .eq("user_id", user.id)
      .gt("study_minutes", 0)
      .gte("created_at", startStr)
      .lte("created_at", endStr + "T23:59:59Z"),
  ]);

  const profile = profileResult.data;
  const totalMinutes = (postsResult.data || []).reduce((sum: number, p: any) => sum + (p.study_minutes || 0), 0);

  return (
    <>
      <StatsCards profile={profile} totalMinutes={totalMinutes} />
      <PostFormSection userId={user.id} profile={profile} />
      <Suspense fallback={<ContentSkeleton />}>
        <HomeContent userId={user.id} profile={profile} totalMinutes={totalMinutes} search={searchParams?.q} />
      </Suspense>
      <BgmToggle />
    </>
  );
}
