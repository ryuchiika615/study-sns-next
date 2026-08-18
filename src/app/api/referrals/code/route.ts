import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  let { data } = await admin.from("referral_codes").select("code").eq("user_id", user.id).maybeSingle();
  if (!data) {
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const result = await admin.from("referral_codes").insert({ user_id: user.id, code }).select("code").single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    data = result.data;
  }
  return NextResponse.json({ code: data.code });
}
