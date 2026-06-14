"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("ログインに失敗しました。IDかパスワードが違います。");
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
          <p className="text-gray-500 mt-1">勉強SNSにログイン</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border-gray-300 focus:border-primary focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-primary text-white font-bold py-2.5 rounded-full hover:bg-blue-600 transition"
          >
            ログイン
          </button>

          <p className="text-center text-sm text-gray-500">
            アカウントがない方は{" "}
            <Link href="/auth/signup" className="text-primary hover:underline">
              新規登録
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
