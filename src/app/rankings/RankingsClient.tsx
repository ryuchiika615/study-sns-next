"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";

export default function RankingsClient({ initialRanking, initialDays, unreadCount }: {
  initialRanking: any[];
  initialDays: number;
  unreadCount: number;
}) {
  const [ranking, setRanking] = useState(initialRanking);
  const [days, setDays] = useState(initialDays);

  const fetchRankings = async (d: number) => {
    const res = await fetch(`/api/rankings?days=${d}`);
    if (res.ok) {
      const data = await res.json();
      setRanking(data.ranking);
    }
    setDays(d);
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "text-yellow-500";
    if (rank === 2) return "text-gray-400";
    if (rank === 3) return "text-amber-700";
    return "text-gray-500";
  };

  return (
    <AppShell unreadCount={unreadCount}>
      <div className="p-4">
        <div className="flex justify-center gap-2 mb-4">
          {[7, 30, 90, 365].map((d) => (
            <button key={d} onClick={() => fetchRankings(d)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold cursor-pointer ${
                days === d ? "bg-primary text-white" : "bg-gray-100 text-gray-700"
              }`}>
              {d === 7 ? "週間" : d === 30 ? "月間" : d === 90 ? "3ヶ月" : "年間"}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {ranking.map((entry: any) => (
            <div key={entry.rank} className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 p-3">
              <span className={`text-xl font-bold w-8 text-center ${getRankStyle(entry.rank)}`}>
                {entry.rank}
              </span>
              <div className="avatar-frame">
                {entry.user?.icon_url ? (
                  <img src={entry.user.icon_url} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <i className="fas fa-user-circle text-3xl text-gray-300" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">{entry.user?.display_name || "ユーザー"}</p>
                <p className="text-xs text-gray-500">{entry.display_time} · {entry.post_count}回</p>
              </div>
              <span className="text-primary font-bold">{entry.display_time}</span>
            </div>
          ))}
        </div>

        {ranking.length === 0 && (
          <p className="text-center text-gray-500 py-10">ランキングデータがありません</p>
        )}
      </div>
    </AppShell>
  );
}
