import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const code = request.cookies.get("lyutter_referral")?.value;
  const response = NextResponse.json({ ok: true });
  if (!code) return response;
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: referralCode } = await admin.from("referral_codes").select("user_id, code").eq("code", code).maybeSingle();
  if (referralCode && referralCode.user_id !== user.id) {
    await admin.from("referrals").upsert({ referred_user_id: user.id, referrer_user_id: referralCode.user_id, referral_code: referralCode.code, source: "x" }, { onConflict: "referred_user_id", ignoreDuplicates: true });
  }
  response.cookies.set("lyutter_referral", "", { path: "/", maxAge: 0 });
  return response;
}
