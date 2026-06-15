import { createServerSupabase } from "@/lib/supabase-server";
import { redirect, notFound } from "next/navigation";
import { fetchPostById } from "@/lib/post-fetcher";
import PostDetailClient from "./PostDetailClient";

export default async function PostDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const post = await fetchPostById(supabase, params.id, user.id);
  if (!post) notFound();

  const { data: comments } = await supabase
    .from("comments")
    .select("*, user:user_id(*)")
    .eq("post_id", params.id)
    .order("created_at", { ascending: true });

  return <PostDetailClient post={post} currentUserId={user.id} comments={comments || []} />;
}
