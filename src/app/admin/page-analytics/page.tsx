"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

type UserAnalytics = {
  user_id: string;
  display_name: string;
  username: string;
  total_seconds: number;
  percentages: Record<string, number>;
  formatted_time: string;
  short_time: string;
};

type OverallStat = {
  path: string;
  seconds: number;
  percentage: number;
  formatted_time: string;
};

export default function PageAnalyticsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [overall, setOverall] = useState<OverallStat[]>([]);
  const [users, setUsers] = useState<UserAnalytics[]>([]);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [formattedTotal, setFormattedTotal] = useState("");
  const [range, setRange] = useState("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const fetchData = async (r: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/page-analytics?range=${r}`);
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      const data = await res.json();
      setOverall(data.overall || []);
      setUsers(data.users || []);
      setTotalSeconds(data.total_seconds || 0);
      setFormattedTotal(data.formatted_total || "");
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      if (!p?.is_admin) { setError("管理者のみアクセスできます"); return; }
      setProfile(p);
    });
    fetchData(range);
  }, []);

  const handleRangeChange = (r: string) => {
    setRange(r);
    fetchData(r);
  };

  const allPaths = [...new Set(overall.map(o => o.path))];

  const pathColors: Record<string, string> = {
    "ホーム": "bg-blue-500",
    "通知": "bg-green-500",
    "設定": "bg-gray-500",
    "プロフィール": "bg-purple-500",
    "プロフィール設定": "bg-indigo-500",
    "ガチャ": "bg-yellow-500",
    "ショップ": "bg-orange-500",
    "ランキング": "bg-red-500",
    "分析": "bg-cyan-500",
    "実績": "bg-pink-500",
    "チャレンジ": "bg-rose-500",
    "タスク": "bg-teal-500",
    "習慣": "bg-emerald-500",
    "投稿詳細": "bg-violet-500",
  };

  const pathIcons: Record<string, string> = {
    "ホーム": "🏠",
    "通知": "🔔",
    "設定": "⚙️",
    "プロフィール": "👤",
    "プロフィール設定": "🖊️",
    "ガチャ": "🎰",
    "ショップ": "🛒",
    "ランキング": "🏆",
    "分析": "📊",
    "実績": "🎖️",
    "チャレンジ": "🔥",
    "タスク": "✅",
    "習慣": "🔄",
    "投稿詳細": "📝",
  };

  const rangeLabels: Record<string, string> = {
    today: "今日",
    week: "今週",
    month: "今月",
    all: "全期間",
  };

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
        <Link href="/admin" className="absolute left-4 top-6 text-yellow-600 hover:text-yellow-400 text-lg">
          <i className="fas fa-arrow-left" />
        </Link>
        <h1 className="text-3xl text-yellow-600 font-serif tracking-wider" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
          ページ分析
        </h1>
        <p className="text-sm text-yellow-600 tracking-widest mt-1">ユーザーの画面遷移を可視化</p>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(rangeLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleRangeChange(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold cursor-pointer transition ${
                range === key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="text-xs text-gray-400 ml-auto">
            総滞在 {formattedTotal}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : totalSeconds === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <p>まだページビューデータがありません</p>
            <p className="text-xs mt-1">ユーザーがページを閲覧すると自動で蓄積されます</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-bold text-lg mb-4">📊 全体のページ滞在時間分布</h2>
              <div className="space-y-2">
                {overall.map((o) => (
                  <div key={o.path} className="flex items-center gap-3">
                    <span className="w-8 text-center text-lg">{pathIcons[o.path] || "🔗"}</span>
                    <span className="w-28 text-sm font-medium truncate">{o.path}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${pathColors[o.path] || "bg-gray-400"}`}
                        style={{ width: `${Math.max(o.percentage, 1)}%` }}
                      />
                    </div>
                    <span className="w-20 text-right text-sm text-gray-500">
                      {o.percentage}%
                    </span>
                    <span className="w-24 text-right text-xs text-gray-400">
                      {o.formatted_time}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-bold text-lg">👥 ユーザー別ページ滞在割合</h2>
                <p className="text-xs text-gray-400 mt-0.5">各ユーザーの滞在時間の割合（%）</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500">
                      <th className="p-3 text-left whitespace-nowrap min-w-[140px]">ユーザー</th>
                      <th className="p-3 text-right whitespace-nowrap">滞在時間</th>
                      {allPaths.map(p => (
                        <th key={p} className="p-3 text-center whitespace-nowrap">{pathIcons[p] || "🔗"}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.user_id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0 overflow-hidden">
                              {u.display_name?.charAt(0) || "?"}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-xs truncate">{u.display_name}</div>
                              <div className="text-[10px] text-gray-400">@{u.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right text-xs text-gray-500 whitespace-nowrap">
                          {u.short_time}
                        </td>
                        {allPaths.map(p => (
                          <td key={p} className="p-3 text-center whitespace-nowrap">
                            {u.percentages[p] !== undefined ? (
                              <span className={`font-bold text-xs ${
                                u.percentages[p] >= 50 ? "text-blue-600" :
                                u.percentages[p] >= 20 ? "text-blue-500" :
                                u.percentages[p] >= 5 ? "text-gray-700" : "text-gray-400"
                              }`}>
                                {u.percentages[p]}%
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {users.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  表示するユーザーがいません
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
