"use client";

import { useEffect, useState } from "react";

export function FounderCheckoutButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/founder/status").then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      setRemaining(data.remaining);
    }).catch(() => {});
  }, []);

  const open = async () => {
    setLoading(true); setMessage("");
    try {
      const res = await fetch("/api/stripe/founder-checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) { setMessage(data.error || "開けませんでした。"); return; }
      window.location.assign(data.url);
    } catch { setMessage("通信に失敗しました。"); } finally { setLoading(false); }
  };

  return <div>
    <button onClick={open} disabled={loading || remaining === 0} className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-black text-white shadow cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
      {loading ? "決済画面を準備中…" : remaining === 0 ? "創設メンバーは受付終了しました" : `永久Proを500円で受け取る${remaining !== null ? `（残り${remaining}名）` : ""}`}
    </button>
    {message && <p className="mt-2 text-center text-xs font-bold text-red-600">{message}</p>}
  </div>;
}
