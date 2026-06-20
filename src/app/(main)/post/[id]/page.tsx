import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase-server";
import { redirect, notFound } from "next/navigation";
import { fetchPostById } from "@/lib/post-fetcher";
import PostDetailClient from "./PostDetailClient";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createServerSupabase();
  const { data: post } = await supabase
    .from("posts")
    .select("content, study_minutes, subject, user:user_id(display_name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!post) return { title: "ポスト - リュッター" };
  const displayName = (post.user as any)?.display_name || "ユーザー";
  const content = post.content?.slice(0, 100) || "";
  return {
    title: `${displayName}の勉強記録 - リュッター`,
    description: `${content} (${post.subject}: ${post.study_minutes}分)`,
    openGraph: {
      title: `${displayName}の勉強記録`,
      description: `${content} (${post.subject}: ${post.study_minutes}分)`,
    },
  };
}

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
