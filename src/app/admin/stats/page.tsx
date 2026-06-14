"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function AdminStatsPage() {
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      fetch("/api/admin/stats").then(async (res) => {
        if (res.status === 403) { setError("管理者のみアクセスできます"); return; }
        if (res.ok) setStats(await res.json());
      });
    });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 text-red-600 p-6 rounded-lg">{error}</div>
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: "総ユーザー数", value: stats.total_users, icon: "👥" },
    { label: "総リュイート数", value: stats.total_posts, icon: "📝" },
    { label: "総いいね数", value: stats.total_likes, icon: "❤️" },
    { label: "総コメント数", value: stats.total_comments, icon: "💬" },
    { label: "フォロー総数", value: stats.total_follows, icon: "🔗" },
    { label: "総勉強時間", value: stats.total_study_display, icon: "📚" },
    { label: "今日のリュイート", value: stats.today_posts, icon: "📅" },
    { label: "現在アクティブ", value: stats.active_users_now, icon: "🟢" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-b from-gray-900 to-blue-900 border-b-4 border-yellow-600 text-center py-6 shadow-lg">
        <Link href="/admin" className="absolute left-4 top-6 text-yellow-600 text-lg">
          <i className="fas fa-arrow-left" />
        </Link>
        <h1 className="text-3xl text-yellow-600 font-serif tracking-wider m-0">統計</h1>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {cards.map((card) => (
            <div key={card.label} className="bg-white rounded-2xl shadow p-5 text-center">
              <div className="text-3xl mb-2">{card.icon}</div>
              <div className="text-2xl font-bold text-primary">{card.value}</div>
              <div className="text-sm text-gray-500 mt-1">{card.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
