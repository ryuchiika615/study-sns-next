"use client";
import { useEffect, useState } from "react";

export default function RescueSemesterCheckout() {
  const [owned, setOwned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { fetch("/api/digital-products/rescue-semester/status").then(r => r.json()).then(d => setOwned(Boolean(d.owned))).catch(() => {}); }, []);
  const open = async () => {
    if (owned) return window.location.assign("/api/digital-products/rescue-semester/download");
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/stripe/rescue-semester-checkout", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.url) return setMessage(data.error || "決済画面を開けませんでした。");
      window.location.assign(data.url);
    } catch { setMessage("通信に失敗しました。"); } finally { setLoading(false); }
  };
  return <div><button type="button" onClick={open} disabled={loading} style={{width:"100%",border:0,borderRadius:12,padding:"14px 18px",background:"#111827",color:"white",fontWeight:800,cursor:"pointer"}}>{loading ? "準備中…" : owned ? "購入済みの学期版をダウンロード" : "学期版を500円で購入"}</button>{message && <p style={{color:"#b91c1c",fontWeight:700,fontSize:13}}>{message}</p>}</div>;
}
