import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { giftId } = await request.json();
  if (!giftId) return NextResponse.json({ error: "giftId required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: gift } = await admin
    .from("pending_gifts")
    .select("*")
    .eq("id", giftId)
    .eq("user_id", user.id)
    .is("claimed_at", null)
    .single();

  if (!gift) return NextResponse.json({ error: "Gift not found or already claimed" }, { status: 404 });

  const { error: insertError } = await admin
    .from("user_items")
    .upsert({ user_id: user.id, item_id: gift.item_id }, { onConflict: "user_id, item_id", ignoreDuplicates: true });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  await admin
    .from("pending_gifts")
    .update({ claimed_at: new Date().toISOString() })
    .eq("id", giftId);

  return NextResponse.json({ success: true });
}
