import { createServerSupabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/auth/login", process.env.NEXT_PUBLIC_SUPABASE_URL!));
}
