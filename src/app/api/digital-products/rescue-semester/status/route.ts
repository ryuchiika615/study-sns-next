import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ loggedIn: false, owned: false });
  const { data } = await supabase.from("digital_product_orders").select("id").eq("user_id", user.id).eq("product_key", "rescue_semester_v1").maybeSingle();
  return NextResponse.json({ loggedIn: true, owned: Boolean(data) });
}
