"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/use-language";

export default function ProPlanCard({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<{ isPro: boolean; expiresAt?: string | null; source?: string | null } | null>(null);
  const { isEnglish } = useLanguage();

  useEffect(() => {
    const load = () => fetch("/api/pro/status").then(async (res) => res.ok && setStatus(await res.json())).catch(() => {});
    if (window.location.search.includes("checkout=success")) {
      fetch("/api/stripe/sync", { method: "POST" }).finally(load);
    } else load();
  }, []);

  if (status?.isPro) {
    const expires = status.expiresAt ? new Date(status.expiresAt).toLocaleDateString(isEnglish ? "en-US" : "ja-JP") + (isEnglish ? "" : "まで") : (isEnglish ? "Active" : "有効");
    return <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <p className="font-bold text-purple-800"><i className="fas fa-crown mr-1" /> {isEnglish ? "Pro member" : "Proメンバー"}</p>
      <p className="text-xs text-purple-700 mt-1">{isEnglish ? `Unlimited plans and textbooks (${expires})` : `計画・教材を無制限に使えます（${expires}）`}</p>
    </div>;
  }

  return <div className={`rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 ${compact ? "p-3" : "p-4"}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-bold text-purple-900"><i className="fas fa-crown mr-1" /> RYUTTER Pro <span className="text-xs font-normal">{isEnglish ? "¥240 / month" : "月額240円"}</span></p>
        <p className="text-xs text-purple-800 mt-1">{isEnglish ? "Unlimited tasks and textbooks, AI learning support, and exam planning." : "タスク・教材を無制限に。AI学習サポートと試験逆算プランも使えます。"}</p>
      </div>
      <Link href="/pro" className="shrink-0 rounded-full bg-purple-600 px-3 py-1.5 text-xs font-bold text-white no-underline">{isEnglish ? "View Pro" : "Proを見る"}</Link>
    </div>
  </div>;
}
