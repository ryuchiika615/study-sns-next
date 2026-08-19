"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Group = { id: string; name: string; description: string; visibility: "private" | "public"; invite_code: string; owner_id: string; created_at: string };

export default function GroupsPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState("");

  const load = async (uid?: string) => {
    const id = uid || userId;
    if (!id) return;
    const { data: memberships } = await supabase.from("study_group_members").select("group_id").eq("user_id", id);
    const ids = (memberships || []).map((m: any) => m.group_id);
    if (!ids.length) { setGroups([]); return; }
    const { data } = await supabase.from("study_groups").select("*").in("id", ids).order("created_at", { ascending: false });
    setGroups((data || []) as Group[]);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { const id = data.user?.id || ""; setUserId(id); if (id) load(id); });
    fetch("/api/pro/status").then(async (r) => r.ok && setIsPro(Boolean((await r.json()).isPro))).catch(() => {});
  }, []);

  const createGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !userId) return;
    const ownedCount = groups.filter((group) => group.owner_id === userId).length;
    if (!isPro && ownedCount >= 1) { window.location.href = "/pro?from=group-limit"; return; }
    const { error } = await supabase.from("study_groups").insert({ owner_id: userId, name: name.trim(), description: description.trim(), visibility });
    if (error) { setMessage(error.message.includes("1個") ? "FREEではグループを1個まで作成できます。" : error.message); return; }
    setName(""); setDescription(""); setVisibility("private"); setShowCreate(false); setMessage("グループを作成しました"); load();
  };
  const copyInvite = async (group: Group) => {
    await navigator.clipboard.writeText(`${window.location.origin}/groups/${group.id}?invite=${group.invite_code}`);
    setMessage("招待リンクをコピーしました");
  };

  return <div className="mx-auto max-w-2xl space-y-4 p-4">
    <div className="rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 p-5 text-white shadow-sm"><p className="text-sm font-bold"><i className="fas fa-users mr-1.5" />学習グループ</p><h1 className="mt-1 text-xl font-bold">仲間だけの場所で、続けよう。</h1><p className="mt-2 text-xs leading-5 text-cyan-50">グループ内の投稿と、今週の勉強時間ランキングを楽しめます。</p></div>

    <div className="rounded-xl border border-purple-200 bg-purple-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-purple-950"><i className="fas fa-crown mr-1" />グループを作成</p><p className="mt-1 text-xs text-purple-800">FREEは1個まで。Proなら、クラス・受験・友達用など何個でも作れます。</p></div><button onClick={() => setShowCreate(!showCreate)} className="shrink-0 rounded-full bg-purple-600 px-4 py-2 text-xs font-bold text-white cursor-pointer">{showCreate ? "閉じる" : "作成する"}</button></div>
      {showCreate && <form onSubmit={createGroup} className="mt-4 space-y-2 border-t border-purple-200 pt-4"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} placeholder="例：TOEIC 800を目指す会" className="w-full rounded-lg border-gray-300 text-sm" /><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="どんなグループ？（任意）" rows={2} className="w-full rounded-lg border-gray-300 text-sm" /><select value={visibility} onChange={(e) => setVisibility(e.target.value as "private" | "public")} className="rounded-lg border-gray-300 text-sm"><option value="private">非公開（招待リンクで参加）</option><option value="public">公開（誰でも参加可能）</option></select><button className="w-full rounded-lg bg-purple-600 py-2 text-sm font-bold text-white cursor-pointer">グループを作る</button></form>}
    </div>
    {message && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{message}</p>}
    <div className="space-y-2">{groups.length ? groups.map((group) => <div key={group.id} className="rounded-xl border border-gray-200 bg-white p-4"><Link href={`/groups/${group.id}`} className="block no-underline hover:opacity-80"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-gray-900">{group.visibility === "private" ? "🔒" : "🌍"} {group.name}</p><p className="mt-1 text-xs text-gray-500">{group.description || "仲間と学習を続けるグループ"}</p></div><i className="fas fa-chevron-right text-gray-300 text-xs mt-2" /></div><p className="mt-3 text-[11px] font-bold text-blue-600"><i className="fas fa-comments mr-1" />グループ投稿を開く</p></Link><div className="mt-3 flex gap-2 border-t border-gray-100 pt-3"><Link href={`/groups/${group.id}?section=ranking`} className="flex-1 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-bold text-amber-800 no-underline"><i className="fas fa-trophy mr-1" />ランキング・勝負</Link><Link href={`/groups/${group.id}?section=notifications`} className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-bold text-slate-700 no-underline"><i className="fas fa-bell mr-1" />通知設定</Link></div>{group.owner_id === userId && <button onClick={() => copyInvite(group)} className="mt-2 text-[11px] font-bold text-blue-600"><i className="fas fa-link mr-1" />招待リンクをコピー</button>}</div>) : <div className="rounded-xl border border-dashed border-gray-300 bg-white py-10 text-center"><p className="text-2xl">👥</p><p className="mt-2 text-sm font-bold text-gray-700">まだ参加しているグループがありません</p><p className="mt-1 text-xs text-gray-500">仲間を招待して、学習を一緒に続けよう。</p></div>}</div>
  </div>;
}
