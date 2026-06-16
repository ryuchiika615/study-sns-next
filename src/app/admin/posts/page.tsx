"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      fetchPosts();
    });
  }, []);

  const fetchPosts = async () => {
    const res = await fetch("/api/admin/posts");
    if (res.status === 403) { setError("管理者のみアクセスできます"); return; }
    if (res.ok) {
      const data = await res.json();
      setPosts(data.posts);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selectAll) { setSelected(new Set()); setSelectAll(false); }
    else { setSelected(new Set(posts.map((p) => p.id))); setSelectAll(true); }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size}件のリュイートを削除しますか？`)) return;
    const res = await fetch("/api/admin/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postIds: [...selected] }),
    });
    if (res.ok) {
      setMessage(`${selected.size}件を削除しました`);
      setSelected(new Set());
      setSelectAll(false);
      fetchPosts();
    } else {
      const err = await res.json().catch(() => ({ error: "不明なエラー" }));
      setError(err.error || "削除に失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-b from-gray-900 to-blue-900 border-b-4 border-yellow-600 text-center py-6 shadow-lg">
        <Link href="/admin" className="absolute left-4 top-6 text-yellow-600 text-lg">
          <i className="fas fa-arrow-left" />
        </Link>
        <h1 className="text-3xl text-yellow-600 font-serif tracking-wider m-0">リュイート管理</h1>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center mb-4">{error}</div>}
        {message && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4">{message}</div>}

        {selected.size > 0 && (
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm text-gray-600">{selected.size}件選択中</span>
            <button onClick={handleBulkDelete}
              className="bg-red-500 text-white text-sm px-4 py-1.5 rounded-full font-bold cursor-pointer hover:bg-red-600">
              削除する
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 w-10">
                  <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} />
                </th>
                <th className="px-3 py-2 text-left">ユーザー</th>
                <th className="px-3 py-2 text-left">内容</th>
                <th className="px-3 py-2 text-left">科目</th>
                <th className="px-3 py-2 text-right">時間</th>
                <th className="px-3 py-2 text-left">日時</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post: any) => (
                <tr key={post.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(post.id)} onChange={() => toggleSelect(post.id)} />
                  </td>
                  <td className="px-3 py-2">{post.user?.display_name || post.user_id?.slice(0, 8)}</td>
                  <td className="px-3 py-2 max-w-xs truncate">{post.content}</td>
                  <td className="px-3 py-2">{post.subject}</td>
                  <td className="px-3 py-2 text-right">{post.study_minutes}m</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {new Date(post.created_at).toLocaleString("ja-JP")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {posts.length === 0 && <p className="text-center text-gray-500 py-8">リュイートがありません</p>}
        </div>
      </div>
    </div>
  );
}
