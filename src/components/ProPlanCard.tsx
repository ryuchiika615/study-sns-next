"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ProPlanCard({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<{ isPro: boolean; expiresAt?: string | null; source?: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/pro/status").then(async (res) => res.ok && setStatus(await res.json())).catch(() => {});
  }, []);

  if (status?.isPro) {
    const expires = status.expiresAt ? new Date(status.expiresAt).toLocaleDateString("ja-JP") + "まで" : "有効";
    return <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4">
      <p className="font-bold text-purple-800"><i className="fas fa-crown mr-1" /> Proメンバー</p>
      <p className="text-xs text-purple-700 mt-1">計画・教材を無制限に使えます（{expires}）</p>
    </div>;
  }

  return <div className={`rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 ${compact ? "p-3" : "p-4"}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-bold text-purple-900"><i className="fas fa-crown mr-1" /> リュッター Pro</p>
        <p className="text-xs text-purple-800 mt-1">タスク・習慣・教材を無制限に。長期の目標管理をもっと自由に。</p>
      </div>
      <Link href="/pro" className="shrink-0 rounded-full bg-purple-600 px-3 py-1.5 text-xs font-bold text-white no-underline">詳細</Link>
    </div>
  </div>;
}
