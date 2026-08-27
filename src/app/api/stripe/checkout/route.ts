import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "ログインしてください。" }, { status: 401 });
  const price = process.env.STRIPE_PRO_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!price || !appUrl) return NextResponse.json({ error: "Pro決済は準備中です。" }, { status: 503 });
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      // Stripe Checkout itself asks for the receipt email. Do not pin it to
      // the Ryutter sign-in email: users may want receipts elsewhere.
      client_reference_id: user.id,
      subscription_data: { metadata: { user_id: user.id } },
      success_url: `${appUrl}/pro?checkout=success`,
      cancel_url: `${appUrl}/pro?checkout=cancelled`,
      allow_promotion_codes: true,
    });
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "決済画面を開けませんでした。" }, { status: 500 });
  }
}
