import { createAdminClient } from "@/lib/supabase-admin";
import { formatMinutes } from "@/lib/share";

export type ShareCardData = { title: string; subtitle: string; metric: string; label: string; username: string | null; referrerId: string } | null;

export async function getShareCardData(kind: string, userId: string, itemId: string): Promise<ShareCardData> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("display_name, username, consecutive_post_days").eq("id", userId).maybeSingle();
  if (!profile) return null;
  const name = profile.display_name || profile.username || "リュッターユーザー";
  if (kind === "study") {
    const { data: post } = await admin.from("posts").select("id, user_id, subject, study_minutes").eq("id", itemId).eq("user_id", userId).maybeSingle();
    if (!post) return null;
    return { title: name, subtitle: post.subject || "今日の勉強記録", metric: formatMinutes(post.study_minutes || 0), label: `🔥 ${profile.consecutive_post_days || 0} DAYS`, username: profile.username, referrerId: userId };
  }
  if (kind === "ranking") {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const { data: posts } = await admin.from("posts").select("user_id, study_minutes").gte("created_at", monthStart.toISOString());
    const totals = new Map<string, number>();
    for (const row of posts || []) totals.set(row.user_id, (totals.get(row.user_id) || 0) + (row.study_minutes || 0));
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const rank = sorted.findIndex(([id]) => id === userId) + 1;
    const total = totals.get(userId) || 0;
    return { title: `${name} のランキング`, subtitle: `${monthStart.getMonth() + 1}月の積み上げ`, metric: rank ? `${rank}位` : "参加中", label: `今月 ${formatMinutes(total)}`, username: profile.username, referrerId: userId };
  }
  if (kind === "achievement") {
    const [definition, earned] = await Promise.all([
      admin.from("achievement_definitions").select("title, description, icon").eq("id", itemId).maybeSingle(),
      admin.from("user_achievements").select("earned_at").eq("user_id", userId).eq("achievement_id", itemId).maybeSingle(),
    ]);
    if (!definition.data || !earned.data?.earned_at) return null;
    return { title: `${definition.data.icon} ${definition.data.title}`, subtitle: definition.data.description, metric: "ACHIEVED", label: name, username: profile.username, referrerId: userId };
  }
  return null;
}
