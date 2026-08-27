import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const admin = createAdminClient();
  const { count } = await admin.from("founder_member_reservations").select("user_id", { count: "exact", head: true }).in("status", ["pending", "confirmed"]);
  const used = Math.min(count || 0, 30);
  return NextResponse.json({ limit: 30, used, remaining: 30 - used });
}
