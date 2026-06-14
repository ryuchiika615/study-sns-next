"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";

export default function AdminLoginActivityPage() {
  const [sessions, setSessions] = useState<any[]>([]);
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
    }
  };

  const formatJst = (dateStr: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("ja-JP");
  };

  const calcDuration = (loginAt: string, logoutAt: string | null) => {
    if (!loginAt) return "-";
    const start = new Date(loginAt);
    const end = logoutAt ? new Date(logoutAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "1分未満";
    if (mins < 60) return `${mins}分`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}時間${m}分`;
  };

  return (
    <AppShell>
      <div className="p-4">
        {error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center">{error}</div>
        ) : (
          <>
            <div className="text-center mb-4">
              <p className="text-sm text-gray-500">全ログイン履歴（直近200件）</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left whitespace-nowrap">ユーザー</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">ログイン</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">ログアウト</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">接続時間</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">IP</th>
                    <th className="px-3 py-2 text-center whitespace-nowrap">状態</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session: any) => (
                    <tr key={session.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="font-bold">{session.user?.display_name || session.user?.username || session.user_id?.slice(0, 8)}</span>
                        <span className="text-xs text-gray-500 ml-1">@{session.user?.username || ""}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatJst(session.login_at)}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatJst(session.logout_at)}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{calcDuration(session.login_at, session.logout_at)}</td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap font-mono text-xs">{session.ip_address || "-"}</td>
                      <td className="px-3 py-2 text-center whitespace-nowrap">
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
