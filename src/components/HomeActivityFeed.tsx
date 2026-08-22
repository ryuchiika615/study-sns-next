"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function formatTime(minutes: number) {
  return minutes >= 60 ? `${Math.floor(minutes / 60)}時間${minutes % 60 ? `${minutes % 60}分` : ""}` : `${minutes}分`;
}

// 公開掲示板の活動記録では、プロフィール写真を使わない。
// 同じ人は毎回同じマークになるので、活動の流れは追いやすい。
const activityMarks = ["📘", "🌱", "⚡", "🧠", "📝", "🎯", "🌙", "☀️", "🧩", "🪴", "🚀", "🎧"];
const activityColors = ["from-sky-500 to-blue-700", "from-emerald-500 to-teal-700", "from-violet-500 to-purple-700", "from-rose-500 to-pink-700", "from-amber-400 to-orange-600", "from-cyan-500 to-indigo-700"];

function activityHash(value: string) {
  return [...value].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 7);
}

function ActivityAvatar({ userId }: { userId: string }) {
  const hash = activityHash(userId);
  return <div title="公開掲示板用の匿名アイコン" className={`flex h-10 w-10 min-w-[40px] items-center justify-center rounded-full border-2 border-white bg-gradient-to-br text-lg shadow-sm ${activityColors[hash % activityColors.length]}`}>{activityMarks[hash % activityMarks.length]}</div>;
}

export function HomeActivityCard({ activity, onCheer }: { activity: any; onCheer?: (id: string, count: number) => void }) {
  const isWorkout = activity.workoutMinutes > 0 && activity.studyMinutes < 1;
  const minutes = isWorkout ? activity.workoutMinutes : activity.studyMinutes;
  const backgroundUrl = activity.user?.hasActivePro ? activity.user?.postCardBackgroundUrl : null;
  const style = backgroundUrl ? { backgroundImage: `linear-gradient(rgba(2,6,23,.72),rgba(2,6,23,.88)),url(${backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined;
  const cheer = async () => { const response = await fetch("/api/home/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: activity.id }) }); if (response.ok) { const data = await response.json(); onCheer?.(activity.id, data.count || 0); } };
  return <article style={style} className={`rounded-xl border p-3 shadow-sm ${isWorkout ? "border-pink-500 bg-gradient-to-br from-pink-950 to-slate-900" : "border-emerald-500 bg-gradient-to-br from-emerald-950 to-slate-900"}`}>
    <div className="flex items-center gap-2"><ActivityAvatar userId={activity.user?.id || activity.id} /><div className="min-w-0 flex-1">{activity.user?.currentTitle && <span className="mb-0.5 inline-block max-w-full truncate rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-2 py-0.5 text-[9px] font-bold text-white">{activity.user.currentTitle.rarity} {activity.user.currentTitle.name.replace("【称号】", "")}</span>}<div className="flex items-center gap-1.5"><Link href={`/profile/${activity.user?.id}`} className="block truncate text-sm font-bold text-white no-underline">{activity.user?.display_name || activity.user?.username || "メンバー"}</Link>{activity.user?.hasActivePro && <span className="shrink-0 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 px-1.5 py-0.5 text-[10px] font-bold text-white">👑 PRO</span>}</div><p className="mt-0.5 text-[11px] text-slate-300">グループの活動記録</p></div>{activity.isStudying && <span className="rounded-full bg-orange-400 px-2 py-1 text-[10px] font-bold text-slate-950">🔥 勉強中</span>}</div>
    <div className="mt-3 flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold text-white ${isWorkout ? "bg-pink-500" : "bg-emerald-500"}`}>{isWorkout ? "運動" : "勉強"}</span><b className="text-sm text-white">{activity.subject}　{formatTime(minutes)}</b></div>
    <div className="mt-3 flex items-center gap-3"><button disabled={activity.isMine || activity.cheeredByMe} onClick={cheer} className={`rounded-full border bg-white px-3 py-1.5 text-xs font-bold disabled:cursor-default disabled:opacity-60 ${isWorkout ? "border-pink-200 text-pink-700" : "border-emerald-200 text-emerald-700"}`}><i className="fas fa-hands-clapping mr-1" />{activity.cheeredByMe ? "応援した" : "応援する"}{activity.cheerCount ? ` ${activity.cheerCount}` : ""}</button><Link href={`/profile/${activity.user?.id}`} className="text-xs font-bold text-white no-underline"><i className="fas fa-user mr-1" />プロフィール</Link></div>
  </article>;
}

export default function HomeActivityFeed({ onCountChange, onActivitiesChange, compact = false, visible = true }: { onCountChange?: (count: number) => void; onActivitiesChange?: (activities: any[]) => void; compact?: boolean; visible?: boolean }) {
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
      onActivitiesChange?.(data.activities || []);
      setPage(data.currentPage || targetPage);
      setTotalPages(data.totalPages || 1);
      onCountChange?.(data.activities?.length || 0);
    } else onCountChange?.(0);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading && activities.length === 0) return null;
  if (activities.length === 0) return null;
  if (!visible) return null;

  return <section className="mx-4 mb-4">
    {!compact && <div className="mb-2 flex items-center justify-between"><div><h2 className="text-sm font-bold text-emerald-300"><i className="fas fa-bolt mr-1.5 text-emerald-400" />みんなの活動</h2><p className="mt-0.5 text-[11px] text-slate-300">グループ内の本文は公開されません。科目・時間だけが表示されます。</p></div><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">活動記録</span></div>}
    <div className="space-y-2">{activities.map((activity) => <HomeActivityCard key={activity.id} activity={activity} onCheer={(id, count) => setActivities(current => current.map(item => item.id === id ? { ...item, cheeredByMe: true, cheerCount: count } : item))} />)}</div>
    {!compact && totalPages > 1 && <div className="mt-3 flex items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3"><button disabled={page <= 1 || loading} onClick={() => load(page - 1)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-white disabled:opacity-40">&laquo; 前へ</button><span className="min-w-16 text-center text-sm font-bold text-white">{page} / {totalPages}</span><button disabled={page >= totalPages || loading} onClick={() => load(page + 1)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-white disabled:opacity-40">次へ &raquo;</button></div>}
  </section>;
}
