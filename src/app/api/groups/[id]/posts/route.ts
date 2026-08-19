import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  const { content, subject, studyMinutes } = await request.json(); if (!content?.trim()) return NextResponse.json({ error: "投稿内容を入力してください" }, { status: 400 });
  const admin = createAdminClient(); const { data: member } = await admin.from("study_group_members").select("user_id").eq("group_id", params.id).eq("user_id", user.id).maybeSingle(); if (!member) return NextResponse.json({ error: "グループのメンバーのみ投稿できます" }, { status: 403 });
  const since = new Date(Date.now() - 7 * 86400000).toISOString(); const { data: beforeRows } = await admin.from("posts").select("user_id, study_minutes").eq("group_id", params.id).gte("created_at", since);
  const { data: post, error } = await admin.from("posts").insert({ user_id: user.id, group_id: params.id, content: content.trim(), subject: subject?.trim() || "その他", study_minutes: Math.max(0, Number(studyMinutes) || 0) }).select("id").single(); if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const totals = new Map<string, number>(); (beforeRows || []).forEach((row: any) => totals.set(row.user_id, (totals.get(row.user_id) || 0) + (row.study_minutes || 0))); const before = new Map(totals); totals.set(user.id, (totals.get(user.id) || 0) + Math.max(0, Number(studyMinutes) || 0));
  const rank = (map: Map<string, number>, id: string) => [...map.entries()].sort((a, b) => b[1] - a[1]).findIndex(([uid]) => uid === id) + 1;
  const { data: members } = await admin.from("study_group_members").select("user_id, notify_posts, notify_rank").eq("group_id", params.id); const recipients = (members || []).filter((m: any) => m.user_id !== user.id);
  const { data: blocked } = recipients.length ? await admin.from("user_blocks").select("blocker_id").eq("blocked_id", user.id).in("blocker_id", recipients.map((m: any) => m.user_id)) : { data: [] }; const blockedIds = new Set((blocked || []).map((b: any) => b.blocker_id));
  const notifications: any[] = recipients.filter((m: any) => m.notify_posts && !blockedIds.has(m.user_id)).map((m: any) => ({ recipient_id: m.user_id, sender_id: user.id, post_id: post.id, group_id: params.id, notification_type: "group_post", message: "グループに新しい投稿があります" }));
  for (const recipient of recipients.filter((m: any) => m.notify_rank && !blockedIds.has(m.user_id))) if ((before.get(recipient.user_id) || 0) > 0 && rank(before, recipient.user_id) < rank(totals, recipient.user_id)) notifications.push({ recipient_id: recipient.user_id, sender_id: user.id, post_id: post.id, group_id: params.id, notification_type: "group_rank", message: "今週のグループ順位が変わりました" });
  const higher = [...totals.entries()].filter(([uid, total]) => uid !== user.id && total > (totals.get(user.id) || 0)).sort((a, b) => a[1] - b[1])[0]; if (higher && higher[1] - (totals.get(user.id) || 0) <= 30) notifications.push({ recipient_id: user.id, sender_id: user.id, post_id: post.id, group_id: params.id, notification_type: "group_rank", message: `あと${higher[1] - (totals.get(user.id) || 0)}分で次の順位です！` });
  if (notifications.length) await admin.from("notifications").insert(notifications); return NextResponse.json({ ok: true, postId: post.id });
}
