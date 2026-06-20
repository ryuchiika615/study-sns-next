import { createServerSupabase } from "@/lib/supabase-server";
import { fetchAndEnrichPosts } from "@/lib/post-fetcher";
import WholeHomeClient from "./WholeHomeClient";

export default async function HomeContent({ userId, profile, totalMinutes, search }: { userId: string; profile: any; totalMinutes: number; search?: string }) {
  const supabase = createServerSupabase();

  const { posts: initialPosts, totalPages: initialTotalPages } = await fetchAndEnrichPosts(supabase, userId, { search });

  return (
    <WholeHomeClient
      userId={userId}
      profile={profile}
      totalMinutes={totalMinutes}
      initialPosts={initialPosts}
      initialTotalPages={initialTotalPages}
    />
  );
}
