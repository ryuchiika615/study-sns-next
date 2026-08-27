import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
  const price = process.env.STRIPE_FOUNDER_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!price || !appUrl) return NextResponse.json({ error: "創設メンバー決済は準備中です。" }, { status: 503 });

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Checkout uses the payment methods enabled in the Stripe Dashboard.
      // This keeps card checkout available while PayPay's approval is pending,
      // then automatically displays PayPay for this one-time JPY purchase.
      line_items: [{ price, quantity: 1 }],
      // Let the purchaser choose the receipt email in Stripe Checkout.
      // The Ryutter account is linked separately with client_reference_id.
      client_reference_id: user.id,
      metadata: { purchase_type: "founder_member", user_id: user.id },
      success_url: `${appUrl}/pro?founder=success`,
      cancel_url: `${appUrl}/pro?founder=cancelled`,
      allow_promotion_codes: false,
    });
    if (!session.id || !session.url) throw new Error("決済画面を作成できませんでした。");
    const admin = createAdminClient();
    const { data: reserved, error } = await admin.rpc("reserve_founder_member_slot", { p_user_id: user.id, p_checkout_session_id: session.id });
    if (error || !reserved) {
      await stripe.checkout.sessions.expire(session.id).catch(() => {});
      return NextResponse.json({ error: "創設メンバー枠はすでに埋まったか、あなたの枠を確保済みです。" }, { status: 409 });
    }
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "決済画面を開けませんでした。" }, { status: 500 });
  }
}
