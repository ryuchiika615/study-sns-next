"use client";

import { useState } from "react";

function defaultMonth() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function RankingRewardsPage() {
  const [month, setMonth] = useState(defaultMonth);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  const award = async () => {
    if (!confirm(`${month} の全体学習ランキング1位へ、称号とフレームを付与します。実行後は取り消せません。続けますか？`)) return;
    setRunning(true); setMessage("");
    const response = await fetch("/api/admin/ranking-rewards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ yearMonth: month }) });
    const data = await response.json();
    setRunning(false);
    if (!response.ok) { setMessage(`失敗：${data.error || "処理できませんでした"}`); return; }
    if (data.alreadyAwarded) { setMessage(`${month} 分はすでに付与済みです。`); return; }
    if (data.noData) { setMessage(`${month} は学習記録がないため、報酬を配れません。`); return; }
    setMessage(`${month} の1位に「${data.titleName}」と「${data.iconName}」を付与・装備しました。`);
  };

  return <div className="min-h-screen bg-gray-50 p-4"><div className="mx-auto max-w-xl"><a href="/admin" className="text-sm text-blue-600 hover:underline">← 管理者ダッシュボードへ</a><h1 className="mt-4 text-2xl font-black text-slate-900">👑 月間ランキング報酬</h1><p className="mt-1 text-sm leading-relaxed text-slate-600">その月の全体学習時間1位へ、月ごとの覇者称号と限定フレームを一度だけ付与します。</p><section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm"><label className="block text-sm font-bold text-slate-800">対象月</label><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-base" /><p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">同じ月に二重で渡すことはできません。たとえば2026-07なら「文月の覇者」と「向日葵オーラ」が渡ります。</p><button onClick={award} disabled={running || !month} className="mt-4 w-full rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-4 py-3 font-black text-white disabled:opacity-50">{running ? "集計・付与中…" : "この月の1位へ報酬を付与する"}</button>{message && <p className={`mt-4 rounded-xl p-3 text-sm font-bold ${message.startsWith("失敗") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{message}</p>}</section><section className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900"><b>自動配布について</b><br />毎日1回の自動確認を行い、月が変わった最初の実行時に前月分を配ります。すでに配布済みなら何もしません。</section></div></div>;
}
