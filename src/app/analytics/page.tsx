"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import { PieChart, BarChart } from "@/components/Charts";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: authData }) => {
      if (!authData.user) { router.push("/auth/login"); return; }
      setUser(authData.user);
      fetchData();
      fetch("/api/notifications").then((r) => r.ok && r.json()).then((d) => {
        if (d) setUnreadCount(d.unread_count);
      });
    });
  }, []);

  const fetchData = async (s?: string, e?: string) => {
    const params = new URLSearchParams();
    if (s) params.set("start", s);
    if (e) params.set("end", e);
    const res = await fetch(`/api/analytics?${params}`);
    if (res.ok) {
      const d = await res.json();
      setData(d);
      setStart(d.start);
      setEnd(d.end);
    }
  };

  const handleDateSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(start, end);
  };

  if (!data) return <AppShell><div className="p-4 text-center text-gray-500">読み込み中...</div></AppShell>;

  return (
    <AppShell unreadCount={unreadCount}>
      <div className="p-4 space-y-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary">{data.total_all_time_display}</p>
          <p className="text-sm text-gray-500">期間合計</p>
        </div>

        <form onSubmit={handleDateSearch} className="flex gap-2 items-center">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
            className="flex-1 rounded-lg border-gray-300 text-sm" />
          <span className="text-gray-500">~</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
            className="flex-1 rounded-lg border-gray-300 text-sm" />
          <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer">
            表示
          </button>
        </form>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold mb-3">科目別内訳</h3>
          <PieChart labels={data.pie_labels} data={data.pie_data} colors={data.pie_colors} />
          <div className="mt-3 space-y-1">
            {data.subject_list?.map((s: any) => (
              <div key={s.subject} className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                  {s.subject}
                </span>
                <span className="font-bold">{s.display_time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold mb-3">日別勉強時間</h3>
          <BarChart labels={data.bar_labels} data={data.bar_data} />
        </div>

        {/* ランキング（自分基準） */}
        {data.ranking?.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-bold mb-3">期間ランキング TOP5</h3>
            {data.ranking.slice(0, 5).map((entry: any) => (
              <div key={entry.rank} className="flex justify-between text-sm py-1">
                <span>#{entry.rank} {entry.label}</span>
                <span className="font-bold">{entry.display_time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
