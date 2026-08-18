"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Connection = { username: string | null; display_name: string | null; connected_at: string } | null;

export default function XConnectionCard() {
  const [connection, setConnection] = useState<Connection>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const supabase = createClient();

  const load = async () => {
    const result = await fetch("/api/x/connection");
    if (result.ok) setConnection((await result.json()).connection);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const connect = async () => {
    setMessage("");
    const { error } = await supabase.auth.linkIdentity({
      // @supabase/supabase-js 2.46 の型定義はX provider追加前のため、実行時はSupabaseのOAuth 2.0 provider名を渡す。
      provider: "x" as any,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/settings?x=connected` },
    });
    if (error) setMessage(error.message);
  };

  const disconnect = async () => {
    const { data, error } = await supabase.auth.getUserIdentities();
    const identity = data?.identities?.find((item: any) => item.provider === "x");
    if (error || !identity) { setMessage("X連携情報を取得できませんでした"); return; }
    const result = await supabase.auth.unlinkIdentity(identity);
    if (result.error) { setMessage("ログイン方法がXのみの場合は解除できません"); return; }
    await fetch("/api/x/connection", { method: "DELETE" });
    setConnection(null);
    setMessage("X連携を解除しました");
  };

  // OAuth callback後にAuth identityをサーバー検証して同期する。
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("x") === "connected") {
      fetch("/api/x/connection", { method: "POST" }).then(load).then(() => setMessage("Xアカウントを連携しました"));
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm">𝕏</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold">X</p>
        <p className="text-xs text-gray-500">{loading ? "確認中..." : connection ? `@${connection.username || connection.display_name || "Xユーザー"} と連携中` : "学習記録をXでシェアできます"}</p>
      </div>
      {connection ? (
        <button onClick={disconnect} className="text-xs border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:bg-gray-50 cursor-pointer">解除</button>
      ) : (
        <button onClick={connect} className="text-xs bg-black text-white rounded-full px-3 py-1.5 font-bold cursor-pointer">Xと連携する</button>
      )}
      {message && <p className="basis-full text-xs text-primary -mt-1">{message}</p>}
    </div>
  );
}
