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

export default function GroupTodayDashboard({ userId, groupId }: { userId: string; groupId: string }) {
  const [data, setData] = useState<TodayData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [showMinimizeConfirm, setShowMinimizeConfirm] = useState(false);
  const [showDisplayGuide, setShowDisplayGuide] = useState(false);
  const storageKey = `ryutter:group-today-dashboard:${userId}:${groupId}`;

  useEffect(() => {
    setMinimized(window.localStorage.getItem(storageKey) === "minimized");
  }, [storageKey]);

  useEffect(() => {
    fetch("/api/pro/status")
      .then((response) => (response.ok ? response.json() : null))
      .then((status) => setIsPro(Boolean(status?.isPro)))
      .catch(() => setIsPro(false));
  }, []);

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
  const minimize = () => {
    window.localStorage.setItem(storageKey, "minimized");
    setMinimized(true);
    setShowMinimizeConfirm(false);
  };
  const restore = () => {
    window.localStorage.removeItem(storageKey);
    setMinimized(false);
  };

  if (minimized) return <>
    <section className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/30 bg-slate-900 px-4 py-3 text-white shadow-sm">
      <div className="min-w-0"><p className="text-sm font-black">✨ 今日のスタート <span className="ml-1 rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-300">最小表示中</span></p><p className="mt-0.5 text-[11px] text-slate-400">表示設定からいつでも戻せます。</p></div>
      <div className="flex shrink-0 gap-2"><button onClick={() => setShowDisplayGuide(true)} className="rounded-lg border border-slate-600 px-2.5 py-2 text-xs font-bold text-slate-200">表示設定</button><button onClick={restore} className="rounded-lg bg-emerald-500 px-2.5 py-2 text-xs font-bold text-white">戻す</button></div>
    </section>
    {showDisplayGuide && <DisplayGuide onClose={() => setShowDisplayGuide(false)} onRestore={restore} />}
  </>;

  return (
    <>
    <section className="overflow-hidden rounded-2xl border border-emerald-400/35 bg-gradient-to-br from-emerald-950 via-slate-900 to-cyan-950 text-white shadow-lg">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black"><i className="fas fa-sparkles mr-1.5 text-amber-300" />今日のスタート</p>
            <p className="mt-1 text-xs leading-5 text-emerald-100">迷ったら、この3つから始めよう。</p>
          </div>
          <div className="flex items-center gap-2"><span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold text-emerald-200">FREE</span><button onClick={() => setShowMinimizeConfirm(true)} className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-white/20">− 最小化</button></div>
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
      {isPro === true ? <div className="grid gap-2 border-t border-emerald-300/20 bg-emerald-500/10 p-3 sm:grid-cols-2">
        <Link href="/pro/planner" className="flex items-center justify-between rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-700 px-3 py-3 text-sm font-bold text-white no-underline transition hover:brightness-110"><span>🎯 試験逆算プランを開く</span><span>→</span></Link>
        <Link href="/study/stats" className="flex items-center justify-between rounded-xl border border-cyan-300/30 bg-cyan-950/70 px-3 py-3 text-sm font-bold text-cyan-50 no-underline transition hover:border-cyan-200"><span>📈 詳細な学習分析</span><span>→</span></Link>
      </div> : isPro === false ? <Link href="/pro?from=group-today" className="flex items-center justify-between gap-3 border-t border-purple-300/20 bg-purple-500/15 px-4 py-3 text-white no-underline transition hover:bg-purple-500/25">
        <span><span className="block text-xs font-bold">🔒 Proなら試験日から今週の学習ペースを作れる</span><span className="mt-0.5 block text-[11px] text-purple-100">試験逆算プラン・長期分析・復習予測をまとめて使えます</span></span>
        <span className="shrink-0 text-xs font-bold text-purple-100">見る <i className="fas fa-chevron-right ml-1" /></span>
      </Link> : <div className="border-t border-slate-600 bg-slate-900/70 px-4 py-3 text-xs text-slate-300">Proの利用状況を確認しています…</div>}
    </section>
    {showMinimizeConfirm && <div className="fixed inset-0 z-[90] flex items-end bg-slate-950/80 p-4 sm:items-center"><section style={{ backgroundColor: "#17233a", color: "#f8fafc" }} className="mx-auto w-full max-w-md rounded-2xl border border-slate-500 p-5 shadow-2xl"><p className="text-lg">✨</p><h2 className="mt-1 text-base font-black text-white">今日のスタートを最小化しますか？</h2><p className="mt-2 text-sm leading-6 text-slate-200">このグループでは小さい表示になります。投稿やタイマーには影響しません。いつでも「表示設定」または「戻す」から元に戻せます。</p><div className="mt-4 flex gap-2"><button onClick={() => setShowMinimizeConfirm(false)} className="flex-1 rounded-xl border border-slate-300 bg-slate-700 py-3 text-sm font-bold text-white">キャンセル</button><button onClick={minimize} className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white">最小化する</button></div></section></div>}
    </>
  );
}

function DisplayGuide({ onClose, onRestore }: { onClose: () => void; onRestore: () => void }) {
  return <div className="fixed inset-0 z-[90] flex items-end bg-slate-950/80 p-4 sm:items-center"><section style={{ backgroundColor: "#17233a", color: "#f8fafc" }} className="mx-auto w-full max-w-md rounded-2xl border border-slate-500 p-5 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-base font-black text-white">⚙️ 今日のスタートの表示設定</h2><button onClick={onClose} className="text-sm font-bold text-slate-200">閉じる</button></div><p className="mt-2 text-sm leading-6 text-slate-200">最小化しても、今日の案内は消えていません。下の小さいバーからいつでも元に戻せます。</p><div className="mt-4 rounded-2xl bg-slate-800 p-3"><p className="text-center text-[10px] font-bold text-slate-300">表示イメージ</p><div className="mt-2 rounded-xl bg-gradient-to-br from-emerald-900 to-cyan-950 p-3 text-white shadow"><p className="text-xs font-black">✨ 今日のスタート</p><div className="mt-2 grid grid-cols-3 gap-1"><span className="h-6 rounded bg-white/15" /><span className="h-6 rounded bg-white/15" /><span className="h-6 rounded bg-white/15" /></div></div><p className="my-2 text-center text-xl text-slate-400">↓</p><div className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-white"><span className="text-xs font-bold">✨ 今日のスタート　最小表示中</span><span className="rounded bg-emerald-500 px-2 py-1 text-[10px] font-bold">戻す</span></div></div><button onClick={() => { onRestore(); onClose(); }} className="mt-4 w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white">通常表示に戻す</button></section></div>;
}
