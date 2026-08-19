import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "ログイン情報を確認してください。" }, { status: 401 });
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) return NextResponse.json({ error: "Pro決済は準備中です。" }, { status: 503 });
  try {
    const stripe = getStripe();
    const customers = await stripe.customers.list({ email: user.email, limit: 10 });
    let matched: any = null;
    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 20 });
      matched = subscriptions.data.find((item: any) =>
        (item.status === "active" || item.status === "trialing") && item.items.data.some((line: any) => line.price.id === priceId)
      );
      if (matched) break;
    }
    if (!matched) return NextResponse.json({ isPro: false });
    const endSeconds = matched.current_period_end || matched.items?.data?.[0]?.current_period_end || Math.floor(Date.now() / 1000) + 31 * 24 * 60 * 60;
    const admin = createAdminClient();
    const { data: existing } = await admin.from("pro_grants").select("id").eq("provider_subscription_id", matched.id).maybeSingle();
    const values = { expires_at: new Date(endSeconds * 1000).toISOString(), revoked_at: null as string | null };
    if (existing) await admin.from("pro_grants").update(values).eq("id", existing.id);
    else await admin.from("pro_grants").insert({ user_id: user.id, source: "paid", starts_at: new Date().toISOString(), provider_subscription_id: matched.id, note: "Stripe月額Pro", ...values });
    return NextResponse.json({ isPro: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Pro状態を確認できませんでした。" }, { status: 500 });
  }
}
