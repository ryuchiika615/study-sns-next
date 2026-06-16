import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function ensureSpecialItem(admin: any, name: string, category: string, rarity: string) {
  const { data: existing } = await admin
    .from("gacha_items")
    .select("id")
    .eq("name", name)
    .eq("category", category)
    .maybeSingle();
  if (existing) return existing.id;

  const { data } = await admin
    .from("gacha_items")
    .insert({ name, category, rarity })
    .select("id")
    .single();
  return data?.id;
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yearMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthName = `${prevMonth.getMonth() + 1}月`;

  // Check if already awarded
  const { data: existingReward } = await admin
    .from("ranking_rewards")
    .select("id")
    .eq("year_month", yearMonth)
    .eq("rank", 1)
    .maybeSingle();
  if (existingReward) return NextResponse.json({ ok: true, alreadyAwarded: true });

  // Calculate top 1 for previous month
  const monthStart = `${yearMonth}-01T00:00:00Z`;
  const monthEnd = now.toISOString().split("T")[0] + "T23:59:59Z";

  const { data: rankings } = await admin
    .from("posts")
    .select("user_id, study_minutes")
    .gte("created_at", monthStart)
    .lte("created_at", monthEnd);

  const totals = new Map<string, number>();
  for (const p of (rankings || [])) {
    totals.set(p.user_id, (totals.get(p.user_id) || 0) + (p.study_minutes || 0));
  }

  const sorted = Array.from(totals.entries())
    .map(([user_id, total]) => ({ user_id, total }))
    .sort((a, b) => b.total - a.total);

  if (sorted.length === 0) return NextResponse.json({ ok: true, noData: true });

  const winner = sorted[0];

  // Create special gacha items if not exist
  const titleId = await ensureSpecialItem(admin, `${monthName}の勉強王`, "title", "LR");
  const iconId = await ensureSpecialItem(admin, "王冠", "icon", "LR");

  // Award items to winner
  for (const itemId of [titleId, iconId]) {
    if (itemId) {
      const { data: owned } = await admin
        .from("user_items")
        .select("user_id")
        .eq("user_id", winner.user_id)
        .eq("item_id", itemId)
        .maybeSingle();
      if (!owned) {
        await admin.from("user_items").insert({ user_id: winner.user_id, item_id: itemId });
      }
    }
  }

  // Auto-equip crown icon and title for winner
  await admin.from("profiles").update({
    current_title_id: titleId,
    current_avatar_id: iconId,
  }).eq("id", winner.user_id);

  // Record reward
  await admin.from("ranking_rewards").insert({
    year_month: yearMonth,
    user_id: winner.user_id,
    rank: 1,
    study_minutes: winner.total,
  });

  return NextResponse.json({
    ok: true,
    yearMonth,
    winner: winner.user_id,
    studyMinutes: winner.total,
    items: [titleId, iconId],
  });
}
