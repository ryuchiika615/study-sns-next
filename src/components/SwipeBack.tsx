"use client";

import { useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export default function SwipeBack({ children }: { children: ReactNode }) {
  const router = useRouter();
  const startX = useRef(0);

  return (
    <div
      onTouchStart={(e) => { startX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - startX.current;
        if (dx > 80 && startX.current < 40) router.back();
      }}
    >
      {children}
    </div>
  );
}
