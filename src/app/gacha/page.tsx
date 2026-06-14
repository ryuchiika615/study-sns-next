"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";

export default function GachaPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      setUser(data.user);
      fetch("/api/profile").then((r) => r.ok && r.json()).then((d) => {
        if (d?.profile) setProfile(d.profile);
      });
      fetch("/api/notifications").then((r) => r.ok && r.json()).then((d) => {
        if (d) setUnreadCount(d.unread_count);
      });
    });
  }, []);

  if (!profile) return <AppShell unreadCount={unreadCount}><div className="p-4 text-center text-gray-500">読み込み中...</div></AppShell>;

  const currentStreak = profile.consecutive_post_days || 0;

  const bonusData = [
    { day: 1, pt: 1 },
    { day: 2, pt: 2 },
    { day: 3, pt: 4 },
    { day: 4, pt: 8 },
    { day: 5, pt: 16 },
    { day: 6, pt: 32 },
    { day: 7, pt: 64 },
  ];

  const extraDay = currentStreak >= 8 ? currentStreak : null;

  const isClaimed = (day: number) => currentStreak >= day;
  const isCurrent = (day: number) => {
    if (day === 1) return currentStreak === 0;
    if (day === 8) return false;
    return currentStreak === day - 1;
  };

  return (
    <AppShell unreadCount={unreadCount}>
      <header className="lytter-home-banner bg-gradient-to-b from-gray-900 to-blue-900 border-b-3 border-yellow-600 text-center py-4 shadow-lg mb-4">
        <h1 className="text-3xl text-yellow-600 font-serif tracking-wider m-0" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
          LOGIN BONUS
        </h1>
      </header>

      <div className="container mx-auto max-w-2xl px-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 to-blue-500 text-white p-5 text-center">
            <h2 className="text-2xl font-bold m-0 mb-2 tracking-wide">連続投稿ボーナス</h2>
            <p className="text-sm opacity-80 mb-2">現在の連続記録</p>
            <p className="text-4xl font-bold text-yellow-300 drop-shadow-lg">{currentStreak} 日目</p>
          </div>

          <div className="grid grid-cols-3 gap-3 p-5 bg-slate-50">
            {bonusData.map((b) => (
              <div
                key={b.day}
                className={`relative bg-white rounded-lg border-2 p-4 text-center ${
                  isClaimed(b.day)
                    ? "border-green-400 bg-green-50"
                    : isCurrent(b.day)
                    ? "border-blue-500 shadow-lg shadow-blue-200 scale-105"
                    : "border-gray-200"
                }`}
              >
                <p className="text-xs font-bold text-gray-500 mb-1">{b.day}日目</p>
                <p className="text-xl font-black text-gray-800">{b.pt}pt</p>
                {isClaimed(b.day) && (
                  <i className="fas fa-check-circle text-green-400 text-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60" />
                )}
              </div>
            ))}

            {/* 8日目以降は100pt固定 */}
            <div className="col-span-3 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-lg p-4 text-center">
              <p className="text-xs font-bold text-purple-700 mb-1">8日目以降</p>
              <p className="text-2xl font-black text-purple-800">100 pt 固定</p>
              {extraDay && (
                <p className="text-sm text-purple-600 mt-1">現在 {extraDay}日連続！</p>
              )}
            </div>
          </div>

          <div className="p-5 text-sm text-gray-500 text-center leading-relaxed border-t border-gray-100">
            <i className="fas fa-info-circle" /> 1日1回、勉強記録をリュイートするとポイントがもらえます。<br />
            連続でポストするほどもらえるポイントが倍増！<br />
            <span className="text-red-500 font-bold">※過去の日付でポストしても連続記録にはなりません。</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
