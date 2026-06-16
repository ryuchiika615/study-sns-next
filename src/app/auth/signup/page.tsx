"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password.length < 6) {
      setError("パスワードは6文字以上にしてください。");
      setLoading(false);
      return;
    }
    if (password !== passwordConfirm) {
      setError("パスワードが一致しません。");
      setLoading(false);
      return;
    }

    const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, "_")}@study-sns.local`;

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: displayName },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">リュッター</h1>
          <p className="text-gray-500 mt-1">新規アカウント作成</p>
        </div>

        <form onSubmit={handleSignup} className="bg-white rounded-2xl shadow p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">表示名</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary"
              placeholder="表示名"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ユーザーID</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary"
              placeholder="ユーザーID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード（6文字以上）</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード（確認）</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-2.5 rounded-full hover:bg-blue-600 transition disabled:opacity-50"
          >
            {loading ? "作成中..." : "アカウント作成"}
          </button>

          <p className="text-center text-sm text-gray-500">
            すでにアカウントをお持ちの方は{" "}
            <Link href="/auth/login" className="text-primary hover:underline">
              ログイン
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
