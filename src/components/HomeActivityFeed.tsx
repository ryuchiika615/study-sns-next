"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function formatTime(minutes: number) {
  return minutes >= 60 ? `${Math.floor(minutes / 60)}時間${minutes % 60 ? `${minutes % 60}分` : ""}` : `${minutes}分`;
}

export default function HomeActivityFeed({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = async (targetPage = 1) => {
    setLoading(true);
    const response = await fetch(`/api/home/activity?page=${targetPage}`);
    if (response.ok) {
      const data = await response.json();
      setActivities(data.activities || []);
      setPage(data.currentPage || targetPage);
      setTotalPages(data.totalPages || 1);
      onCountChange?.(data.activities?.length || 0);
    } else onCountChange?.(0);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const cheer = async (activityId: string) => {
    const response = await fetch("/api/home/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: activityId }) });
    if (!response.ok) return;
    const data = await response.json();
    setActivities((current) => current.map((activity) => activity.id === activityId ? { ...activity, cheeredByMe: true, cheerCount: data.count } : activity));
  };

  if (loading && activities.length === 0) return null;
  if (activities.length === 0) return null;

  return <section className="mx-4 mb-4">
    <div className="mb-2 flex items-center justify-between"><div><h2 className="text-sm font-bold text-emerald-300"><i className="fas fa-bolt mr-1.5 text-emerald-400" />みんなの活動</h2><p className="mt-0.5 text-[11px] text-slate-300">グループ内の本文は公開されません。科目・時間だけが表示されます。</p></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">活動記録</span></div>
    <div className="space-y-2">{activities.map((activity) => {
      const isWorkout = activity.workoutMinutes > 0 && activity.studyMinutes < 1;
      const minutes = isWorkout ? activity.workoutMinutes : activity.studyMinutes;
      return <article key={activity.id} className={`rounded-xl border p-3 shadow-sm ${isWorkout ? "border-pink-500 bg-gradient-to-br from-pink-950 to-slate-900" : "border-emerald-500 bg-gradient-to-br from-emerald-950 to-slate-900"}`}>
        <div className="flex items-center gap-2"><Link href={`/profile/${activity.user?.id}`} className="shrink-0"><img src={activity.user?.icon_url || "/default-icon.png"} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-white/70" /></Link><div className="min-w-0 flex-1"><Link href={`/profile/${activity.user?.id}`} className="block truncate text-sm font-bold text-white no-underline">{activity.user?.display_name || activity.user?.username || "メンバー"}</Link><p className="mt-0.5 text-[11px] text-slate-300">グループの活動記録</p></div>{activity.isStudying && <span className="rounded-full bg-orange-400 px-2 py-1 text-[10px] font-bold text-slate-950">🔥 勉強中</span>}</div>
        <div className="mt-3 flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold text-white ${isWorkout ? "bg-pink-500" : "bg-emerald-500"}`}>{isWorkout ? "運動" : "勉強"}</span><b className="text-sm text-white">{activity.subject}　{formatTime(minutes)}</b></div>
        <div className="mt-3 flex items-center gap-3"><button disabled={activity.isMine || activity.cheeredByMe} onClick={() => cheer(activity.id)} className={`rounded-full border bg-white px-3 py-1.5 text-xs font-bold disabled:cursor-default disabled:opacity-60 ${isWorkout ? "border-pink-200 text-pink-700" : "border-emerald-200 text-emerald-700"}`}><i className="fas fa-hands-clapping mr-1" />{activity.cheeredByMe ? "応援した" : "応援する"}{activity.cheerCount ? ` ${activity.cheerCount}` : ""}</button><Link href={`/profile/${activity.user?.id}`} className="text-xs font-bold text-white no-underline"><i className="fas fa-user mr-1" />プロフィール</Link></div>
      </article>;
    })}</div>
    {totalPages > 1 && <div className="mt-3 flex items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"><button disabled={page <= 1 || loading} onClick={() => load(page - 1)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-white disabled:opacity-40">&laquo; 前へ</button><span className="min-w-16 text-center text-sm font-bold text-white">{page} / {totalPages}</span><button disabled={page >= totalPages || loading} onClick={() => load(page + 1)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-white disabled:opacity-40">次へ &raquo;</button></div>}
  </section>;
}
