"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { parseTaskImport } from "@/lib/task-import";

export function TaskImportClient({ userId, existingCount, isPro }: { userId: string; existingCount: number; isPro: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const parsed = useMemo(() => parseTaskImport(text), [text]);
  const remaining = isPro ? Infinity : Math.max(0, 5 - existingCount);

  const loadPreview = () => {
    const allowed = parsed.tasks.slice(0, remaining);
    setSelected(new Set(allowed.map((_, index) => index)));
    setMessage(parsed.tasks.length > remaining ? `FREEでは残り${remaining}件まで登録できます。` : "");
  };

  const save = async () => {
    const tasks = parsed.tasks.filter((_, index) => selected.has(index)).slice(0, remaining);
    if (!tasks.length) return setMessage("登録する課題を選んでください。");
    setSaving(true); setMessage("");
    const supabase = createClient();
    const rows = tasks.map((task, index) => ({ ...task, user_id: userId, sort_order: existingCount + index + 1 }));
    const { error } = await supabase.from("todos").insert(rows);
    setSaving(false);
    if (error) return setMessage(error.message.includes("FREE") ? error.message : "登録に失敗しました。内容を確認してください。");
    router.push("/tasks?imported=1"); router.refresh();
  };

  return <div className="space-y-4">
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
      <p className="font-bold">シートの「RYUTTER取込」から2列をコピー</p>
      <p className="mt-1 text-xs leading-5">課題名と締切日だけを取り込みます。投稿やプロフィールには公開されません。登録前に内容を確認できます。</p>
    </div>
    <textarea value={text} onChange={e => { setText(e.target.value); setSelected(new Set()); }} rows={8} placeholder={'課題名\t2026-09-10\nレポート提出\t2026-09-15'} className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900" />
    <button onClick={loadPreview} className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white">内容を確認する</button>
    {selected.size > 0 && <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between"><h2 className="font-bold">登録する課題</h2><span className="text-xs text-gray-500">{selected.size}件選択</span></div>
      {parsed.tasks.slice(0, remaining).map((task, index) => <label key={`${task.title}-${task.due_date}-${index}`} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 text-sm">
        <input type="checkbox" checked={selected.has(index)} onChange={() => setSelected(prev => { const next = new Set(prev); next.has(index) ? next.delete(index) : next.add(index); return next; })} />
        <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span><span className="text-xs text-gray-500">{task.due_date}</span>
      </label>)}
      <button onClick={save} disabled={saving} className="w-full rounded-xl bg-green-600 px-4 py-3 font-bold text-white disabled:opacity-50">{saving ? "登録中…" : "選んだ課題をRYUTTERに登録"}</button>
    </div>}
    {parsed.skipped > 0 && <p className="text-xs text-amber-700">読み取れない行・重複行を{parsed.skipped}件除外しました。</p>}
    {message && <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}
    {!isPro && <p className="text-center text-xs text-gray-500">FREEはタスク5件まで（現在{existingCount}件）。<a href="/pro?from=task-limit" className="font-bold text-purple-700 underline">Proなら無制限</a></p>}
  </div>;
}
