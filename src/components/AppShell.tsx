"use client";

import { useEffect, useRef } from "react";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

export default function AppShell({ children, unreadCount = 0 }: { children: React.ReactNode; unreadCount?: number }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const doPing = () => {
      navigator.sendBeacon("/api/auth/ping", JSON.stringify({}));
    };

    doPing();
    const interval = setInterval(doPing, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: "BDoPeVkeMYclyZBi4GMNRh4dNemJzOTvdnT3Qn-7Zt313qt6EPpOGohsbWjpgc5kh_KpeDQXxC9ndI_kqs23dgg",
      }).then((sub) => {
        const json = sub.toJSON();
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        });
      }).catch(() => {});
    }).catch(() => {});
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
