"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { fetchAndEnrichPosts } from "@/lib/post-fetcher";
import PostCard from "@/components/PostCard";

export default function GroupTimeline({ groupId, userId }: { groupId: string; userId: string }) {
  const supabase = createClient();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchAndEnrichPosts(supabase, userId, { groupId });
    setPosts(result.posts);
    setLoading(false);
  }, [groupId, userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = () => load();
    window.addEventListener("post-created", refresh);
    return () => window.removeEventListener("post-created", refresh);
  }, [load]);

  if (loading) return <div className="rounded-xl border bg-white p-5 text-center text-sm text-gray-400">投稿を読み込み中...</div>;
  if (!posts.length) return <div className="rounded-xl border border-dashed bg-white p-8 text-center"><p className="text-2xl">📝</p><p className="mt-2 text-sm font-bold text-gray-700">まだグループ投稿がありません</p><p className="mt-1 text-xs text-gray-500">最初の学習記録を共有しよう。</p></div>;

  return <div className="space-y-3">
    {posts.map((post) => <PostCard key={post.id} post={post} currentUserId={userId} onDelete={load} onUpdate={load} />)}
  </div>;
}
