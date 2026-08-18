import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { getProStatus, type ProGrant } from "@/lib/pro";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminClient();
  const [profilesRes, grantsRes] = await Promise.all([
    admin.from("profiles").select("id, username, display_name, icon_url").order("created_at", { ascending: false }),
    admin.from("pro_grants").select("id, user_id, source, starts_at, expires_at, revoked_at").order("created_at", { ascending: false }),
  ]);
  const grantsByUser = new Map<string, ProGrant[]>();
  for (const grant of (grantsRes.data || []) as any[]) grantsByUser.set(grant.user_id, [...(grantsByUser.get(grant.user_id) || []), grant]);
  const users = (profilesRes.data || []).map((profile: any) => ({ ...profile, pro: getProStatus(grantsByUser.get(profile.id) || []) }));
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { action, userId, duration, expiresAt, grantId } = await request.json();
  const admin = createAdminClient();
  if (action === "grant") {
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
    let expires_at: string | null = null;
    if (duration === "custom") {
      if (!expiresAt || Number.isNaN(Date.parse(expiresAt))) return NextResponse.json({ error: "有効期限を指定してください" }, { status: 400 });
      expires_at = new Date(`${expiresAt}T23:59:59.999Z`).toISOString();
    } else if ([7, 30, 90].includes(Number(duration))) {
      const date = new Date(); date.setDate(date.getDate() + Number(duration)); expires_at = date.toISOString();
    } else if (duration !== "unlimited") return NextResponse.json({ error: "無効な期間です" }, { status: 400 });
    const { error } = await admin.from("pro_grants").insert({ user_id: userId, source: "admin", expires_at, created_by: adminUser.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: "無料Proを付与しました" });
  }
  if (action === "revoke") {
    if (!grantId) return NextResponse.json({ error: "grantId required" }, { status: 400 });
    const { data: grant } = await admin.from("pro_grants").select("source").eq("id", grantId).maybeSingle();
    if (!grant || grant.source !== "admin") return NextResponse.json({ error: "管理者付与のProのみ解除できます" }, { status: 400 });
    await admin.from("pro_grants").update({ revoked_at: new Date().toISOString(), revoked_by: adminUser.id }).eq("id", grantId);
    return NextResponse.json({ ok: true, message: "管理者付与Proを解除しました" });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
