import { createServerSupabase } from "@/lib/supabase-server";
import { redirect, notFound } from "next/navigation";
import FollowPageClient from "./FollowPageClient";

export default async function FollowPage({ params, searchParams }: { params: { username: string }; searchParams: { tab?: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { username } = params;
  const tab = searchParams.tab === "following" ? "following" : "followers";

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(username);
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, icon_url")
    .eq(isUuid ? "id" : "username", username)
    .maybeSingle();

  if (!profile) notFound();

  const isOwner = user.id === profile.id;

  return (
    <FollowPageClient
      currentUserId={user.id}
      profile={profile}
      tab={tab}
      isOwner={isOwner}
    />
  );
}
