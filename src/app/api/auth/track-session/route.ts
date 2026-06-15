import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";

  const userAgent = request.headers.get("user-agent") || null;

  try {
    const admin = createAdminClient();
    const { data: sessionData } = await admin.from("login_sessions").insert({
      user_id: user.id,
      ip_address: ip,
      user_agent: userAgent,
    }).select("id").single();

    if (sessionData?.id) {
      fetch(`http://ip-api.com/json/${ip}?fields=city,regionName,country,isp`).then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        let location = "";
        if (data.city) {
          location = `${data.city}, ${data.regionName}, ${data.country}`;
          if (data.isp) location += ` (${data.isp})`;
        }
        if (location) {
          await admin.from("login_sessions").update({ location }).eq("id", sessionData.id);
        }
      }).catch(() => {});
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
