"use client";

import { useRef, useState } from "react";

export default function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: React.ReactNode }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const distRef = useRef(0);
  const animFrame = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0 || refreshing) return;
    startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (refreshing || window.scrollY > 0 || startY.current === 0) return;
    const clientY = e.touches[0].clientY;
    cancelAnimationFrame(animFrame.current);
    animFrame.current = requestAnimationFrame(() => {
      const diff = clientY - startY.current;
      if (diff > 0) {
        distRef.current = Math.min(diff * 0.4, 100);
        setPullDistance(distRef.current);
      }
    });
  };

  const handleTouchEnd = async () => {
    startY.current = 0;
    const dist = distRef.current;
    distRef.current = 0;
    if (dist > 55 && !refreshing) {
      setRefreshing(true);
      setPullDistance(0);
      await onRefresh();
      setRefreshing(false);
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {refreshing && (
        <div className="flex items-center justify-center py-4 text-sm text-primary">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="ml-2">更新中...</span>
        </div>
      )}
      {pullDistance > 0 && (
        <div className="flex items-center justify-center py-4 text-sm text-gray-500 transition-all duration-100"
          style={{ transform: `translateY(${pullDistance * 0.5}px)`, opacity: Math.min(pullDistance / 50, 1) }}>
          <div className={`w-5 h-5 rounded-full border-2 ${pullDistance > 55 ? "border-primary" : "border-gray-300 border-t-gray-500 animate-spin"}`} />
          <span className="ml-2">{pullDistance > 55 ? "指を離して更新" : "引っ張って更新"}</span>
        </div>
      )}
      {children}
    </div>
  );
}
