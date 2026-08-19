"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase";
const PieChart = dynamic(() => import("@/components/Charts").then(m => m.PieChart), { ssr: false });
const BarChart = dynamic(() => import("@/components/Charts").then(m => m.BarChart), { ssr: false });
const WeeklyChart = dynamic(() => import("@/components/WeeklyChart").then(m => ({ default: m.WeeklyChart })), {
  ssr: false,
  loading: () => <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />,
});
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
  const [workoutMode, setWorkoutMode] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const fetchData = useCallback(async (s?: string, e?: string, isWorkout?: boolean) => {
    const uid = user?.id;
    if (!uid) return;
    const startStr = s || getDateNDaysAgo(29);
    const endStr = e || getTodayString();
    const useWorkout = isWorkout ?? workoutMode;
    const timeField = useWorkout ? "workout_minutes" : "study_minutes";

    const { data: posts } = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", uid)
      .gt(timeField, 0)
      .gte("created_at", startStr)
      .lte("created_at", endStr + "T23:59:59Z")
      .order("created_at", { ascending: true });

    if (!posts) return;

    const subjectMap = new Map<string, { total: number; count: number }>();
    const dayMap = new Map<string, number>();
    let totalMinutes = 0;

    posts.forEach((post: any) => {
      const sub = subjectMap.get(post.subject) || { total: 0, count: 0 };
      sub.total += post[timeField] || 0;
      sub.count += 1;
      subjectMap.set(post.subject, sub);

      const day = post.created_at.split("T")[0];
      dayMap.set(day, (dayMap.get(day) || 0) + (post[timeField] || 0));
      totalMinutes += post[timeField] || 0;
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

    const weeklyLabels: string[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      weeklyLabels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    }

    const weeklySubjects = new Map<string, number[]>();
    posts.forEach((post: any) => {
      const postDate = post.created_at.split("T")[0];
      const idx = weeklyLabels.findIndex((_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split("T")[0] === postDate;
      });
      if (idx >= 0) {
        if (!weeklySubjects.has(post.subject)) {
          weeklySubjects.set(post.subject, new Array(7).fill(0));
        }
        weeklySubjects.get(post.subject)![idx] += post[timeField] || 0;
      }
    });

    let weeklyDatasets: { label: string; data: number[]; backgroundColor: string }[];
    if (weeklySubjects.size === 0) {
      weeklyDatasets = [{ label: useWorkout ? "筋トレ時間" : "勉強時間", data: new Array(7).fill(0), backgroundColor: useWorkout ? "#ec4899" : "#1877f2" }];
    } else {
      weeklyDatasets = Array.from(weeklySubjects.entries()).map(([subject, data]) => ({
        label: subject,
        data,
        backgroundColor: subjectColor(subject),
      }));
    }

    setData({
      start: startStr,
      end: endStr,
      pie_labels: JSON.stringify(subjectRows.map((s) => `${s.subject} (${s.display_time})`)),
      pie_data: JSON.stringify(subjectRows.map((s) => s.total)),
      pie_colors: JSON.stringify(subjectRows.map((s) => s.color)),
      bar_labels: JSON.stringify(dayLabels),
      bar_data: JSON.stringify(dayData),
      subject_list: subjectRows,
      total_all_time_display: formatStudyTime(totalMinutes),
      weeklyLabels,
      weeklyDatasets,
    });
    setStart(startStr);
    setEnd(endStr);
  }, [user?.id, workoutMode]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: authData }) => {
      if (!authData.user) { router.push("/auth/login"); return; }
      setUser(authData.user);
      // unread count fetched by AppShell
    });
    fetch("/api/pro/status").then(async (res) => res.ok && setIsPro(Boolean((await res.json()).isPro))).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, workoutMode]);

  const handleDateSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPro) { router.push("/pro?from=analytics"); return; }
    fetchData(start, end, workoutMode);
  };

  if (!data) return <div className="p-4 text-center text-gray-500 py-12">読み込み中...</div>;

  return (
    <div className="mx-4 my-4 space-y-3">
        {/* 勉強/筋トレトグル */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1.5 flex">
          <button onClick={() => setWorkoutMode(false)}
            className={`flex-1 py-2 text-sm font-bold rounded-lg cursor-pointer transition active:scale-95 ${
              !workoutMode ? "bg-primary text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}>
            勉強
          </button>
          <button onClick={() => setWorkoutMode(true)}
            className={`flex-1 py-2 text-sm font-bold rounded-lg cursor-pointer transition active:scale-95 ${
              workoutMode ? "bg-pink-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}>
            筋トレ
          </button>
        </div>

        {/* 合計時間 */}
        <div className={`rounded-xl shadow-sm p-5 text-center text-white ${
          workoutMode
            ? "bg-gradient-to-r from-pink-900 to-pink-700"
            : "bg-gradient-to-r from-blue-900 to-blue-700"
        }`}>
          <p className={`text-sm ${workoutMode ? "text-pink-200" : "text-blue-200"}`}>期間合計</p>
          <p className="text-3xl font-bold mt-1">{data.total_all_time_display}</p>
        </div>

        {/* 日付範囲 */}
        {isPro ? <form onSubmit={handleDateSearch} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="mb-2 text-xs font-bold text-purple-700"><i className="fas fa-crown mr-1" />Pro：好きな期間で分析</p>
          <div className="flex items-center gap-2"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="flex-1 rounded-lg border-gray-200 text-sm bg-gray-50 px-3 py-2" /><span className="text-gray-400 text-sm">〜</span><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="flex-1 rounded-lg border-gray-200 text-sm bg-gray-50 px-3 py-2" /><button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer">表示</button></div>
        </form> : <button onClick={() => router.push("/pro?from=analytics")} className="w-full rounded-xl border border-purple-200 bg-purple-50 p-4 text-left cursor-pointer"><p className="text-sm font-bold text-purple-900"><i className="fas fa-lock mr-1.5" />好きな期間で詳しく分析</p><p className="mt-1 text-xs text-purple-700">30日より前の記録や、科目別の週次推移を見るにはProへ</p></button>}

        {/* 科目別内訳 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-bold text-sm text-gray-500 mb-4"><i className="fas fa-chart-pie mr-1.5" />科目別内訳</h3>
          <PieChart labels={data.pie_labels} data={data.pie_data} colors={data.pie_colors} />
          <div className="mt-4 space-y-2">
            {data.subject_list?.map((s: any) => (
              <div key={s.subject} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="text-gray-700">{s.subject}</span>
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{s.count}回</span>
                  <span className="font-bold text-primary">{s.display_time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 日別勉強時間 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-bold text-sm text-gray-500 mb-4"><i className="fas fa-chart-bar mr-1.5" />日別{workoutMode ? "筋トレ" : "勉強"}時間</h3>
          <BarChart labels={data.bar_labels} data={data.bar_data} />
        </div>

        {isPro && data.weeklyLabels?.length > 0 && (
          <WeeklyChart labels={data.weeklyLabels} datasets={data.weeklyDatasets.map((d: any) => ({
            ...d,
            backgroundColor: d.backgroundColor,
          }))} />
        )}
      </div>
  );
}
