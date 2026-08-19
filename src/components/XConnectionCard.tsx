"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";

type Connection = { username: string | null; display_name: string | null; connected_at: string } | null;
type RyutterAccount = { username: string | null; display_name: string | null } | null;

export default function XConnectionCard() {
  const [connection, setConnection] = useState<Connection>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [ryutter, setRyutter] = useState<RyutterAccount>(null);
  const supabase = createClient();

  const load = async () => {
    const result = await fetch("/api/x/connection");
    if (result.ok) {
      const data = await result.json();
      setConnection(data.connection);
      setRyutter(data.ryutter || null);
    }

    // OAuth完了直後は、サーバー側の反映が数秒遅れることがある。
    // ログイン中のブラウザが確認できたIdentityも見て、連携完了を見逃さない。
    const { data: identities, error } = await supabase.auth.getUserIdentities();
    const xIdentity: any = identities?.identities?.find((item: any) => item.provider === "x" || item.provider === "twitter");
    if (!error && xIdentity) {
      const identityData = xIdentity.identity_data || {};
      setConnection((current) => current || {
        username: identityData.user_name || identityData.username || identityData.preferred_username || null,
        display_name: identityData.full_name || identityData.name || null,
        connected_at: xIdentity.created_at || new Date().toISOString(),
      });
      // 次回以降も安定して表示できるようテーブルにも同期する。
      fetch("/api/x/connection", { method: "POST" }).catch(() => {});
    }
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
    const identity = data?.identities?.find((item: any) => item.provider === "x" || item.provider === "twitter");
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
      fetch("/api/x/connection", { method: "POST" })
        .then(async (result) => {
          if (!result.ok) throw new Error((await result.json()).error || "X連携情報を確認できませんでした");
          await load();
          setMessage("Xアカウントを連携しました");
        })
        .catch((error) => setMessage(error.message || "X連携情報を確認できませんでした"));
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-full bg-black text-white flex items-center justify-center font-bold text-base">𝕏</div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-bold">Xアカウント</p>
            {connection ? <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✓ 連携済み</span> : <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">未連携</span>}
          </div>
          {loading ? <p className="text-xs text-gray-500 mt-0.5">連携状態を確認中...</p> : connection ? <div className="text-xs text-gray-500 mt-1 space-y-0.5 break-words">
            <p>リュッター：<b className="text-gray-700">{ryutter?.display_name || ryutter?.username || "ユーザー"}</b> <span className="text-gray-400">@{ryutter?.username || "—"}</span></p>
            <p>X：<b className="text-gray-700">@{connection.username || connection.display_name || "Xユーザー"}</b> を連携中</p>
          </div> : <p className="text-xs text-gray-500 mt-1">連携すると、リュッターの投稿をXでシェアできます。</p>}
        </div>
        <div className="col-span-2 sm:col-span-1 sm:col-start-3 sm:row-start-1">
          {connection ? (
            <button onClick={disconnect} className="w-full sm:w-auto text-xs border border-gray-200 rounded-full px-4 py-2 text-gray-600 hover:bg-gray-50 cursor-pointer whitespace-nowrap">連携を解除</button>
          ) : (
            <button onClick={connect} className="w-full sm:w-auto text-xs bg-black text-white rounded-full px-4 py-2 font-bold cursor-pointer whitespace-nowrap">Xと連携する</button>
          )}
        </div>
      </div>
      {message && <p className="text-xs text-primary">{message}</p>}
    </div>
  );
}
