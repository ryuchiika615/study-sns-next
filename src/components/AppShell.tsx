"use client";

import { useEffect, useRef, useState } from "react";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";

export default function AppShell({ children, unreadCount = 0 }: { children: React.ReactNode; unreadCount?: number }) {
  const initialized = useRef(false);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState<any[]>([]);
  const [showAnnouncement, setShowAnnouncement] = useState<any>(null);

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
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch("/api/announcements");
        if (res.ok) {
          const data = await res.json();
          setUnreadAnnouncements(data.announcements || []);
        }
      } catch (_) {}
    };
    fetchAnnouncements();
    const timer = setInterval(fetchAnnouncements, 15000);
    return () => clearInterval(timer);
  }, []);

  const markAnnouncementRead = async (id: string) => {
    await fetch("/api/announcements/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ announcementId: id }),
    });
    setUnreadAnnouncements((prev) => prev.filter((a: any) => a.id !== id));
    setShowAnnouncement(null);
  };

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const key = "BDoPeVkeMYclyZBi4GMNRh4dNemJzOTvdnT3Qn-7Zt313qt6EPpOGohsbWjpgc5kh_KpeDQXxC9ndI_kqs23dgg";
    const applicationServerKey = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

    const subscribe = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          const json = existing.toJSON();
          fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
          }).catch(() => {});
          return;
        }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
        const json = sub.toJSON();
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        }).catch(() => {});
      } catch (_) {}
    };
    if (Notification.permission === "granted") {
      subscribe();
    } else if (Notification.permission === "default") {
      subscribe();
    }
  }, []);

  const currentAnnouncement = showAnnouncement && showAnnouncement !== "list"
    ? showAnnouncement
    : unreadAnnouncements.length > 0 ? unreadAnnouncements[0] : null;

  return (
    <>
      <div className="ryutter-home-banner bg-gradient-to-b from-gray-900 to-blue-900 border-b-3 border-yellow-600 text-center py-4 shadow-lg mb-4 relative">
        <Sidebar />
        <h1 className="text-3xl text-yellow-600 font-serif tracking-wider m-0" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
          RYUTTER
        </h1>
        <p className="text-sm text-yellow-600 tracking-widest mt-1">リュッター</p>

        <button onClick={() => setShowAnnouncement("list")}
          className="absolute top-4 right-4 text-xl bg-white/20 rounded-full w-10 h-10 flex items-center justify-center cursor-pointer hover:bg-white/30 transition">
          <i className="far fa-envelope text-yellow-600" />
          {unreadAnnouncements.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {unreadAnnouncements.length > 9 ? "9+" : unreadAnnouncements.length}
            </span>
          )}
        </button>
      </div>

      <div className="container mx-auto max-w-2xl px-0">
        {children}
      </div>

      <BottomNav unreadCount={unreadCount} />

      {showAnnouncement === "list" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAnnouncement(null)}>
          <div className="bg-white rounded-xl max-w-md w-full max-h-[70vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-bold text-lg">📨 お知らせ一覧</h3>
              <button onClick={() => setShowAnnouncement(null)} className="text-gray-500 text-xl cursor-pointer">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {unreadAnnouncements.length === 0 && (
                <p className="text-center text-gray-400 py-8 text-sm">新しいお知らせはありません</p>
              )}
              {unreadAnnouncements.map((a: any) => (
                <div key={a.id} className="border border-gray-200 rounded-lg p-3">
                  <p className="text-sm whitespace-pre-wrap mb-2">{a.content}</p>
                  <p className="text-xs text-gray-400 mb-2">{new Date(a.created_at).toLocaleString("ja-JP")}</p>
                  <button onClick={() => markAnnouncementRead(a.id)}
                    className="text-xs text-primary font-bold cursor-pointer">
                    既読にする
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
