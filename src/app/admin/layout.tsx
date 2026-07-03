"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

const NAV_ITEMS = [
  { href: "/admin", label: "トップ", icon: "🏠" },
  { href: "/admin/login-activity", label: "ログイン監視", icon: "👁️" },
  { href: "/admin/posts", label: "リュイート管理", icon: "📝" },
  { href: "/admin/users", label: "ユーザー管理", icon: "👥" },
  { href: "/admin/stats", label: "統計", icon: "📊" },
  { href: "/admin/announcements", label: "お知らせ", icon: "📨" },
  { href: "/admin/feedback", label: "要望・報告", icon: "💬", badgeKey: "feedback" as const },
  { href: "/admin/bgm", label: "BGM管理", icon: "🎵", badgeKey: "bgm" as const },
  { href: "/admin/page-analytics", label: "ページ分析", icon: "📈" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bgmCount, setBgmCount] = useState(0);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    const fetchCounts = async () => {
      const [bgmRes, fbRes] = await Promise.all([
        fetch("/api/admin/bgm/count"),
        fetch("/api/admin/feedback/count"),
      ]);
      if (bgmRes.ok) { const d = await bgmRes.json(); setBgmCount(d.count || 0); }
      if (fbRes.ok) { const d = await fbRes.json(); setFeedbackCount(d.count || 0); }
    };
    fetchCounts();
  }, [pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const getBadgeCount = (badgeKey?: "bgm" | "feedback") => {
    if (badgeKey === "bgm") return bgmCount;
    if (badgeKey === "feedback") return feedbackCount;
    return 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navbar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-gray-900 to-blue-900 border-b-2 border-yellow-600 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center h-12 px-3 gap-3">
          <button onClick={() => setSidebarOpen(true)}
            className="text-xl text-yellow-600 cursor-pointer hover:text-yellow-400 transition bg-transparent border-none p-1">
            <i className="fas fa-bars" />
          </button>
          <Link href="/admin" className="flex items-center gap-2 no-underline">
            <h1 className="text-lg text-yellow-600 font-serif tracking-wider m-0" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
              管理画面
            </h1>
          </Link>
          <Link href="/"
            className="ml-auto text-xs bg-white/20 text-yellow-600 rounded-full px-3 py-1 hover:bg-white/30 transition no-underline">
            <i className="fas fa-home mr-1" />リュッター
          </Link>
        </div>
      </div>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute top-0 left-0 bottom-0 w-72 bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-gray-900 to-blue-900 border-b-2 border-yellow-600 p-4 flex items-center justify-between">
              <span className="text-yellow-600 font-serif tracking-wider text-base">管理メニュー</span>
              <button onClick={() => setSidebarOpen(false)}
                className="text-yellow-600 text-xl cursor-pointer bg-transparent border-none p-1">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="p-2 space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const count = getBadgeCount(item.badgeKey);
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm no-underline transition relative
                      ${isActive ? "bg-gray-100 text-gray-900 font-bold" : "text-gray-700 hover:bg-gray-50"}`}>
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                    {count > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1">
                        {count > 9 ? "9+" : count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-gray-200 p-3">
              <Link href="/"
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-700 hover:bg-gray-50 no-underline">
                <span className="text-lg">📖</span>
                <span>リュッターを開く</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Page content */}
      <div className="pt-12">
        {children}
      </div>
    </div>
  );
}
