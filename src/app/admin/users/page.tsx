"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      fetchUsers();
    });
  }, []);

  const fetchUsers = async () => {
    const res = await fetch("/api/admin/users");
    if (res.status === 403) { setError("管理者のみアクセスできます"); return; }
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm("パスワードを resetme123 にリセットしますか？")) return;
    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "reset_password" }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessage(data.message);
    }
  };

  const handleToggleAdmin = async (userId: string) => {
    const res = await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "toggle_admin" }),
    });
    if (res.ok) {
      fetchUsers();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-b from-gray-900 to-blue-900 border-b-4 border-yellow-600 text-center py-6 shadow-lg">
        <Link href="/admin" className="absolute left-4 top-6 text-yellow-600 text-lg">
          <i className="fas fa-arrow-left" />
        </Link>
        <h1 className="text-3xl text-yellow-600 font-serif tracking-wider m-0">ユーザー管理</h1>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center mb-4">{error}</div>
        )}
        {message && (
          <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4">{message}</div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">ユーザー</th>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-center">管理者</th>
                <th className="px-3 py-2 text-right">ポイント</th>
                <th className="px-3 py-2 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <div className="font-bold">{u.display_name || u.username}</div>
                    <div className="text-xs text-gray-500">@{u.username}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{u.id.slice(0, 8)}...</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => handleToggleAdmin(u.id)}
                      className={`text-xs px-2 py-1 rounded-full cursor-pointer ${
                        u.is_admin ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {u.is_admin ? "管理者" : "一般"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right font-bold">{u.points}</td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => handleResetPassword(u.id)}
                      className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer"
                    >
                      パスワードリセット
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
