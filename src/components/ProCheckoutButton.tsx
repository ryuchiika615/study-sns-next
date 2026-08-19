"use client";
import { useState } from "react";

export function ProCheckoutButton({ portal = false }: { portal?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const open = async () => {
    setLoading(true); setMessage("");
    try {
      const res = await fetch(portal ? "/api/stripe/portal" : "/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) { setMessage(data.error || "開けませんでした。"); return; }
      window.location.assign(data.url);
    } catch { setMessage("通信に失敗しました。"); } finally { setLoading(false); }
  };
  return <div><button onClick={open} disabled={loading} className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-bold text-white shadow cursor-pointer disabled:opacity-50">{loading ? "準備中…" : portal ? "契約を管理する" : "月額240円でProを始める"}</button>{message && <p className="mt-2 text-center text-xs text-red-600">{message}</p>}</div>;
}
