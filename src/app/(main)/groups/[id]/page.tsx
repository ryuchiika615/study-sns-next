"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { formatStudyTime, getOptimizedIconUrl } from "@/lib/utils";
import PostFormSection from "../../PostFormSection";
import GroupTimeline from "@/components/GroupTimeline";
import GroupRankingPanel from "@/components/GroupRankingPanel";
import GroupTodayDashboard from "@/components/GroupTodayDashboard";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useSearchParams();
  const supabase = createClient();
  const invite = query.get("invite") || "";
  const section = query.get("section");
  const [userId, setUserId] = useState("");
  const [group, setGroup] = useState<any>(null);
  const [member, setMember] = useState<any>(null);
  const [ranking, setRanking] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [challengeResults, setChallengeResults] = useState<
    Record<string, any[]>
  >({});
  const [members, setMembers] = useState<any[]>([]);
  const [personalTotals, setPersonalTotals] = useState({
    study: 0,
    workout: 0,
  });
  const [message, setMessage] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [memberSettingsOpen, setMemberSettingsOpen] = useState(false);
  const [todayStartMinimized, setTodayStartMinimized] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<"private" | "public">(
    "private",
  );
  const [challengeName, setChallengeName] = useState("");
  const [challengeEnd, setChallengeEnd] = useState("");
  const owner = group?.owner_id === userId;
  useEffect(() => {
    if (!userId) return;
    setTodayStartMinimized(
      window.localStorage.getItem(`ryutter:group-today-dashboard:${userId}:${id}`) === "minimized",
    );
  }, [id, userId]);
  const load = async (uid?: string) => {
    const current = uid || userId;
    if (!current) return;
    const [{ data: g }, { data: m }] = await Promise.all([
      supabase.from("study_groups").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("study_group_members")
        .select("*")
        .eq("group_id", id)
        .eq("user_id", current)
        .maybeSingle(),
    ]);
    setGroup(g);
    setMember(m);
    if (!m) return;
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [
      { data: weekShares },
      { data: challengeRows },
      { data: challengeShares },
      { data: myPosts },
      memberResponse,
    ] = await Promise.all([
      supabase
        .from("post_group_shares")
        .select("post:post_id(user_id,study_minutes,created_at)")
        .eq("group_id", id),
      supabase
        .from("study_group_challenges")
        .select("*")
        .eq("group_id", id)
        .order("ends_at", { ascending: false }),
      supabase
        .from("post_group_shares")
        .select(
          "post:post_id(user_id,study_minutes,workout_minutes,created_at)",
        )
        .eq("group_id", id),
      supabase
        .from("posts")
        .select("study_minutes,workout_minutes")
        .eq("user_id", current),
      fetch(`/api/groups/${id}`),
    ]);
    const weekRows = (weekShares || [])
      .map((share: any) => share.post)
      .filter((post: any) => post?.created_at >= since);
    const challengePosts = (challengeShares || [])
      .map((share: any) => share.post)
      .filter(Boolean);
    setChallenges(challengeRows || []);
    if (memberResponse.ok)
      setMembers((await memberResponse.json()).members || []);
    setPersonalTotals(
      (myPosts || []).reduce(
        (total: { study: number; workout: number }, row: any) => ({
          study: total.study + (row.study_minutes || 0),
          workout: total.workout + (row.workout_minutes || 0),
        }),
        { study: 0, workout: 0 },
      ),
    );
    const totals = new Map<string, number>();
    (weekRows || []).forEach((row: any) =>
      totals.set(
        row.user_id,
        (totals.get(row.user_id) || 0) + (row.study_minutes || 0),
      ),
    );
    const allIds = [
      ...new Set([
        ...totals.keys(),
        ...(challengePosts || []).map((row: any) => row.user_id),
      ]),
    ];
    const { data: profiles } = allIds.length
      ? await supabase
          .from("profiles")
          .select("id,display_name,username,icon_url")
          .in("id", allIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    setRanking(
      [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([uid, total], i) => ({
          rank: i + 1,
          total,
          user: profileMap.get(uid),
        })),
    );
    const results: Record<string, any[]> = {};
    (challengeRows || []).forEach((challenge: any) => {
      const score = new Map<string, number>();
      (challengePosts || [])
        .filter(
          (row: any) =>
            row.created_at >= challenge.starts_at &&
            row.created_at <= challenge.ends_at,
        )
        .forEach((row: any) =>
          score.set(
            row.user_id,
            (score.get(row.user_id) || 0) + (row.study_minutes || 0),
          ),
        );
      results[challenge.id] = [...score.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([uid, total], i) => ({
          rank: i + 1,
          total,
          user: profileMap.get(uid),
        }));
    });
    setChallengeResults(results);
  };
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id || "";
      setUserId(uid);
      if (uid) load(uid);
    });
  }, [id]);
  const join = async () => {
    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: id, inviteCode: invite }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "招待リンクが必要です");
    setMessage("グループに参加しました！");
    load();
  };
  const manage = async (action: string, extra: any = {}) => {
    const res = await fetch(`/api/groups/${id}`, {
      method: action === "delete" ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body:
        action === "delete" ? undefined : JSON.stringify({ action, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "操作できませんでした");
    if (action === "delete" || action === "leave")
      return window.location.assign("/groups");
    if (action === "regenerate_invite") {
      setGroup({ ...group, invite_code: data.invite_code });
      setMessage("古い招待リンクを無効化しました");
    } else if (action === "update_group") {
      setGroup(data.group);
      setManageOpen(false);
      setMessage("グループ情報を更新しました");
    } else load();
  };
  const confirmAndManage = async (action: string, extra: any = {}) => {
    if (action === "delete") {
      const answer = prompt(
        `この操作は取り消せません。\nグループと投稿を完全に削除するには、グループ名「${group?.name || ""}」をそのまま入力してください。`,
      );
      if (answer !== group?.name)
        return setMessage(
          "グループ名が一致しなかったため、削除を中止しました。",
        );
    } else {
      const label =
        action === "leave"
          ? "このグループから退出しますか？"
          : action === "remove_member"
            ? "このメンバーをグループから外しますか？"
            : "古い招待リンクを無効にして、新しいリンクを発行しますか？";
      if (!confirm(`${label}\nこの操作はあとから戻せません。`)) return;
    }
    await manage(action, extra);
  };
  const copyInvite = async () => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/groups/${id}?invite=${group.invite_code}`,
    );
    setMessage("招待リンクをコピーしました");
  };
  const openManage = () => {
    setEditName(group?.name || "");
    setEditDescription(group?.description || "");
    setEditVisibility(group?.visibility === "public" ? "public" : "private");
    setManageOpen(true);
  };
  const setTodayStartDisplay = (shouldMinimize: boolean) => {
    const key = `ryutter:group-today-dashboard:${userId}:${id}`;
    if (shouldMinimize) window.localStorage.setItem(key, "minimized");
    else window.localStorage.removeItem(key);
    setTodayStartMinimized(shouldMinimize);
    window.dispatchEvent(new Event("ryutter:group-today-display"));
  };
  const saveGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    await manage("update_group", {
      name: editName,
      description: editDescription,
      visibility: editVisibility,
    });
  };
  const toggle = async (key: string, value: boolean) => {
    await supabase
      .from("study_group_members")
      .update({ [key]: value })
      .eq("group_id", id)
      .eq("user_id", userId);
    setMember({ ...member, [key]: value });
  };
  const createChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/groups/${id}/challenges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: challengeName,
        startsAt: new Date().toISOString(),
        endsAt: new Date(`${challengeEnd}T23:59:59`).toISOString(),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setMessage(data.error || "勝負を作れませんでした");
    setChallengeName("");
    setChallengeEnd("");
    setMessage("勝負を開始し、メンバーに通知しました！");
    load();
  };
  const safety = async (action: string, user: string, postId?: string) => {
    const reason =
      action === "report" ? prompt("通報理由を入力してください") : "";
    if (action === "report" && !reason) return;
    const res = await fetch("/api/safety", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        userId: user,
        postId,
        groupId: id,
        reason,
      }),
    });
    const data = await res.json();
    setMessage(
      res.ok
        ? action === "block"
          ? "ブロックしました"
          : "通報を受け付けました"
        : data.error || "操作できませんでした",
    );
    if (res.ok && action === "block") load();
  };
  if (!userId) return <div className="p-8 text-center">読み込み中...</div>;
  if (!member)
    return (
      <div className="mx-auto max-w-md p-4">
        <div className="mt-10 rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center">
          <p className="text-3xl">🔒</p>
          <h1 className="mt-3 text-lg font-bold">グループに招待されています</h1>
          <p className="mt-2 text-sm text-gray-600">
            参加すると、仲間だけの投稿とランキングが見られます。
          </p>
          {message && <p className="mt-3 text-xs text-red-600">{message}</p>}
          <button
            onClick={join}
            className="mt-5 w-full rounded-full bg-blue-600 py-3 text-sm font-bold text-white"
          >
            グループに参加する
          </button>
          <Link
            href="/groups"
            className="mt-4 inline-block text-sm text-blue-600"
          >
            一覧へ戻る
          </Link>
        </div>
      </div>
    );
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Link href="/groups" className="text-sm text-gray-500 no-underline">
        ← グループ一覧
      </Link>
      <header className="rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs">
              {group?.visibility === "private" ? "🔒 非公開" : "🌍 公開"}
            </p>
            <h1 className="mt-1 text-xl font-bold">{group?.name}</h1>
            <p className="mt-2 text-xs">{group?.description}</p>
          </div>
          {owner && (
            <button
              onClick={openManage}
              className="shrink-0 rounded-full bg-white/20 px-3 py-2 text-xs font-bold text-white"
            >
              ⚙️ 編集・設定
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setMembersOpen(!membersOpen)}
            className="rounded-full bg-white/15 px-3 py-2 text-xs font-bold text-white"
          >
            <i className="fas fa-users mr-1" />
            {members.length}人のメンバーを見る
          </button>
          {owner && (
            <button
              onClick={copyInvite}
              className="rounded-full bg-white/15 px-3 py-2 text-xs font-bold text-white"
            >
              🔗 招待リンク
            </button>
          )}
          {!owner && (
            <button
              onClick={() => setMemberSettingsOpen(true)}
              className="rounded-full bg-white/15 px-3 py-2 text-xs font-bold text-white"
            >
              ⚙️ 設定
            </button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/15 px-3 py-2">
            <p className="text-[10px] text-cyan-100">📚 あなたの総勉強時間</p>
            <p className="mt-1 text-sm font-bold">
              {formatStudyTime(personalTotals.study)}
            </p>
          </div>
          <div className="rounded-xl bg-white/15 px-3 py-2">
            <p className="text-[10px] text-cyan-100">🏋️ あなたの総筋トレ時間</p>
            <p className="mt-1 text-sm font-bold">
              {formatStudyTime(personalTotals.workout)}
            </p>
          </div>
        </div>
      </header>
      {!section && <GroupTodayDashboard userId={userId} groupId={id} />}
      {message && (
        <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
          {message}
        </p>
      )}
      {membersOpen && (
        <section className="rounded-2xl border border-slate-700 bg-slate-800 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">👥 メンバー一覧</h2>
            <button
              onClick={() => setMembersOpen(false)}
              className="text-xs text-slate-300"
            >
              閉じる
            </button>
          </div>
          <p className="mt-1 text-[11px] text-slate-300">
            このグループに参加しているメンバーです。
          </p>
          <div className="mt-3 space-y-2">
            {members.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center gap-2 rounded-xl bg-slate-900 p-2"
              >
                <img
                  src={m.profile?.icon_url || "/default-icon.png"}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover"
                />
                <Link
                  href={`/profile/${m.user_id}`}
                  className="min-w-0 flex-1 truncate text-sm font-bold text-white no-underline"
                >
                  {m.profile?.display_name || m.profile?.username || "メンバー"}
                  {m.role === "owner" && (
                    <span className="ml-1 text-[10px] text-amber-300">
                      作成者
                    </span>
                  )}
                </Link>
                {owner && m.user_id !== userId && (
                  <button
                    onClick={() =>
                      confirmAndManage("remove_member", { userId: m.user_id })
                    }
                    className="rounded-lg border border-red-300 px-2 py-1 text-xs font-bold text-red-300"
                  >
                    外す
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {!section && (
        <div id="group-post-form">
          <PostFormSection userId={userId} profile={null} groupId={id} />
        </div>
      )}
      {section === "ranking" && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-100">
              ランキング・勝負
            </h2>
            <Link href={`/groups/${id}`} className="text-xs text-blue-300">
              投稿へ戻る
            </Link>
          </div>
          <GroupRankingPanel groupId={id} userId={userId} />
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex justify-between">
              <h2 className="text-sm font-bold text-rose-900">
                🔥 グループ内の勉強勝負
              </h2>
              {owner && (
                <button
                  onClick={openManage}
                  className="text-xs font-bold text-rose-700"
                >
                  グループを編集
                </button>
              )}
            </div>
            {challenges.length ? (
              challenges.map((c) => (
                <div key={c.id} className="mt-3 rounded-lg bg-white/80 p-3">
                  <b className="text-sm">
                    {new Date(c.ends_at) < new Date() ? "🏅 結果" : "⚔️ 開催中"}{" "}
                    {c.name}
                  </b>
                  <p className="mt-1 text-xs text-gray-600">
                    〜 {new Date(c.ends_at).toLocaleDateString("ja-JP")}
                  </p>
                  {new Date(c.ends_at) < new Date() &&
                    challengeResults[c.id]?.[0] && (
                      <p className="mt-2 text-xs font-bold text-rose-700">
                        🥇{" "}
                        {challengeResults[c.id][0].user?.display_name ||
                          challengeResults[c.id][0].user?.username}{" "}
                        が優勝！　
                        {formatStudyTime(challengeResults[c.id][0].total)}
                      </p>
                    )}
                </div>
              ))
            ) : (
              <p className="mt-2 text-xs text-rose-800">
                作成者が期間を決めて勝負を始められます。
              </p>
            )}
          </section>
        </>
      )}
      {section === "notifications" && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700">通知設定</h2>
            <Link href={`/groups/${id}`} className="text-xs text-blue-600">
              投稿へ戻る
            </Link>
          </div>
          <section className="rounded-xl border bg-white p-4">
            <p className="text-sm font-bold">🔔 このグループの通知</p>
            <p className="mt-1 text-xs text-gray-500">
              このグループから受け取る通知を選べます。
            </p>
            <label className="mt-3 flex justify-between text-sm">
              新しい投稿
              <input
                type="checkbox"
                checked={!!member.notify_posts}
                onChange={(e) => toggle("notify_posts", e.target.checked)}
              />
            </label>
            <label className="mt-3 flex justify-between text-sm">
              ランキング変動
              <input
                type="checkbox"
                checked={!!member.notify_rank}
                onChange={(e) => toggle("notify_rank", e.target.checked)}
              />
            </label>
          </section>
        </>
      )}
      {manageOpen && owner && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/65 p-4">
          <section className="mx-auto my-8 max-w-lg rounded-2xl border border-purple-300 bg-purple-50 p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-purple-950">
                ⚙️ グループを編集
              </h2>
              <button
                onClick={() => setManageOpen(false)}
                className="text-xs text-purple-700"
              >
                閉じる
              </button>
            </div>
            <form onSubmit={saveGroup} className="space-y-3">
              <label className="block text-xs font-bold text-purple-950">
                グループ名
                <input
                  required
                  maxLength={50}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-purple-200 bg-white text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-purple-950">
                説明
                <textarea
                  maxLength={300}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="mt-1 min-h-20 w-full rounded-lg border border-purple-200 bg-white text-sm"
                />
              </label>
              <label className="block text-xs font-bold text-purple-950">
                公開設定
                <select
                  value={editVisibility}
                  onChange={(e) =>
                    setEditVisibility(e.target.value as "private" | "public")
                  }
                  className="mt-1 w-full rounded-lg border border-purple-200 bg-white text-sm"
                >
                  <option value="private">🔒 非公開（招待した人だけ）</option>
                  <option value="public">🌍 公開</option>
                </select>
              </label>
              <button className="w-full rounded-lg bg-purple-600 py-2 text-sm font-bold text-white">
                変更を保存する
              </button>
            </form>
            <TodayStartDisplaySettings
              minimized={todayStartMinimized}
              onChange={setTodayStartDisplay}
            />
            <form
              onSubmit={createChallenge}
              className="space-y-2 border-t border-purple-200 pt-3"
            >
              <p className="text-xs font-bold text-purple-900">
                🔥 新しい勉強勝負
              </p>
              <input
                required
                value={challengeName}
                onChange={(e) => setChallengeName(e.target.value)}
                placeholder="例：夏休み30時間勝負"
                className="w-full rounded-lg border border-purple-200 bg-white text-sm"
              />
              <input
                required
                type="date"
                value={challengeEnd}
                onChange={(e) => setChallengeEnd(e.target.value)}
                className="w-full rounded-lg border border-purple-200 bg-white text-sm"
              />
              <button className="w-full rounded-lg bg-rose-500 py-2 text-xs font-bold text-white">
                勝負を開始する
              </button>
            </form>
            <div className="flex gap-2 border-t border-purple-200 pt-3">
              <button
                onClick={() => confirmAndManage("regenerate_invite")}
                className="flex-1 rounded-lg border border-purple-300 bg-white py-2 text-xs font-bold text-purple-700"
              >
                招待リンクを再発行
              </button>
              <button
                onClick={() => confirmAndManage("delete")}
                className="rounded-lg bg-red-500 px-3 text-xs font-bold text-white"
              >
                グループを削除
              </button>
            </div>
          </section>
        </div>
      )}
      {memberSettingsOpen && !owner && (
        <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/65 p-4 sm:items-center">
          <section className="mx-auto w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900">
                ⚙️ グループ設定
              </h2>
              <button
                onClick={() => setMemberSettingsOpen(false)}
                className="text-sm text-slate-500"
              >
                閉じる
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              このグループで受け取る通知と参加状態を管理できます。
            </p>
            <TodayStartDisplaySettings
              minimized={todayStartMinimized}
              onChange={setTodayStartDisplay}
            />
            <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-3">
              <label className="flex items-center justify-between text-sm font-bold text-slate-700">
                新しい投稿の通知
                <input
                  type="checkbox"
                  checked={!!member.notify_posts}
                  onChange={(e) => toggle("notify_posts", e.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between text-sm font-bold text-slate-700">
                ランキング変動の通知
                <input
                  type="checkbox"
                  checked={!!member.notify_rank}
                  onChange={(e) => toggle("notify_rank", e.target.checked)}
                />
              </label>
            </div>
            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="text-xs text-slate-500">
                退出すると、このグループの投稿は見られなくなります。
              </p>
              <button
                onClick={() => confirmAndManage("leave")}
                className="mt-2 w-full rounded-xl border border-red-200 bg-red-50 py-3 text-sm font-bold text-red-600"
              >
                このグループを退出する
              </button>
            </div>
          </section>
        </div>
      )}
      {!section && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold">グループの投稿</h2>
          <GroupTimeline groupId={id} userId={userId} />
        </section>
      )}
    </div>
  );
}

function TodayStartDisplaySettings({ minimized, onChange }: { minimized: boolean; onChange: (shouldMinimize: boolean) => void }) {
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-xs font-black text-emerald-900">✨ あなたの表示設定</p>
      <p className="mt-1 text-[11px] leading-5 text-emerald-800">「今日のスタート」は自分の画面だけで最小化できます。グループの他のメンバーには影響しません。</p>
      <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-2.5">
        <p className="text-[10px] font-bold text-slate-500">いまの表示</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-800">{minimized ? "✨ 今日のスタート　最小表示中" : "✨ 今日のスタート　通常表示中"}</span>
          <span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">自分だけ</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-emerald-800">{minimized ? "下の小さいバーは「通常表示に戻す」で、いつでも元に戻せます。" : "カードを小さくして、投稿欄を広く使いたいときに最小化できます。"}</p>
      <button onClick={() => onChange(!minimized)} className="mt-3 w-full rounded-lg bg-emerald-500 py-2.5 text-xs font-bold text-white">
        {minimized ? "通常表示に戻す" : "今日のスタートを最小化する"}
      </button>
    </section>
  );
}
