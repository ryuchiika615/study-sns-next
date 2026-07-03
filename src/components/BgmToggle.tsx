"use client";

import { useRouter } from "next/navigation";

interface BgmToggleProps {
  className?: string;
  iconOnly?: boolean;
}

export default function BgmToggle({ className, iconOnly }: BgmToggleProps) {
  const router = useRouter();

  return (
    <button onClick={() => router.push("/bgm")}
      className={className || "fixed bottom-20 right-6 z-40 w-14 h-14 rounded-full bg-primary text-white shadow-lg flex items-center justify-center cursor-pointer hover:bg-primary/90 border-none text-xl"}>
      <i className="fas fa-music" />
    </button>
  );
}
