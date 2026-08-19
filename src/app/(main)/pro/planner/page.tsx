"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function ProPlannerPage() {
  const [isPro, setIsPro] = useState<boolean | null>(null); const [plans, setPlans] = useState<any[]>([]);
  const [examName, setExamName] = useState(""); const [examDate, setExamDate] = useState(""); const [weeklyMinutes, setWeeklyMinutes] = useState("420"); const [message, setMessage] = useState("");
  const supabase = createClient();
  const load = async () => { const [status, { data }] = await Promise.all([fetch("/api/pro/status").then(r => r.json()), supabase.from("pro_study_plans").select("*").order("created_at", { ascending: false })]); setIsPro(status.isPro); setPlans(data || []); };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!examName.trim() || !examDate) return;
    setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMessage("ログイン状態を確認できません。ページを開き直してください。"); return; }
    const { error } = await supabase.from("pro_study_plans").insert({ user_id: user.id, exam_name: examName.trim(), exam_date: examDate, weekly_minutes: Number(weeklyMinutes) });
    if (error) setMessage(error.message); else { setExamName(""); setExamDate(""); setMessage("計画を作成しました。あとからでもここで確認できます。"); load(); }
  };
  if (isPro === false) return <div className="p-4 text-center"><p className="mt-12 text-lg font-bold">この機能はPro限定です</p><p className="mt-2 text-sm text-gray-500">試験日から、今週どれだけ進めるかを決めよう。</p><Link href="/pro" className="mt-5 inline-block rounded-full bg-purple-600 px-5 py-3 text-sm font-bold text-white no-underline">Proの詳細を見る</Link></div>;
  return <div className="mx-auto max-w-2xl space-y-4 p-4"><div><h1 className="text-xl font-bold">🎯 試験逆算プラン</h1><p className="mt-1 text-sm text-purple-600">👑 Pro機能を利用中</p></div><p className="text-sm text-gray-500">試験日と週の学習時間を入れると、残り期間のペースがわかります。</p><div className="rounded-xl border bg-white p-4 space-y-3"><input value={examName} onChange={e => setExamName(e.target.value)} placeholder="例：TOEIC、期末試験" className="w-full rounded-lg border-gray-300 text-sm" /><input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="w-full rounded-lg border-gray-300 text-sm" /><input type="number" min="30" value={weeklyMinutes} onChange={e => setWeeklyMinutes(e.target.value)} placeholder="週の学習時間（分）" className="w-full rounded-lg border-gray-300 text-sm" /><button onClick={save} className="w-full rounded-lg bg-purple-600 py-2 text-sm font-bold text-white">計画を作る</button>{message && <p className="text-xs text-purple-700">{message}</p>}</div>{plans.map(p => { const days = Math.max(0, Math.ceil((new Date(p.exam_date + "T00:00:00").getTime() - Date.now()) / 86400000)); const weeks = Math.max(1, Math.ceil(days / 7)); return <div key={p.id} className="rounded-xl border border-purple-100 bg-purple-50 p-4"><p className="font-bold">{p.exam_name}</p><p className="mt-1 text-sm">試験まであと <b className="text-purple-700">{days}日</b>（約{weeks}週間）</p><p className="mt-1 text-xs text-gray-600">週{p.weekly_minutes}分のペースで積み上げよう</p></div>; })}</div>;
}
