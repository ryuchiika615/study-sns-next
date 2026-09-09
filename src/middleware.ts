import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeAuthNext } from "@/lib/auth-next";

export async function middleware(request: NextRequest) {
  // 締切レスキューは完成・再公開まで、既存の外部リンクも含めて案内を止める。
  if (["/free/deadline-rescue", "/downloads/ryutter-deadline-rescue.xlsx", "/start/rescue", "/tasks/import"].includes(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.pathname === "/tasks/import" ? "/tasks" : "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const publicPaths = ["/auth/login", "/auth/signup", "/auth/callback", "/healthz", "/api/auth", "/api/push/habit-notify", "/api/rankings/monthly-reward", "/banned", "/r/", "/share/", "/terms", "/privacy", "/tokusho"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_banned")
      .eq("id", user.id)
      .single();

    if (profile?.is_banned && !pathname.startsWith("/banned")) {
      const url = request.nextUrl.clone();
      url.pathname = "/banned";
      return NextResponse.redirect(url);
    }

    if (pathname === "/auth/login" || pathname === "/auth/signup") {
      const url = request.nextUrl.clone();
      const target = new URL(safeAuthNext(request.nextUrl.searchParams.get("next")), request.url);
      url.pathname = target.pathname;
      url.search = target.search;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
