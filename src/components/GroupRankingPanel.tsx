"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { formatStudyTime, getOptimizedIconUrl } from "@/lib/utils";
import XShareButton from "@/components/XShareButton";

const periods = [7, 30, 90, 365];

export default function GroupRankingPanel({ groupId, userId }: { groupId: string; userId: string }) {
  const supabase = createClient();
  const [days, setDays] = useState(7);
  const [workoutMode, setWorkoutMode] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<any[]>([]);

  const load = async (period: number, workout: boolean) => {
    setLoading(true);
    const field = workout ? "workout_minutes" : "study_minutes";
    const since = new Date(Date.now() - period * 86400000).toISOString();
    const { data: posts } = await supabase.from("posts").select(`user_id, ${field}`)
      .eq("group_id", groupId).gt(field, 0).gte("created_at", since);
    const totals = new Map<string, { total: number; count: number }>();
    (posts || []).forEach((post: any) => {
      const current = totals.get(post.user_id) || { total: 0, count: 0 };
      current.total += post[field] || 0; current.count += 1; totals.set(post.user_id, current);
    });
    const sorted = [...totals.entries()].sort((a, b) => b[1].total - a[1].total);
    const ids = sorted.map(([id]) => id);
    const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, display_name, username, icon_url").in("id", ids) : { data: [] };
    const profileMap = new Map((profiles || []).map((profile: any) => [profile.id, profile]));
    setRanking(sorted.map(([id, value], index) => ({ rank: index + 1, user: profileMap.get(id), total: value.total, count: value.count })));
    setLoading(false);
  };

  useEffect(() => { load(7, false); fetch("/api/pro/status").then(async (response) => response.ok && setIsPro(Boolean((await response.json()).isPro))).catch(() => {}); }, [groupId]);

  const changeMode = (workout: boolean) => { setWorkoutMode(workout); load(days, workout); };
  const changePeriod = (period: number) => { if (period > 7 && !isPro) { window.location.assign("/pro?from=group-ranking-period"); return; } setDays(period); load(period, workoutMode); };
  const myEntry = ranking.find((entry) => entry.user?.id === userId);
  const periodLabel = days === 7 ? "今週" : days === 30 ? "今月" : days === 90 ? "直近3か月" : "今年";

  return <section className="space-y-3">
    <div className="rounded-xl bg-slate-800 p-1.5 shadow-sm"><div className="flex"><button onClick={() => changeMode(false)} className={`flex-1 rounded-lg py-2 text-sm font-bold ${!workoutMode ? "bg-blue-500 text-white" : "text-slate-300"}`}>勉強</button><button onClick={() => changeMode(true)} className={`flex-1 rounded-lg py-2 text-sm font-bold ${workoutMode ? "bg-pink-500 text-white" : "text-slate-300"}`}>筋トレ</button></div></div>
    <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold text-white">🏆 {periodLabel}のグループランキング</p>{myEntry && <XShareButton shareType="ranking" entityId={`group:${groupId}:${days}:${workoutMode ? "workout" : "study"}:${myEntry.rank}`} text={`🏆 ${periodLabel}のグループランキング\n\n${myEntry.rank}位 · ${workoutMode ? "筋トレ" : "勉強"}時間：${formatStudyTime(myEntry.total)}\n\nリュッターで今日も積み上げ中！\n\n#リュッター #${workoutMode ? "筋トレ記録" : "勉強記録"}`} sharePath="/rankings" />}</div>
    <div className="rounded-xl bg-slate-800 p-1.5 shadow-sm"><div className="flex">{periods.map((period) => <button key={period} onClick={() => changePeriod(period)} className={`flex-1 rounded-lg py-2 text-xs font-bold ${days === period ? "bg-blue-500 text-white" : "text-slate-300"}`}>{period > 7 && !isPro && <i className="fas fa-lock mr-1 text-[10px]" />}{period === 7 ? "週間" : period === 30 ? "月間" : period === 90 ? "3か月" : "年間"}</button>)}</div></div>
    {!isPro && <p className="text-center text-[11px] text-slate-300"><i className="fas fa-lock mr-1" />月間・3か月・年間のグループランキングはPro限定です。</p>}
    <div className="space-y-2">{loading ? <div className="rounded-xl bg-slate-800 p-5 text-center text-sm text-slate-300">読み込み中...</div> : ranking.length ? ranking.map((entry) => { const podium = entry.rank <= 3; const medal = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`; return <Link key={entry.user?.id || entry.rank} href={`/profile/${entry.user?.id}`} className={`flex items-center gap-3 rounded-xl border p-3 no-underline ${podium ? "border-amber-300 bg-amber-50 text-slate-900" : "border-slate-700 bg-slate-800 text-white"}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-sm font-bold">{medal}</span>{entry.user?.icon_url ? <img src={getOptimizedIconUrl(entry.user.icon_url, 80)} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <i className="fas fa-user-circle text-3xl text-slate-400" />}<div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{entry.user?.display_name || entry.user?.username || "メンバー"}</p><p className={`text-xs ${podium ? "text-slate-500" : "text-slate-300"}`}>{entry.count}回の{workoutMode ? "筋トレ" : "勉強"}・{formatStudyTime(entry.total)}</p></div><b className={`shrink-0 text-sm ${podium ? "text-amber-700" : "text-blue-300"}`}>{formatStudyTime(entry.total)}</b></Link>; }) : <div className="rounded-xl bg-slate-800 py-10 text-center text-sm text-slate-300">まだ記録がありません</div>}</div>
  </section>;
}
