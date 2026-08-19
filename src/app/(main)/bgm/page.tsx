"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BgmContent from "./BgmContent";

export default function BgmPage() {
  const [isPro, setIsPro] = useState<boolean | null>(null);
  useEffect(() => { fetch("/api/pro/status").then((res) => res.ok ? res.json() : null).then((data) => setIsPro(Boolean(data?.isPro))).catch(() => setIsPro(false)); }, []);
  if (isPro === false) return <div className="mx-4 mt-8 rounded-2xl border border-purple-200 bg-purple-50 p-6 text-center"><p className="text-3xl">🎵🔒</p><h1 className="mt-3 text-lg font-bold text-purple-950">勉強中のBGMはPro限定</h1><p className="mt-2 text-sm text-purple-800">プリセットBGM・マイBGM・YouTube URLからの再生を使えます。</p><Link href="/pro?from=bgm" className="mt-5 inline-block rounded-full bg-purple-600 px-5 py-3 text-sm font-bold text-white no-underline">Proの詳細を見る</Link></div>;
  if (isPro === null) return <div className="p-8 text-center text-sm text-gray-400">確認中...</div>;
  return (
    <div className="mx-4 mb-3 min-h-[70vh]">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <BgmContent />
      </div>
    </div>
  );
}
