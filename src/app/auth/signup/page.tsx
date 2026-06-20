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

    const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, "_")}@study-sns.com`;

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
    <div className="min-h-screen flex items-center justify-center bg-[#f2f2f6] px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl text-yellow-500 font-bold">R</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">リュッター</h1>
          <p className="text-gray-500 text-sm mt-1">新規アカウント作成</p>
        </div>

        <form onSubmit={handleSignup} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">表示名</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:bg-white focus:border-primary focus:ring-primary"
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
              className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:bg-white focus:border-primary focus:ring-primary"
              placeholder="ユーザーID"
            />
            <p className="text-xs text-gray-400 mt-1">半角英数字で入力してください</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:bg-white focus:border-primary focus:ring-primary"
            />
            <p className="text-xs text-gray-400 mt-1">6文字以上</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード（確認）</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:bg-white focus:border-primary focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {loading ? "作成中..." : "アカウント作成"}
          </button>

          <p className="text-center text-sm text-gray-500">
            すでにアカウントをお持ちの方は{" "}
            <Link href="/auth/login" className="text-primary font-bold hover:underline">
              ログイン
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
