"use client";

import { useRef, useState } from "react";

export default function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: React.ReactNode }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const distRef = useRef(0);
  const animFrame = useRef(0);
  const refreshingRef = useRef(false);

  const THRESHOLD = 60;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0 || refreshingRef.current) return;
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (refreshingRef.current || window.scrollY > 0 || startY.current === 0) return;
    const clientY = e.touches[0].clientY;
    cancelAnimationFrame(animFrame.current);
    animFrame.current = requestAnimationFrame(() => {
      const diff = clientY - startY.current;
      if (diff > 0) {
        const damped = Math.min(diff * 0.5, 120);
        distRef.current = damped;
        setPullDistance(damped);
      }
    });
  };

  const handleTouchEnd = async () => {
    startY.current = 0;
    const dist = distRef.current;
    distRef.current = 0;
    if (dist > THRESHOLD && !refreshingRef.current) {
      refreshingRef.current = true;
      setRefreshing(true);
      setPullDistance(0);
      await onRefresh();
      refreshingRef.current = false;
      setRefreshing(false);
    } else {
      setPullDistance(0);
    }
  };

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const showIndicator = pullDistance > 10;

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {/* 更新中スピナー */}
      {refreshing && (
        <div className="flex items-center justify-center py-3">
          <svg width="28" height="28" viewBox="0 0 28 28" className="animate-spin" style={{ animationDuration: "0.8s" }}>
            <circle cx="14" cy="14" r="11" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
            <circle cx="14" cy="14" r="11" fill="none" stroke="#1d9bf0" strokeWidth="2.5"
              strokeDasharray="69.1" strokeDashoffset="51.8" strokeLinecap="round" />
          </svg>
        </div>
      )}
      {/* プル中インジケーター（Google風） */}
      {!refreshing && showIndicator && (
        <div className="flex items-center justify-center overflow-hidden"
          style={{
            height: `${pullDistance * 0.5}px`,
            opacity: progress,
            transition: "height 0.1s ease-out",
          }}>
          <svg width="28" height="28" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="11" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
            <circle cx="14" cy="14" r="11" fill="none" stroke={progress >= 1 ? "#1d9bf0" : "#9ca3af"}
              strokeWidth="2.5"
              strokeDasharray="69.1"
              strokeDashoffset={69.1 * (1 - progress)}
              strokeLinecap="round"
              style={{ transition: "stroke 0.15s" }} />
          </svg>
        </div>
      )}
      {children}
    </div>
  );
}
