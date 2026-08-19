import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return NextResponse.json({ error: "設定を確認してください。" }, { status: 503 });
  const admin = createAdminClient();
  const { data: grant } = await admin.from("pro_grants").select("provider_subscription_id").eq("user_id", user.id).eq("source", "paid").not("provider_subscription_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!grant?.provider_subscription_id) return NextResponse.json({ error: "有料契約が見つかりません。" }, { status: 404 });
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(grant.provider_subscription_id);
  const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const session = await stripe.billingPortal.sessions.create({ customer, return_url: `${appUrl}/pro` });
  return NextResponse.json({ url: session.url });
}
