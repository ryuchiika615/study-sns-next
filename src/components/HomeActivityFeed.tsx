"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function formatTime(minutes: number) {
  return minutes >= 60 ? `${Math.floor(minutes / 60)}時間${minutes % 60 ? `${minutes % 60}分` : ""}` : `${minutes}分`;
}

export default function HomeActivityFeed() {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const response = await fetch("/api/home/activity");
    if (response.ok) setActivities(await response.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const cheer = async (activityId: string) => {
    const response = await fetch("/api/home/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: activityId }) });
    if (!response.ok) return;
    const data = await response.json();
    setActivities((current) => current.map((activity) => activity.id === activityId ? { ...activity, cheeredByMe: true, cheerCount: data.count } : activity));
  };

  if (loading || activities.length === 0) return null;

  return <section className="mx-4 mb-4">
    <div className="mb-2 flex items-center justify-between"><div><h2 className="text-sm font-bold text-emerald-900"><i className="fas fa-bolt mr-1.5 text-emerald-500" />みんなの活動</h2><p className="mt-0.5 text-[11px] text-gray-500">グループ内の本文は公開されません。科目・時間だけが表示されます。</p></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">活動記録</span></div>
    <div className="space-y-2">{activities.map((activity) => {
      const isWorkout = activity.workoutMinutes > 0 && activity.studyMinutes < 1;
      const minutes = isWorkout ? activity.workoutMinutes : activity.studyMinutes;
      return <article key={activity.id} className={`rounded-xl border p-3 shadow-sm ${isWorkout ? "border-pink-200 bg-pink-50/70" : "border-emerald-200 bg-emerald-50/70"}`}>
        <div className="flex items-center gap-2"><Link href={`/profile/${activity.user?.id}`} className="shrink-0"><img src={activity.user?.icon_url || "/default-icon.png"} alt="" className="h-9 w-9 rounded-full object-cover" /></Link><div className="min-w-0 flex-1"><Link href={`/profile/${activity.user?.id}`} className="block truncate text-sm font-bold text-gray-900 no-underline">{activity.user?.display_name || activity.user?.username || "メンバー"}</Link><p className="mt-0.5 text-[11px] text-gray-500">グループの活動記録</p></div>{activity.isStudying && <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-700">🔥 勉強中</span>}</div>
        <div className="mt-3 flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold text-white ${isWorkout ? "bg-pink-500" : "bg-emerald-500"}`}>{isWorkout ? "運動" : "勉強"}</span><b className="text-sm text-gray-800">{activity.subject}　{formatTime(minutes)}</b></div>
        <div className="mt-3 flex items-center gap-3"><button disabled={activity.isMine || activity.cheeredByMe} onClick={() => cheer(activity.id)} className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 disabled:cursor-default disabled:opacity-60"><i className="fas fa-hands-clapping mr-1" />{activity.cheeredByMe ? "応援した" : "応援する"}{activity.cheerCount ? ` ${activity.cheerCount}` : ""}</button><Link href={`/profile/${activity.user?.id}`} className="text-xs font-bold text-gray-600 no-underline"><i className="fas fa-user mr-1" />プロフィール</Link></div>
      </article>;
    })}</div>
  </section>;
}
