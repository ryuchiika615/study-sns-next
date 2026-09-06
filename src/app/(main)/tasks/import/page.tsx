import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { TaskImportClient } from "@/components/TaskImportClient";

export default async function TaskImportPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/tasks/import");
  const now = new Date().toISOString();
  const [{ count }, { data: grant }] = await Promise.all([
    supabase.from("todos").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("pro_grants").select("id").eq("user_id", user.id).is("revoked_at", null).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`).limit(1).maybeSingle(),
  ]);
  return <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
    <Link href="/tasks" className="text-sm text-gray-500">← タスクへ戻る</Link>
    <div><h1 className="text-xl font-black">課題をまとめて取り込む</h1><p className="mt-1 text-sm text-gray-500">締切レスキューシートの内容を、入力し直さずにRYUTTERへ移せます。</p></div>
    <TaskImportClient userId={user.id} existingCount={count || 0} isPro={Boolean(grant)} />
  </div>;
}
