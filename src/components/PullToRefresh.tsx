"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: React.ReactNode }) {
  const [state, setState] = useState<"idle" | "pulling" | "ready" | "refreshing" | "done">("idle");
  const [pullDist, setPullDist] = useState(0);
  const startY = useRef(0);
  const distRef = useRef(0);
  const refreshingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 60;
  const MAX_PULL = 120;

  // Damping: Twitter-style diminishing resistance
  const damping = (dist: number) => {
    if (dist < 0) return 0;
    const d = Math.min(dist, MAX_PULL * 2);
    return Math.min(d * 0.5, MAX_PULL);
  };

  // PC refresh button
  const handlePcRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setState("refreshing");
    await onRefresh();
    setState("done");
    setTimeout(() => {
      refreshingRef.current = false;
      setState("idle");
    }, 800);
  }, [onRefresh]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0 || refreshingRef.current) return;
    startY.current = e.touches[0].clientY;
    distRef.current = 0;
    setPullDist(0);
    setState("idle");
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (refreshingRef.current || window.scrollY > 0 || startY.current === 0) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff <= 0) return;
    e.preventDefault();
    const damped = damping(diff);
    distRef.current = damped;
    setPullDist(damped);
    setState(damped >= THRESHOLD ? "ready" : "pulling");
  };

  const handleTouchEnd = async () => {
    const dist = distRef.current;
    startY.current = 0;
    distRef.current = 0;
    if (dist >= THRESHOLD && !refreshingRef.current) {
      refreshingRef.current = true;
      setState("refreshing");
      setPullDist(0);
      await onRefresh();
      setState("done");
      await new Promise((r) => setTimeout(r, 800));
      refreshingRef.current = false;
      setState("idle");
    } else {
      setState("idle");
      setPullDist(0);
    }
  };

  const progress = Math.min(pullDist / THRESHOLD, 1);
  const indicatorSize = 28;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative"
    >
      {/* Pull indicator */}
      <div
        className="flex items-center justify-center overflow-hidden select-none"
        style={{
          height: state === "refreshing" || state === "done" ? 48 : `${Math.min(pullDist * 0.5, 48)}px`,
          opacity: state === "idle" ? 0 : 1,
          transition: state === "idle" || state === "done" ? "height 0.3s ease-out, opacity 0.3s ease-out" : "none",
        }}
      >
        {state === "pulling" || state === "ready" ? (
          <div className="flex items-center gap-2">
            <svg width={indicatorSize} height={indicatorSize} viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="11" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
              <circle
                cx="14" cy="14" r="11" fill="none"
                stroke={progress >= 1 ? "#1d9bf0" : "#9ca3af"}
                strokeWidth="2.5"
                strokeDasharray="69.1"
                strokeDashoffset={69.1 * (1 - progress)}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.05s linear, stroke 0.15s" }}
                transform="rotate(-90 14 14)"
              />
            </svg>
            {progress >= 1 && <span className="text-xs text-gray-500 font-medium">指を離して更新</span>}
          </div>
        ) : state === "refreshing" ? (
          <div className="flex items-center gap-2">
            <svg width={indicatorSize} height={indicatorSize} viewBox="0 0 28 28" className="animate-spin" style={{ animationDuration: "0.8s" }}>
              <circle cx="14" cy="14" r="11" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
              <circle cx="14" cy="14" r="11" fill="none" stroke="#1d9bf0" strokeWidth="2.5"
                strokeDasharray="69.1" strokeDashoffset="51.8" strokeLinecap="round" />
            </svg>
            <span className="text-xs text-gray-500 font-medium">更新中...</span>
          </div>
        ) : state === "done" ? (
          <div className="flex items-center gap-2">
            <svg width={indicatorSize} height={indicatorSize} viewBox="0 0 28 28">
              <circle cx="14" cy="14" r="11" fill="none" stroke="#22c55e" strokeWidth="2.5" />
              <path d="M9 14l3 3 7-7" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-xs text-green-600 font-medium">更新しました</span>
          </div>
        ) : null}
      </div>

      {children}

      {/* PC refresh button */}
      <button
        onClick={handlePcRefresh}
        disabled={refreshingRef.current}
        className="hidden md:flex fixed bottom-20 right-4 w-10 h-10 bg-white rounded-full shadow-lg items-center justify-center cursor-pointer border-none hover:shadow-xl transition disabled:opacity-50 z-40"
        title="更新"
        style={{ color: "#1d9bf0" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={refreshingRef.current ? "animate-spin" : ""}>
          <path d="M21 2v6h-6" />
          <path d="M3 12a9 9 0 0115.364-6.364L21 8" />
          <path d="M3 22v-6h6" />
          <path d="M21 12a9 9 0 01-15.364 6.364L3 16" />
        </svg>
      </button>
    </div>
  );
}
