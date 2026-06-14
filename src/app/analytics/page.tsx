"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import { PieChart, BarChart } from "@/components/Charts";
import { subjectColor, formatStudyTime } from "@/lib/utils";

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const supabase = createClient();

  const fetchData = useCallback(async (s?: string, e?: string) => {
    const uid = user?.id;
    if (!uid) return;
    const startStr = s || getDateNDaysAgo(29);
    const endStr = e || getTodayString();

    const { data: posts } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", uid)
      .gt("study_minutes", 0)
      .gte("created_at", startStr)
      .lte("created_at", endStr + "T23:59:59Z")
      .order("created_at", { ascending: true });

    if (!posts) return;

    const subjectMap = new Map<string, { total: number; count: number }>();
    const dayMap = new Map<string, number>();
    let totalMinutes = 0;

    posts.forEach((post: any) => {
      const sub = subjectMap.get(post.subject) || { total: 0, count: 0 };
      sub.total += post.study_minutes || 0;
      sub.count += 1;
      subjectMap.set(post.subject, sub);

      const day = post.created_at.split("T")[0];
      dayMap.set(day, (dayMap.get(day) || 0) + (post.study_minutes || 0));
      totalMinutes += post.study_minutes || 0;
    });

    const subjectRows = Array.from(subjectMap.entries())
      .map(([subject, sdata]) => ({
        subject,
        total: sdata.total,
        count: sdata.count,
        display_time: formatStudyTime(sdata.total),
        color: subjectColor(subject),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);

    const dayLabels: string[] = [];
    const dayData: number[] = [];
    const startD = new Date(startStr);
    const endD = new Date(endStr);
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0];
      dayLabels.push(`${d.getMonth() + 1}/${d.getDate()}`);
      dayData.push(dayMap.get(key) || 0);
    }

    setData({
      start: startStr,
      end: endStr,
      pie_labels: JSON.stringify(subjectRows.map((s) => s.subject)),
      pie_data: JSON.stringify(subjectRows.map((s) => s.total)),
      pie_colors: JSON.stringify(subjectRows.map((s) => s.color)),
      bar_labels: JSON.stringify(dayLabels),
      bar_data: JSON.stringify(dayData),
      subject_list: subjectRows,
      total_all_time_display: formatStudyTime(totalMinutes),
    });
    setStart(startStr);
    setEnd(endStr);
  }, [user?.id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: authData }) => {
      if (!authData.user) { router.push("/auth/login"); return; }
      setUser(authData.user);
      supabase.from("notifications").select("*", { count: "exact", head: true }).eq("recipient_id", authData.user.id).eq("is_read", false).then(({ count }) => {
        setUnreadCount(count || 0);
      });
    });
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

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
