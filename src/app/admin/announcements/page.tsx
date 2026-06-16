"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      const { data: p } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single();
      if (!p?.is_admin) { setError("管理者のみアクセスできます"); return; }
      fetchAnnouncements();
    });
  }, []);

  const fetchAnnouncements = async () => {
    const res = await fetch("/api/admin/announcements");
    if (res.ok) {
      const data = await res.json();
      setAnnouncements(data.announcements);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim() }),
    });
    if (res.ok) {
      setMessage("お知らせを送信しました！");
      setContent("");
      fetchAnnouncements();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("削除しますか？")) return;
    const res = await fetch("/api/admin/announcements", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      fetchAnnouncements();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-b from-gray-900 to-blue-900 border-b-4 border-yellow-600 text-center py-6 shadow-lg">
        <Link href="/admin" className="absolute left-4 top-6 text-yellow-600 text-lg">
          <i className="fas fa-arrow-left" />
        </Link>
        <h1 className="text-3xl text-yellow-600 font-serif tracking-wider m-0">お知らせ管理</h1>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center">{error}</div>}
        {message && <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm">{message}</div>}

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h2 className="font-bold">新規お知らせ</h2>
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-lg border-gray-300 text-sm" rows={4} placeholder="お知らせ内容" required />
          <button type="submit" className="bg-primary text-white font-bold rounded-full px-6 py-2 text-sm">
            送信
          </button>
        </form>

        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-100 font-bold">送信済みお知らせ</div>
          {announcements.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">まだお知らせはありません</p>
          )}
          {announcements.map((a: any) => (
            <div key={a.id} className="p-4 border-b border-gray-100 last:border-0 flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm whitespace-pre-wrap">{a.content}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(a.created_at).toLocaleString("ja-JP")}</p>
              </div>
              <button onClick={() => handleDelete(a.id)}
                className="text-red-500 text-sm cursor-pointer flex-shrink-0">
                <i className="fas fa-trash" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
