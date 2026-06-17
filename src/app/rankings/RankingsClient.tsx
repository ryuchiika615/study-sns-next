"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { formatStudyTime, getOptimizedIconUrl } from "@/lib/utils";

export default function RankingsClient({ initialRanking, initialDays, unreadCount }: {
  initialRanking: any[];
  initialDays: number;
  unreadCount: number;
}) {
  const [ranking, setRanking] = useState(initialRanking);
  const [days, setDays] = useState(initialDays);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetchRankings = async (d: number) => {
    setLoading(true);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - d);

    const { data: posts } = await supabase
      .from("posts")
      .select("user_id, study_minutes")
      .gt("study_minutes", 0)
      .gte("created_at", startDate.toISOString());

    const userTotals = new Map<string, { total: number; posts: number }>();
    (posts || []).forEach((row: any) => {
      const current = userTotals.get(row.user_id) || { total: 0, posts: 0 };
      current.total += row.study_minutes || 0;
      current.posts += 1;
      userTotals.set(row.user_id, current);
    });

    const sorted = Array.from(userTotals.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 50);

    const userIds = sorted.map(([id]) => id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, icon_url")
      .in("id", userIds);

    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

    setRanking(sorted.map(([userId, data], index) => ({
      rank: index + 1,
      user: profileMap.get(userId),
      total_minutes: data.total,
      post_count: data.posts,
      display_time: formatStudyTime(data.total),
    })));
    setDays(d);
    setLoading(false);
  };

  const getMedal = (rank: number) => {
    if (rank === 1) return { emoji: "🥇", bg: "bg-yellow-50 border-yellow-300", rankBg: "bg-yellow-100 text-yellow-700" };
    if (rank === 2) return { emoji: "🥈", bg: "bg-gray-50 border-gray-300", rankBg: "bg-gray-200 text-gray-600" };
    if (rank === 3) return { emoji: "🥉", bg: "bg-amber-50 border-amber-300", rankBg: "bg-amber-100 text-amber-700" };
    return { emoji: `#${rank}`, bg: "bg-white border-gray-100", rankBg: "bg-gray-100 text-gray-500" };
  };

  return (
    <AppShell unreadCount={unreadCount}>
      <div className="mx-4 my-4 space-y-3">
        {/* 期間選択 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1.5 flex">
          {[7, 30, 90, 365].map((d) => (
            <button key={d} onClick={() => fetchRankings(d)}
              className={`flex-1 py-2 text-sm font-bold rounded-lg cursor-pointer transition active:scale-95 ${
                days === d ? "bg-primary text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}>
              {d === 7 ? "週間" : d === 30 ? "月間" : d === 90 ? "3ヶ月" : "年間"}
            </button>
          ))}
        </div>

        {/* ランキングリスト */}
        <div className="space-y-2">
          {loading ? (
            <>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 bg-gray-200 rounded-full" />
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-gray-200 rounded w-24" />
                    <div className="h-3 bg-gray-200 rounded w-16" />
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-16" />
                </div>
              ))}
            </>
          ) : ranking.length > 0 ? (
            ranking.map((entry: any) => {
              const medal = getMedal(entry.rank);
              const isPodium = entry.rank <= 3;
              return (
                <Link key={entry.rank} href={`/profile/${entry.user?.id}`}
                  className={`block rounded-xl border p-4 transition hover:shadow-md active:scale-[0.98] ${medal.bg}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${medal.rankBg}`}>
                      {isPodium ? <span className="text-lg">{medal.emoji}</span> : medal.emoji}
                    </div>
                    <div className="avatar-frame">
                      {entry.user?.icon_url ? (
                        <img src={getOptimizedIconUrl(entry.user.icon_url, 120)} loading="lazy" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <i className="fas fa-user-circle text-3xl text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{entry.user?.display_name || "ユーザー"}</p>
                      <p className="text-xs text-gray-500">{entry.post_count}回の勉強 · {entry.display_time}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold ${isPodium ? "text-lg" : "text-sm"} ${entry.rank === 1 ? "text-yellow-600" : entry.rank === 2 ? "text-gray-500" : entry.rank === 3 ? "text-amber-700" : "text-primary"}`}>
                        {entry.display_time}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-12 text-center">
              <p className="text-gray-400 text-3xl mb-2">🏆</p>
              <p className="text-gray-500 text-sm">ランキングデータがありません</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
