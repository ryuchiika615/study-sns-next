import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminClient();
  const [shares, clicks, referrals, codes, profiles] = await Promise.all([
    admin.from("share_events").select("share_type"),
    admin.from("referral_clicks").select("id"),
    admin.from("referrals").select("referrer_user_id"),
    admin.from("referral_codes").select("user_id"),
    admin.from("profiles").select("id, display_name, username"),
  ]);
  const byType = (shares.data || []).reduce((all: Record<string, number>, row: any) => ({ ...all, [row.share_type]: (all[row.share_type] || 0) + 1 }), {});
  const inviterCounts = (referrals.data || []).reduce<Record<string, number>>((all, row: any) => ({ ...all, [row.referrer_user_id]: (all[row.referrer_user_id] || 0) + 1 }), {});
  const profileMap = new Map((profiles.data || []).map((row: any) => [row.id, row]));
  const topInviters = (codes.data || []).map((row: any) => ({ user: profileMap.get(row.user_id), count: inviterCounts[row.user_id] || 0 })).filter((row) => row.count > 0).sort((a, b) => b.count - a.count).slice(0, 10);
  const clickCount = clicks.data?.length || 0;
  const signupCount = referrals.data?.length || 0;
  return NextResponse.json({ totalShares: shares.data?.length || 0, shareTypes: byType, clicks: clickCount, registrations: signupCount, conversionRate: clickCount ? Math.round(signupCount / clickCount * 1000) / 10 : 0, topInviters });
}
