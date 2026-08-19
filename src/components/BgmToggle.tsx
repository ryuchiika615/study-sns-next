"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface BgmToggleProps {
  className?: string;
  iconOnly?: boolean;
}

export default function BgmToggle({ className, iconOnly }: BgmToggleProps) {
  const router = useRouter();
  const [isPro, setIsPro] = useState<boolean | null>(null);
  useEffect(() => { fetch("/api/pro/status").then((res) => res.ok ? res.json() : null).then((data) => setIsPro(Boolean(data?.isPro))).catch(() => setIsPro(false)); }, []);

  return (
    <button onClick={() => router.push(isPro ? "/bgm" : "/pro?from=bgm")}
      title={isPro ? "BGMを開く" : "BGM再生はPro限定"}
      className={className || "fixed bottom-20 right-6 z-40 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-primary/90 border-none text-xl"}>
      <i className={`fas ${isPro ? "fa-music" : "fa-lock"}`} />
    </button>
  );
}
