import Stripe from "stripe";

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripeはまだ設定されていません。");
  return new Stripe(secretKey);
}
