"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type TodayData = {
  tasks: { id: string; title: string; due_date: string }[];
  dueCards: number;
  weekMinutes: number;
};

const emptyData: TodayData = { tasks: [], dueCards: 0, weekMinutes: 0 };

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}分`;
  return `${Math.floor(minutes / 60)}時間${minutes % 60 ? `${minutes % 60}分` : ""}`;
}

export default function GroupTodayDashboard({ userId }: { userId: string }) {
  const [data, setData] = useState<TodayData>(emptyData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);

    Promise.all([
      supabase.from("todos").select("id,title,due_date").eq("user_id", userId).eq("completed", false).lte("due_date", today).order("due_date", { ascending: true }).limit(2),
      supabase.from("reviews").select("id").eq("user_id", userId).lte("due_date", today),
      supabase.from("posts").select("study_minutes").eq("user_id", userId).gte("created_at", weekStart.toISOString()),
    ]).then(([tasksResult, reviewsResult, postsResult]) => {
      setData({
        tasks: tasksResult.data || [],
        dueCards: reviewsResult.data?.length || 0,
        weekMinutes: (postsResult.data || []).reduce((sum: number, post: any) => sum + (post.study_minutes || 0), 0),
      });
      setLoading(false);
    });
  }, [userId]);

  const firstTask = data.tasks[0];
  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-400/35 bg-gradient-to-br from-emerald-950 via-slate-900 to-cyan-950 text-white shadow-lg">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black"><i className="fas fa-sparkles mr-1.5 text-amber-300" />今日のスタート</p>
            <p className="mt-1 text-xs leading-5 text-emerald-100">迷ったら、この3つから始めよう。</p>
          </div>
          <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold text-emerald-200">FREE</span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Link href="/tasks" className="rounded-xl border border-white/10 bg-white/10 p-3 text-white no-underline transition hover:bg-white/15">
            <p className="text-[10px] font-bold text-emerald-200">📌 STEP 1　タスク</p>
            <p className="mt-1 truncate text-sm font-bold">{loading ? "読み込み中..." : firstTask ? firstTask.title : "締切タスクはなし"}</p>
            <p className="mt-1 text-[11px] text-slate-300">{firstTask ? `${firstTask.due_date}まで${data.tasks.length > 1 ? `・あと${data.tasks.length - 1}件` : ""}` : "次の目標を決めよう"}</p>
          </Link>
          <Link href="/study" className="rounded-xl border border-white/10 bg-white/10 p-3 text-white no-underline transition hover:bg-white/15">
            <p className="text-[10px] font-bold text-sky-200">🧠 STEP 2　復習</p>
            <p className="mt-1 text-sm font-bold">{loading ? "読み込み中..." : data.dueCards ? `復習待ち ${data.dueCards}枚` : "復習待ちはなし"}</p>
            <p className="mt-1 text-[11px] text-slate-300">5分だけでも定着チェック</p>
          </Link>
          <a href="#group-post-form" className="rounded-xl border border-white/10 bg-white/10 p-3 text-white no-underline transition hover:bg-white/15">
            <p className="text-[10px] font-bold text-amber-200">🔥 STEP 3　集中する</p>
            <p className="mt-1 text-sm font-bold">グループに記録</p>
            <p className="mt-1 text-[11px] text-slate-300">今週 {formatMinutes(data.weekMinutes)} 積み上げ</p>
          </a>
        </div>
      </div>
      <Link href="/pro?from=group-today" className="flex items-center justify-between gap-3 border-t border-purple-300/20 bg-purple-500/15 px-4 py-3 text-white no-underline transition hover:bg-purple-500/25">
        <span><span className="block text-xs font-bold">🔒 Proなら試験日から今週の学習ペースを作れる</span><span className="mt-0.5 block text-[11px] text-purple-100">試験逆算プラン・長期分析・復習予測をまとめて使えます</span></span>
        <span className="shrink-0 text-xs font-bold text-purple-100">見る <i className="fas fa-chevron-right ml-1" /></span>
      </Link>
    </section>
  );
}
