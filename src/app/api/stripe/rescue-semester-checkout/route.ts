import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getStripe } from "@/lib/stripe";

const productKey = "rescue_semester_v1";

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "購入にはRYUTTERへのログインが必要です。" }, { status: 401 });
  const { data: owned } = await supabase.from("digital_product_orders").select("id").eq("user_id", user.id).eq("product_key", productKey).maybeSingle();
  if (owned) return NextResponse.json({ url: "/api/digital-products/rescue-semester/download" });
  const price = process.env.STRIPE_RESCUE_SEMESTER_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!price || !appUrl) return NextResponse.json({ error: "学期版の販売準備中です。" }, { status: 503 });
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: user.id,
      metadata: { purchase_type: productKey, user_id: user.id },
      success_url: `${appUrl}/free/deadline-rescue?purchase=success`,
      cancel_url: `${appUrl}/free/deadline-rescue?purchase=cancelled`,
      allow_promotion_codes: false,
    });
    if (!session.url) throw new Error("決済画面を作成できませんでした。");
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "決済画面を開けませんでした。" }, { status: 500 });
  }
}
