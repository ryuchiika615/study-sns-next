"use client";

import { useEffect, useRef } from "react";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

export default function AppShell({ children, unreadCount = 0 }: { children: React.ReactNode; unreadCount?: number }) {
  const pinged = useRef(false);

  useEffect(() => {
    if (pinged.current) return;
    pinged.current = true;

    const doPing = () => {
      navigator.sendBeacon("/api/auth/ping", JSON.stringify({}));
    };

    doPing();
    const interval = setInterval(doPing, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="ryutter-home-banner bg-gradient-to-b from-gray-900 to-blue-900 border-b-3 border-yellow-600 text-center py-4 shadow-lg mb-4">
        <Sidebar />
        <h1 className="text-3xl text-yellow-600 font-serif tracking-wider m-0" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
          RYUTTER
        </h1>
        <p className="text-sm text-yellow-600 tracking-widest mt-1">リュッター</p>
      </div>

      <div className="container mx-auto max-w-2xl px-0">
        {children}
      </div>

      <BottomNav unreadCount={unreadCount} />
    </>
  );
}
