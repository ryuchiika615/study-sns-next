"use client";

import { appUrl, xIntentUrl } from "@/lib/share";

export default function XShareButton({ shareType, entityId, text, sharePath, compact = false }: {
  shareType: "study_record" | "ranking" | "achievement";
  entityId?: string;
  text: string;
  sharePath: string;
  compact?: boolean;
}) {
  const share = async () => {
    let url = appUrl(sharePath);
    try {
      const res = await fetch("/api/referrals/code");
      if (res.ok) {
        const { code } = await res.json();
        url += `${url.includes("?") ? "&" : "?"}ref=${encodeURIComponent(code)}`;
      }
      await fetch("/api/shares", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shareType, entityId }) });
    } finally {
      window.open(xIntentUrl(text, url), "_blank", "noopener,noreferrer");
    }
  };
  return <button onClick={share} className={compact ? "text-xs text-gray-500 hover:text-black bg-none border-none cursor-pointer" : "flex items-center gap-1.5 rounded-full bg-black text-white px-3 py-1.5 text-xs font-bold cursor-pointer"}><span>𝕏</span><span>でシェア</span></button>;
}
