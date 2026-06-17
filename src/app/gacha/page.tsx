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
      supabase.from("profiles").select("*").eq("id", data.user.id).single().then(({ data: profile }) => {
        if (profile) setProfile(profile);
      });
      supabase.from("notifications").select("*", { count: "exact", head: true }).eq("recipient_id", data.user.id).eq("is_read", false).neq("notification_type", "follow_post").then(({ count }) => {
        setUnreadCount(count || 0);
      });
    });
  }, []);

  if (!profile) return <AppShell unreadCount={unreadCount}><div className="p-4 text-center text-gray-500 py-12">読み込み中...</div></AppShell>;

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
      <div className="mx-4 my-4 space-y-3">

        {/* 連続ボーナスカード */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 to-blue-500 text-white p-5 text-center">
            <p className="text-sm opacity-80 mb-1">連続投稿ボーナス</p>
            <p className="text-4xl font-bold text-yellow-300 drop-shadow-lg">{currentStreak} 日目</p>
            <p className="text-xs opacity-60 mt-1">現在の連続記録</p>
          </div>

          <div className="grid grid-cols-3 gap-2 p-4 bg-gray-50/50">
            {bonusData.map((b) => (
              <div
                key={b.day}
                className={`relative rounded-xl border-2 p-3 text-center transition ${
                  isClaimed(b.day)
                    ? "border-green-400 bg-green-50"
                    : isCurrent(b.day)
                    ? "border-blue-500 bg-blue-50 shadow-md scale-105"
                    : "border-gray-200 bg-white"
                }`}
              >
                <p className="text-xs font-bold text-gray-500 mb-0.5">{b.day}日目</p>
                <p className="text-lg font-black text-gray-800">{b.pt}pt</p>
                {isClaimed(b.day) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fas fa-check-circle text-green-400 text-3xl opacity-60" />
                  </div>
                )}
              </div>
            ))}

            <div className="col-span-3 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 rounded-xl p-4 text-center">
              <p className="text-xs font-bold text-purple-700 mb-1">8日目以降</p>
              <p className="text-2xl font-black text-purple-800">100 pt 固定</p>
              {extraDay && (
                <p className="text-sm text-purple-600 mt-1 font-bold">現在 {extraDay}日連続！</p>
              )}
            </div>
          </div>

          <div className="px-4 py-3 text-xs text-gray-400 text-center border-t border-gray-100 bg-gray-50/30">
            <i className="fas fa-info-circle mr-1" /> 1日1回、リュイートするとポイントGET！
          </div>
        </div>

      </div>
    </AppShell>
  );
}
