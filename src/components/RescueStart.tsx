"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import StudyTimer from "./StudyTimer";
import { createClient } from "@/lib/supabase";
import { rescueRecordRequest } from "@/lib/rescue-record";

export default function RescueStart({ userId }: { userId: string }) {
  const [task, setTask] = useState("");
  const [minutes, setMinutes] = useState("");
  const [destination, setDestination] = useState("");
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(`ryutter_rescue_draft_${userId}`) || "null");
      if (draft && Date.now() - draft.updatedAt < 7 * 86400000) {
        if (typeof draft.task === "string") setTask(draft.task.slice(0, 2000));
        if (typeof draft.minutes === "string") setMinutes(draft.minutes);
      }
    } catch { /* Storage is optional; private browsing must not block recording. */ }
    setDraftReady(true);
  }, [userId]);
  useEffect(() => {
    if (!draftReady || saved) return;
    try { localStorage.setItem(`ryutter_rescue_draft_${userId}`, JSON.stringify({ task, minutes, updatedAt: Date.now() })); } catch { /* optional draft */ }
  }, [task, minutes, userId, draftReady, saved]);
  useEffect(() => {
    let active = true;
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase.from("study_group_members").select("group_id").eq("user_id", userId);
      if (error) { if (active) setMessage("グループを読み込めませんでした。時間をおいてページを開き直してください。"); return; }
      const ids = (data || []).map(g => g.group_id);
      if (ids.length) {
        const { data: list, error: groupError } = await supabase.from("study_groups").select("id,name").in("id", ids);
        if (active) { setGroups(list || []); if (groupError) setMessage("グループを読み込めませんでした。"); }
      }
    })().catch(() => { if (active) setMessage("通信に失敗しました。ページを開き直してください。"); });
    return () => { active = false; };
  }, [userId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const supabase = createClient();
      const request = rescueRecordRequest(task, minutes, destination);
      const { error } = await supabase.rpc(request.name, request.args);
      if (error) throw error;
      try { localStorage.removeItem(`ryutter_rescue_draft_${userId}`); } catch { /* optional draft */ }
      setSaved(true);
      window.dispatchEvent(new CustomEvent("post-created"));
    } catch (error: any) { setMessage(error.message || "保存できませんでした。通信状況と投稿一覧を確認してから再試行してください。"); }
    finally { lock.current = false; setBusy(false); }
  }

  return <div className="mx-auto max-w-2xl space-y-5 p-4 pb-24">
    <header className="rounded-2xl bg-purple-950 p-6 text-white"><p className="text-sm">締切レスキュー → RYUTTER</p><h1 className="mt-2 text-2xl font-bold">今日は、1件だけ始めよう。</h1><p className="mt-3 text-sm leading-6">25分は目安。5分でも大丈夫。シートの内容は自動で読み込まれません。</p></header>
    {saved ? <section className="rounded-2xl border border-green-300 bg-white p-6" aria-live="polite"><h2 className="text-xl font-bold text-green-700">今日の勉強を記録しました！</h2><p className="mt-3">シートの残り時間を減らし、終わった課題は「完了」にしましょう。明日もこのページから始められます。</p><div className="mt-5 flex flex-wrap gap-4"><Link href="/profile/edit" className="font-bold text-blue-600">記録を確認 →</Link><Link href="/groups" className="font-bold text-blue-600">仲間と続ける →</Link><Link href="/tasks" className="font-bold text-blue-600">次の課題を管理 →</Link></div><p className="mt-5 text-sm">試験までの計画を立てたくなったら、<Link href="/pro?from=study-route" className="text-purple-700 underline">Proの試験逆算プラン</Link>も使えます。基本の記録は無料のままです。</p></section> : <>
      <section className="rounded-2xl border border-gray-200 bg-white p-5"><h2 className="font-bold">1. 今日の1件を選ぶ</h2><label className="mt-3 block text-sm">取り組むこと（任意・保存すると投稿本文になります）<input maxLength={2000} value={task} onChange={e => setTask(e.target.value)} className="mt-2 w-full rounded-lg border-gray-300" placeholder="例：英語レポートの見出しを3つ書く" /></label><p className="mt-2 text-xs text-gray-500">個人情報や公開したくない課題名は入れず、「課題に取り組む」でもOK。</p></section>
      <section className="rounded-2xl border border-gray-200 bg-white p-5"><h2 className="mb-3 font-bold">2. タイマーで取り組む</h2><StudyTimer onStop={n => setMinutes(n > 0 ? String(n) : "")} /><p className="mt-2 text-xs text-gray-500">終了すると時間が下に入ります。すでに勉強した場合は直接入力できます。</p></section>
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5"><h2 className="font-bold">3. 公開先を確認して記録する</h2><label className="block text-sm">実際に勉強した時間（分）<input required type="number" min={1} max={1440} step={1} value={minutes} onChange={e => setMinutes(e.target.value)} className="mt-2 block w-full rounded-lg border-gray-300" /></label><label className="block text-sm">投稿先<select required value={destination} onChange={e => setDestination(e.target.value)} className="mt-2 block w-full rounded-lg border-gray-300"><option value="">公開先を選んでください</option><option value="public">公開の活動記録（全ユーザー）</option>{groups.map(g => <option key={g.id} value={g.id}>グループ：{g.name}</option>)}</select></label><p className="text-sm text-gray-600">{destination === "public" ? "本文と勉強時間を全ユーザーが閲覧できます。" : destination ? "本文は選んだグループ内に投稿されます。活動時間は既存のプロフィール・ランキング等にも反映されます。" : "保存ボタンを押すまで投稿しません。"} このページからの記録では投稿通知を送りません。</p><button disabled={busy} className="w-full rounded-xl bg-purple-700 p-3 font-bold text-white disabled:opacity-50">{busy ? "保存中…" : "選んだ公開先に勉強を記録する"}</button></form>
    </>}
    {message && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{message}</p>}
    <footer className="flex flex-wrap gap-4 text-sm"><Link href="/free/deadline-rescue" className="text-blue-600 underline">シート・使い方へ戻る</Link><Link href="/groups" className="text-blue-600 underline">グループを探す・作る</Link><Link href="/" className="text-blue-600 underline">案内をスキップ</Link></footer>
  </div>;
}
