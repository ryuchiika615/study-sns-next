"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { fetchAndEnrichPosts } from "@/lib/post-fetcher";
import PostCard from "@/components/PostCard";

export default function GroupTimeline({ groupId, userId }: { groupId: string; userId: string }) {
  const supabase = createClient();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async (targetPage = 1) => {
    setLoading(true);
    const result = await fetchAndEnrichPosts(supabase, userId, { groupId, page: targetPage });
    setPosts(result.posts);
    setPage(result.currentPage);
    setTotalPages(result.totalPages);
    setLoading(false);
  }, [groupId, userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = () => load(1);
    window.addEventListener("post-created", refresh);
    return () => window.removeEventListener("post-created", refresh);
  }, [load]);

  if (loading && posts.length === 0) return <div className="rounded-xl border bg-white p-5 text-center text-sm text-gray-400">投稿を読み込み中...</div>;
  if (!posts.length) return <div className="rounded-xl border border-dashed bg-white p-8 text-center"><p className="text-2xl">📝</p><p className="mt-2 text-sm font-bold text-gray-700">まだグループ投稿がありません</p><p className="mt-1 text-xs text-gray-500">最初の学習記録を共有しよう。</p></div>;

  return <div className="space-y-3">
    {posts.map((post) => <PostCard key={post.id} post={post} currentUserId={userId} onDelete={() => load(1)} onUpdate={() => load(page)} />)}
    {loading && <div className="rounded-xl border bg-white p-3 text-center text-xs text-gray-500">投稿を読み込み中...</div>}
    {totalPages > 1 && <div className="flex items-center justify-center gap-3 rounded-xl border bg-white px-4 py-3"><button disabled={page <= 1 || loading} onClick={() => load(page - 1)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm disabled:opacity-40">&laquo; 前へ</button><span className="min-w-16 text-center text-sm font-bold text-gray-600">{page} / {totalPages}</span><button disabled={page >= totalPages || loading} onClick={() => load(page + 1)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm disabled:opacity-40">次へ &raquo;</button></div>}
  </div>;
}
