import { createAdminClient } from "@/lib/supabase-admin";

const MONTH_NAMES = ["睦月", "如月", "弥生", "卯月", "皐月", "水無月", "文月", "葉月", "長月", "神無月", "霜月", "師走"];
const ICON_FRAMES = ["氷晶オーラ", "氷晶オーラ", "桜花オーラ", "桜花オーラ", "若葉オーラ", "雨雫オーラ", "向日葵オーラ", "向日葵オーラ", "紅葉オーラ", "紅葉オーラ", "霜華オーラ", "雪華オーラ"];

export function previousYearMonth(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseYearMonth(value: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) throw new Error("対象月は YYYY-MM 形式で指定してください。");
  return { year: Number(match[1]), month: Number(match[2]) };
}

async function ensureSpecialItem(admin: any, name: string, category: string, rarity: string) {
  const { data: existing } = await admin.from("gacha_items").select("id, rarity").eq("name", name).eq("category", category).maybeSingle();
  if (existing) {
    if (existing.rarity !== rarity) await admin.from("gacha_items").update({ rarity }).eq("id", existing.id);
    return existing.id as string;
  }
  const { data, error } = await admin.from("gacha_items").insert({ name, category, rarity }).select("id").single();
  if (error || !data) throw new Error(error?.message || "報酬アイテムを作成できませんでした。");
  return data.id as string;
}

/** 指定月の全体学習ランキング1位へ、月の覇者称号と季節フレームを一度だけ付与する。 */
export async function awardMonthlyRanking(yearMonth: string) {
  const { year, month } = parseYearMonth(yearMonth);
  const admin = createAdminClient();
  const { data: existingReward, error: rewardLookupError } = await admin.from("ranking_rewards").select("id, user_id").eq("year_month", yearMonth).eq("rank", 1).maybeSingle();
  if (rewardLookupError) throw new Error(rewardLookupError.message);
  if (existingReward) return { ok: true, alreadyAwarded: true, yearMonth, winner: existingReward.user_id };

  const monthStart = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const monthEnd = new Date(Date.UTC(year, month, 1)).toISOString();
  const { data: posts, error: postsError } = await admin.from("posts").select("user_id, study_minutes").gte("created_at", monthStart).lt("created_at", monthEnd);
  if (postsError) throw new Error(postsError.message);

  const totals = new Map<string, number>();
  for (const post of posts || []) totals.set(post.user_id, (totals.get(post.user_id) || 0) + Number(post.study_minutes || 0));
  const winner = [...totals.entries()].map(([user_id, total]) => ({ user_id, total })).sort((a, b) => b.total - a.total || a.user_id.localeCompare(b.user_id))[0];
  if (!winner) return { ok: true, noData: true, yearMonth };

  const monthIndex = month - 1;
  const titleName = `${MONTH_NAMES[monthIndex]}の覇者`;
  const iconName = ICON_FRAMES[monthIndex];
  const [titleId, iconId] = await Promise.all([ensureSpecialItem(admin, titleName, "title", "XR"), ensureSpecialItem(admin, iconName, "icon", "XR")]);
  for (const itemId of [titleId, iconId]) {
    const { error } = await admin.from("user_items").upsert({ user_id: winner.user_id, item_id: itemId }, { onConflict: "user_id,item_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  const { error: profileError } = await admin.from("profiles").update({ current_title_id: titleId, current_avatar_id: iconId }).eq("id", winner.user_id);
  if (profileError) throw new Error(profileError.message);
  const { error: insertError } = await admin.from("ranking_rewards").insert({ year_month: yearMonth, user_id: winner.user_id, rank: 1, study_minutes: winner.total });
  if (insertError) throw new Error(insertError.message);
  return { ok: true, yearMonth, winner: winner.user_id, studyMinutes: winner.total, titleName, iconName };
}
