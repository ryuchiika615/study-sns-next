import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.user_id;
  if (!userId) return;
  const admin = createAdminClient();
  const active = subscription.status === "active" || subscription.status === "trialing";
  const periodEnd = new Date(((subscription as any).current_period_end || Math.floor(Date.now() / 1000)) * 1000).toISOString();
  const existing = await admin.from("pro_grants").select("id").eq("provider_subscription_id", subscription.id).maybeSingle();
  if (existing.data) {
    await admin.from("pro_grants").update({ expires_at: periodEnd, revoked_at: active ? null : new Date().toISOString() }).eq("id", existing.data.id);
  } else if (active) {
    await admin.from("pro_grants").insert({ user_id: userId, source: "paid", starts_at: new Date().toISOString(), expires_at: periodEnd, provider_subscription_id: subscription.id, note: "Stripe月額Pro" });
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return new NextResponse("Webhook設定がありません", { status: 400 });
  let event: Stripe.Event;
  try { event = getStripe().webhooks.constructEvent(await request.text(), signature, secret); }
  catch { return new NextResponse("署名が正しくありません", { status: 400 }); }
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    await syncSubscription(event.data.object as Stripe.Subscription);
  }
  return NextResponse.json({ received: true });
}
