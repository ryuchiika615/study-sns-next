"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Group = { id: string; name: string; description: string; visibility: "private" | "public"; owner_id: string };
type User = { id: string; display_name: string | null; username: string | null; icon_url: string | null };
type Member = { group_id: string; user_id: string; role: "owner" | "member" };

export default function AdminGroupMembersPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [groupId, setGroupId] = useState("");
  const [userId, setUserId] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const response = await fetch("/api/admin/group-members");
    const data = await response.json();
    if (!response.ok) { setMessage(data.error === "Forbidden" ? "管理者のみアクセスできます" : data.error || "読み込みに失敗しました"); setLoading(false); return; }
    setGroups(data.groups || []); setUsers(data.users || []); setMembers(data.members || []); setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const selectedMembers = useMemo(() => new Set(members.filter((member) => member.group_id === groupId).map((member) => member.user_id)), [members, groupId]);
  const selectableUsers = useMemo(() => users.filter((user) => {
    const text = `${user.display_name || ""} ${user.username || ""}`.toLowerCase();
    return !selectedMembers.has(user.id) && (!query || text.includes(query.toLowerCase()));
  }), [users, selectedMembers, query]);
  const selectedGroup = groups.find((group) => group.id === groupId);

  const addMember = async () => {
    if (!groupId || !userId) { setMessage("グループと追加するユーザーを選んでください。"); return; }
    setSubmitting(true); setMessage("");
    const response = await fetch("/api/admin/group-members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId, userId }) });
    const data = await response.json();
    setSubmitting(false); setMessage(data.message || data.error || "処理に失敗しました");
    if (response.ok) { setUserId(""); await load(); }
  };

  if (loading) return <div className="p-5 text-center text-sm text-gray-500">読み込み中…</div>;
  return <div className="min-h-screen bg-gray-50 p-4"><div className="mx-auto max-w-3xl"><Link href="/admin" className="text-sm text-blue-600 hover:underline">← 管理者ダッシュボードへ</Link><h1 className="mt-4 text-2xl font-black text-slate-900">👥 グループ参加管理</h1><p className="mt-1 text-sm leading-relaxed text-slate-600">管理者がユーザーを選び、招待リンクなしでグループへ追加できます。</p>
    {message && <p className={`mt-4 rounded-xl p-3 text-sm font-bold ${message.includes("追加しました") ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{message}</p>}
    <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm"><label className="block text-sm font-bold text-slate-800">追加先のグループ</label><select value={groupId} onChange={(event) => { setGroupId(event.target.value); setUserId(""); }} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm"><option value="">グループを選ぶ</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.visibility === "public" ? "🌍" : "🔒"} {group.name}</option>)}</select>
      {selectedGroup && <p className="mt-2 text-xs text-slate-500">{selectedGroup.description || "説明なし"} ・ 現在 {selectedMembers.size} 人</p>}
      <label className="mt-5 block text-sm font-bold text-slate-800">追加するユーザー</label><input value={query} onChange={(event) => { setQuery(event.target.value); setUserId(""); }} placeholder="名前・ユーザーIDで絞り込み" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" disabled={!groupId} /><select value={userId} onChange={(event) => setUserId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" disabled={!groupId}><option value="">ユーザーを選ぶ（未参加 {selectableUsers.length} 人）</option>{selectableUsers.map((user) => <option key={user.id} value={user.id}>{user.display_name || user.username || "名称未設定"}{user.username ? ` (@${user.username})` : ""}</option>)}</select>
      <button onClick={addMember} disabled={!groupId || !userId || submitting} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "追加中…" : "このユーザーをグループに追加する"}</button></section>
    {selectedGroup && <section className="mt-4 rounded-2xl border bg-white p-5"><h2 className="font-bold text-slate-900">現在のメンバー</h2><div className="mt-3 flex flex-wrap gap-2">{members.filter((member) => member.group_id === groupId).map((member) => { const user = users.find((item) => item.id === member.user_id); return <span key={member.user_id} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700">{member.role === "owner" ? "管理者・" : ""}{user?.display_name || user?.username || "ユーザー"}</span>; })}</div></section>}
  </div></div>;
}
