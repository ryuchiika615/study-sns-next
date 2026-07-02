import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase-admin";
import { NextRequest, NextResponse } from "next/server";

function formatDuration(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}秒`;
  const m = Math.floor(totalSec / 60);
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}時間${rem}分` : `${h}時間`;
}

function formatShort(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}m`;
}

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
  const range = searchParams.get("range") || "all";
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
  const sinceStr = since?.toISOString();

  try {
    let query = admin
      .from("page_visits")
      .select("id, user_id, path, created_at");

    if (sinceStr) query = query.gte("created_at", sinceStr);
    if (userIdFilter) query = query.eq("user_id", userIdFilter);

    query = query.order("created_at", { ascending: false }).limit(50000);

    const { data: visits, error } = await query;
    if (error) throw error;
    if (!visits || visits.length === 0) {
      return NextResponse.json({ total_visits: 0, total_seconds: 0, overall: [], users: [] });
    }

    const uids = [...new Set(visits.map(v => v.user_id))];

    // Batch-fetch profiles
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, username")
      .in("id", uids);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    // Batch-fetch latest login sessions for last-visit dwell estimation
    const { data: sessions } = await admin
      .from("login_sessions")
      .select("user_id, login_at, last_seen_at, logout_at")
      .in("user_id", uids)
      .order("login_at", { ascending: false })
      .limit(500);
    const latestSessionByUser = new Map<string, { login_at: string; last_seen_at: string; logout_at: string | null }>();
    for (const s of sessions || []) {
      if (!latestSessionByUser.has(s.user_id)) {
        latestSessionByUser.set(s.user_id, s);
      }
    }

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

    const CAP_SEC = 3600; // max 1h per page view (beyond that = abandoned tab)

    const visitsByUser = new Map<string, { path: string; created_at: string }[]>();
    for (const v of visits) {
      if (!visitsByUser.has(v.user_id)) visitsByUser.set(v.user_id, []);
      visitsByUser.get(v.user_id)!.push({ path: v.path, created_at: v.created_at });
    }
    for (const [, us] of visitsByUser) {
      us.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    const userAgg = new Map<string, {
      user_id: string; display_name: string; username: string;
      total_seconds: number; paths: Record<string, number>;
    }>();

    for (const [uid, us] of visitsByUser) {
      const p = profileMap.get(uid);
      const entry = {
        user_id: uid,
        display_name: p?.display_name || p?.username || "不明",
        username: p?.username || "不明",
        total_seconds: 0,
        paths: {} as Record<string, number>,
      };
      userAgg.set(uid, entry);

      // Calculate dwell from next visit (all visits except the last)
      for (let i = 0; i < us.length - 1; i++) {
        const dwell = Math.round(
          (new Date(us[i + 1].created_at).getTime() - new Date(us[i].created_at).getTime()) / 1000
        );
        if (dwell < 0 || dwell > CAP_SEC) continue;
        const label = groupPath(us[i].path);
        entry.paths[label] = (entry.paths[label] || 0) + dwell;
        entry.total_seconds += dwell;
      }

      // Calculate dwell for the LAST visit using login_session.last_seen_at
      const last = us[us.length - 1];
      const lastVisitMs = new Date(last.created_at).getTime();
      const session = latestSessionByUser.get(uid);
      if (session) {
        const sessionLoginMs = new Date(session.login_at).getTime();
        if (sessionLoginMs <= lastVisitMs) {
          const endMs = session.logout_at
            ? new Date(session.logout_at).getTime()
            : new Date(session.last_seen_at).getTime();
          let dwell = Math.round((endMs - lastVisitMs) / 1000);
          if (dwell > 0 && dwell <= CAP_SEC) {
            const label = groupPath(last.path);
            entry.paths[label] = (entry.paths[label] || 0) + dwell;
            entry.total_seconds += dwell;
          }
        }
      }
    }

    const users = Array.from(userAgg.values()).map(u => {
      const percentages: Record<string, number> = {};
      for (const [path, sec] of Object.entries(u.paths)) {
        percentages[path] = u.total_seconds > 0
          ? Math.round((sec / u.total_seconds) * 10000) / 100 : 0;
      }
      return { ...u, percentages, formatted_time: formatDuration(u.total_seconds), short_time: formatShort(u.total_seconds) };
    }).sort((a, b) => b.total_seconds - a.total_seconds);

    const overallMap = new Map<string, number>();
    let overallSeconds = 0;
    for (const [, entry] of userAgg) {
      for (const [path, sec] of Object.entries(entry.paths)) {
        overallMap.set(path, (overallMap.get(path) || 0) + sec);
        overallSeconds += sec;
      }
    }
    const overall = Array.from(overallMap.entries())
      .map(([path, seconds]) => ({
        path, seconds,
        percentage: overallSeconds > 0 ? Math.round((seconds / overallSeconds) * 10000) / 100 : 0,
        formatted_time: formatDuration(seconds),
        short_time: formatShort(seconds),
      }))
      .sort((a, b) => b.seconds - a.seconds);

    return NextResponse.json({
      total_visits: visits.length,
      total_seconds: overallSeconds,
      formatted_total: formatDuration(overallSeconds),
      overall, users,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
