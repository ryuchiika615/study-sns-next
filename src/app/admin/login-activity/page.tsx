"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";

export default function AdminLoginActivityPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      setUser(data.user);
      fetchSessions();
    });
  }, []);

  const fetchSessions = async () => {
    const res = await fetch("/api/admin/login-activity");
    if (res.status === 403) {
      setError("管理者のみアクセスできます");
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setSessions(data.sessions || []);
      setActiveCount(data.active_count || 0);
    }
  };

  return (
    <AppShell>
      <div className="p-4">
        {error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center">{error}</div>
        ) : (
          <>
            <div className="text-center mb-6">
              <p className="text-3xl font-bold text-primary">{activeCount}</p>
              <p className="text-sm text-gray-500">現在アクティブなユーザー (15分以内)</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">ユーザー</th>
                    <th className="px-3 py-2 text-left">ログイン</th>
                    <th className="px-3 py-2 text-left">最終アクセス</th>
                    <th className="px-3 py-2 text-left">IP</th>
                    <th className="px-3 py-2 text-center">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session: any) => (
                    <tr key={session.id} className="border-t border-gray-100">
                      <td className="px-3 py-2">{session.user?.display_name || session.user_id?.slice(0, 8)}</td>
                      <td className="px-3 py-2 text-gray-500">
                        {new Date(session.login_at).toLocaleString("ja-JP")}
                      </td>
                      <td className="px-3 py-2 text-gray-500">
                        {session.last_seen_at ? new Date(session.last_seen_at).toLocaleString("ja-JP") : "-"}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{session.ip_address || "-"}</td>
                      <td className="px-3 py-2 text-center">
                        {session.is_active_now ? (
                          <span className="text-green-600 font-bold">● オンライン</span>
                        ) : session.logout_at ? (
                          <span className="text-gray-400">オフライン</span>
                        ) : (
                          <span className="text-yellow-600">● 離席中</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
