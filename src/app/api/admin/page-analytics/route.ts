import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const searchParams = request.nextUrl.searchParams;
  const range = searchParams.get("range") || "all"; // today, week, month, all
  const userIdFilter = searchParams.get("user_id") || null;

  const admin = createAdminClient();

  let since: Date | null = null;
  const now = new Date();
  if (range === "today") {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (range === "week") {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === "month") {
    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  try {
    let query = admin
      .from("page_visits")
      .select("id, user_id, path, created_at, profiles!inner(display_name, username, avatar_url)");

    if (since) {
      query = query.gte("created_at", since.toISOString());
    }
    if (userIdFilter) {
      query = query.eq("user_id", userIdFilter);
    }

    query = query.order("created_at", { ascending: false }).limit(50000);

    const { data: visits, error } = await query;
    if (error) throw error;
    if (!visits) return NextResponse.json({ visits: [], users: [], total_visits: 0 });

    // path grouping for friendly labels
    function groupPath(path: string): string {
      const clean = path.replace(/\/+$/, "") || "/";
      if (clean === "/") return "ホーム";
      if (clean.startsWith("/notifications")) return "通知";
      if (clean.startsWith("/settings")) return "設定";
      if (clean.startsWith("/profile/edit")) return "プロフィール設定";
      if (clean.startsWith("/profile")) return "プロフィール";
      if (clean.startsWith("/gacha")) return "ガチャ";
      if (clean.startsWith("/shop")) return "ショップ";
      if (clean.startsWith("/rankings")) return "ランキング";
      if (clean.startsWith("/analytics")) return "分析";
      if (clean.startsWith("/achievements")) return "実績";
      if (clean.startsWith("/challenges")) return "チャレンジ";
      if (clean.startsWith("/tasks")) return "タスク";
      if (clean.startsWith("/habits")) return "習慣";
      if (clean.startsWith("/post")) return "投稿詳細";
      if (clean.startsWith("/auth")) return "認証";
      if (clean.startsWith("/admin")) return "管理";
      return clean;
    }

    // Per-user aggregation
    const userMap = new Map<string, {
      user_id: string;
      display_name: string;
      username: string;
      total: number;
      paths: Record<string, number>;
    }>();

    for (const v of visits) {
      const uid = v.user_id;
      const p = v.profiles as any;
      if (!userMap.has(uid)) {
        userMap.set(uid, {
          user_id: uid,
          display_name: p?.display_name || p?.username || "不明",
          username: p?.username || "不明",
          total: 0,
          paths: {},
        });
      }
      const entry = userMap.get(uid)!;
      entry.total++;
      const label = groupPath(v.path);
      entry.paths[label] = (entry.paths[label] || 0) + 1;
    }

    const users = Array.from(userMap.values()).map(u => {
      const percentages: Record<string, number> = {};
      for (const [path, count] of Object.entries(u.paths)) {
        percentages[path] = Math.round((count / u.total) * 10000) / 100;
      }
      return {
        ...u,
        percentages,
      };
    }).sort((a, b) => b.total - a.total);

    // Overall aggregation
    const overallMap = new Map<string, number>();
    let overallTotal = 0;
    for (const v of visits) {
      const label = groupPath(v.path);
      overallMap.set(label, (overallMap.get(label) || 0) + 1);
      overallTotal++;
    }
    const overall = Array.from(overallMap.entries())
      .map(([path, count]) => ({
        path,
        count,
        percentage: Math.round((count / overallTotal) * 10000) / 100,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      total_visits: visits.length,
      overall,
      users,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
