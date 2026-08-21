import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import PublicBoardComposer from "@/components/PublicBoardComposer";
import HomeContent from "../HomeContent";

function ContentSkeleton() {
  return <div className="p-4 max-w-2xl mx-auto space-y-4 animate-pulse"><div className="h-48 bg-gray-200 rounded-xl" /><div className="h-32 bg-gray-200 rounded-xl" /><div className="h-24 bg-gray-200 rounded-xl" /></div>;
}

export default async function BoardPage({ searchParams }: { searchParams?: { q?: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles")
    .select("id, display_name, username, icon_url, points, exchange_points, current_title_id, current_avatar_id, target_date, target_start_date, target_minutes, is_admin, bio, department, theme_color, default_post_card_theme")
    .eq("id", user.id)
    .single();

  return <>
    <section className="mx-4 mb-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4"><p className="text-sm font-black text-amber-950"><i className="fas fa-bullhorn mr-1.5" />公開掲示板</p><p className="mt-1 text-xs text-amber-800">仲間募集・質問・情報共有をする場所です。グループ内の投稿本文はここには出ません。</p></section>
    <PublicBoardComposer userId={user.id} />
    <Suspense fallback={<ContentSkeleton />}><HomeContent userId={user.id} profile={profile} totalMinutes={0} search={searchParams?.q} /></Suspense>
  </>;
}
