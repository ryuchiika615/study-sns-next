import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
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

  const [profileResult, postsResult, membershipResult] = await Promise.all([
    supabase.from("profiles")
      .select("id, display_name, username, icon_url, points, exchange_points, current_title_id, current_avatar_id, target_date, target_start_date, target_minutes, is_admin, bio, department, theme_color, default_post_card_theme")
      .eq("id", user.id)
      .single(),
    supabase.from("posts")
      .select("study_minutes, workout_minutes, created_at")
      .eq("user_id", user.id)
      .or("study_minutes.gt.0,workout_minutes.gt.0"),
    supabase.from("study_group_members").select("group_id").eq("user_id", user.id),
  ]);

  const profile = profileResult.data;
  const allPosts = postsResult.data || [];
  const groupIds = (membershipResult.data || []).map((member: any) => member.group_id);
  const { data: groups } = groupIds.length
    ? await supabase.from("study_groups").select("id, name, description, visibility").in("id", groupIds).order("created_at", { ascending: false })
    : { data: [] };

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
      <section className="mx-4 mb-4 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-4">
        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-blue-950"><i className="fas fa-users mr-1.5" />あなたのグループ</p><p className="mt-1 text-xs text-blue-800">仲間だけの投稿・会話・勉強時間の勝負はここから。</p></div><Link href="/groups" className="shrink-0 rounded-full bg-blue-600 px-3 py-2 text-xs font-bold text-white no-underline">一覧・管理</Link></div>
        {groups?.length ? <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{groups.map((group: any) => <Link key={group.id} href={`/groups/${group.id}`} className="min-w-[190px] rounded-xl border border-blue-100 bg-white p-3 no-underline shadow-sm"><p className="truncate text-sm font-bold text-gray-900">{group.visibility === "private" ? "🔒" : "🌍"} {group.name}</p><p className="mt-1 line-clamp-2 text-[11px] text-gray-500">{group.description || "仲間と一緒に学習を続けよう"}</p><p className="mt-2 text-[11px] font-bold text-blue-600">グループを開く <i className="fas fa-chevron-right ml-1" /></p></Link>)}</div> : <div className="mt-3 rounded-xl border border-dashed border-blue-200 bg-white/70 p-3 text-center"><p className="text-xs text-gray-600">まだグループがありません。友達を招待して、見せたい人だけの場所を作ろう。</p><Link href="/groups" className="mt-2 inline-block text-xs font-bold text-blue-700">グループを作る・参加する</Link></div>}
      </section>
      <PostFormSection userId={user.id} profile={profile} />
      <Suspense fallback={<ContentSkeleton />}>
        <HomeContent userId={user.id} profile={profile} totalMinutes={goalMinutes} search={searchParams?.q} />
      </Suspense>
    </>
  );
}
