"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";

export default function LoginPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let email = loginId;

      if (!email.includes("@")) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .eq("username", loginId.trim())
          .maybeSingle();
        if (!profiles?.email) {
          setError("ユーザーIDが見つかりません。");
          setLoading(false);
          return;
        }
        email = profiles.email;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", currentUser.id)
          .single();
        if (profile?.is_admin) {
          router.push("/admin");
          router.refresh();
          return;
        }
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("エラーが発生しました。");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f2f2f6] px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl text-yellow-500 font-bold">R</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">リュッター</h1>
          <p className="text-gray-500 text-sm mt-1">勉強SNSにログイン</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-100">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ユーザーIDまたはメールアドレス</label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
              className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:bg-white focus:border-primary focus:ring-primary"
              placeholder="ユーザーID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:bg-white focus:border-primary focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>

          <p className="text-center text-sm text-gray-500">
            アカウントがない方は{" "}
            <Link href="/auth/signup" className="text-primary font-bold hover:underline">
              新規登録
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
