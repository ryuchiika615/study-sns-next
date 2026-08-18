import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: { code: string } }) {
  const admin = createAdminClient();
  const { data } = await admin.from("referral_codes").select("code").eq("code", params.code).maybeSingle();
  const destination = new URL("/auth/signup", request.url);
  if (data) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
    const bytes = new TextEncoder().encode(`${forwarded}:${request.headers.get("user-agent") || ""}`);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const ip_hash = Array.from(new Uint8Array(digest)).map((v) => v.toString(16).padStart(2, "0")).join("");
    await admin.from("referral_clicks").insert({ referral_code: data.code, source: "x", user_agent: request.headers.get("user-agent"), ip_hash });
    const response = NextResponse.redirect(destination);
    response.cookies.set("lyutter_referral", data.code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
    return response;
  }
  return NextResponse.redirect(destination);
}
