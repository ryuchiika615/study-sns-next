import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import PostFormSection from "./PostFormSection";
import HomeContent from "./HomeContent";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username, icon_url, points, exchange_points, current_title_id, current_avatar_id, target_date, target_minutes, is_admin, bio, department, theme_color")
    .eq("id", user.id)
    .single();

  return (
    <>
      <PostFormSection userId={user.id} profile={profile} />
      <Suspense fallback={<ContentSkeleton />}>
        <HomeContent userId={user.id} profile={profile} search={searchParams?.q} />
      </Suspense>
    </>
  );
}
