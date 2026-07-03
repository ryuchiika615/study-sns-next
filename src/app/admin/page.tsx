"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function AdminDashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState("");
  const [bgmCount, setBgmCount] = useState(0);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      if (profile) {
        setProfile(profile);
        if (!profile.is_admin) {
          setError("管理者のみアクセスできます");
          return;
        }
      }
      const [sres, bgmRes, fbRes] = await Promise.all([
        fetch("/api/admin/login-activity"),
        fetch("/api/admin/bgm/count"),
        fetch("/api/admin/feedback/count"),
      ]);
      if (sres.ok) {
        const sd = await sres.json();
        setStats(sd);
      }
      if (bgmRes.ok) { const d = await bgmRes.json(); setBgmCount(d.count || 0); }
      if (fbRes.ok) { const d = await fbRes.json(); setFeedbackCount(d.count || 0); }
    });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 text-red-600 p-6 rounded-lg text-center max-w-sm">
          <p className="font-bold text-lg mb-2">アクセス拒否</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-b from-gray-900 to-blue-900 border-b-4 border-yellow-600 text-center py-6 shadow-lg">
        <h1 className="text-3xl text-yellow-600 font-serif tracking-wider m-0" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
          管理者ダッシュボード
        </h1>
        <p className="text-sm text-yellow-600 tracking-widest mt-1">
          {profile?.display_name || profile?.username} で管理中
        </p>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* リュッターを開く */}
        <Link
          href="/"
          className="block bg-white rounded-2xl shadow p-6 hover:shadow-lg transition text-center"
        >
          <div className="text-4xl mb-2">📖</div>
          <div className="text-xl font-bold text-primary">リュッターを開く</div>
          <div className="text-sm text-gray-500 mt-1">勉強SNSのメイン画面へ</div>
        </Link>

        {/* 各種管理機能 */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/admin/login-activity"
            className="bg-white rounded-2xl shadow p-5 hover:shadow-lg transition text-center"
          >
            <div className="text-2xl mb-1">👁️</div>
            <div className="font-bold text-sm">ログイン監視</div>
            <div className="text-xs text-gray-500 mt-1">
              アクティブ: {stats?.active_count ?? "-"}人
            </div>
          </Link>

          <Link href="/admin/posts" className="bg-white rounded-2xl shadow p-5 hover:shadow-lg transition text-center">
            <div className="text-2xl mb-1">📝</div>
            <div className="font-bold text-sm">リュイート管理</div>
            <div className="text-xs text-gray-500 mt-1">一括削除・管理</div>
          </Link>

          <Link href="/admin/users" className="bg-white rounded-2xl shadow p-5 hover:shadow-lg transition text-center">
            <div className="text-2xl mb-1">👥</div>
            <div className="font-bold text-sm">ユーザー管理</div>
            <div className="text-xs text-gray-500 mt-1">パスワードリセット・権限管理</div>
          </Link>

          <Link href="/admin/stats" className="bg-white rounded-2xl shadow p-5 hover:shadow-lg transition text-center">
            <div className="text-2xl mb-1">📊</div>
            <div className="font-bold text-sm">統計</div>
            <div className="text-xs text-gray-500 mt-1">システム全体のデータ</div>
          </Link>

          <Link href="/admin/announcements" className="bg-white rounded-2xl shadow p-5 hover:shadow-lg transition text-center">
            <div className="text-2xl mb-1">📨</div>
            <div className="font-bold text-sm">お知らせ</div>
            <div className="text-xs text-gray-500 mt-1">全ユーザーへのお知らせ</div>
          </Link>

          <Link href="/admin/feedback" className="bg-white rounded-2xl shadow p-5 hover:shadow-lg transition text-center relative">
            <div className="text-2xl mb-1">💬</div>
            <div className="font-bold text-sm">要望・報告</div>
            <div className="text-xs text-gray-500 mt-1">ユーザーからのフィードバック</div>
            {feedbackCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[24px] h-[24px] flex items-center justify-center px-1 shadow-md">
                {feedbackCount > 9 ? "9+" : feedbackCount}
              </span>
            )}
          </Link>

          <Link href="/admin/bgm" className="bg-white rounded-2xl shadow p-5 hover:shadow-lg transition text-center relative">
            <div className="text-2xl mb-1">🎵</div>
            <div className="font-bold text-sm">BGM管理</div>
            <div className="text-xs text-gray-500 mt-1">YouTubeリクエスト・プレゼント</div>
            {bgmCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[24px] h-[24px] flex items-center justify-center px-1 shadow-md">
                {bgmCount > 9 ? "9+" : bgmCount}
              </span>
            )}
          </Link>

          <Link href="/admin/page-analytics" className="bg-white rounded-2xl shadow p-5 hover:shadow-lg transition text-center">
            <div className="text-2xl mb-1">📈</div>
            <div className="font-bold text-sm">ページ分析</div>
            <div className="text-xs text-gray-500 mt-1">画面遷移を可視化</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
