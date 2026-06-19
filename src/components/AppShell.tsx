"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import SwipeBack from "./SwipeBack";
import InstallBanner from "./InstallBanner";

const DISMISSED_KEY = "ryutter_dismissed_announcements";

export default function AppShell({ children, unreadCount = 0 }: { children: React.ReactNode; unreadCount?: number }) {
  const initialized = useRef(false);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState<any[]>([]);
  const [pendingGifts, setPendingGifts] = useState<any[]>([]);
  const [showAnnouncement, setShowAnnouncement] = useState<any>(null);
  const [popupAnnouncement, setPopupAnnouncement] = useState<any>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pushMsg, setPushMsg] = useState("");
  const dismissedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    dismissedRef.current = new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"));

    const doPing = () => {
      navigator.sendBeacon("/api/auth/ping", JSON.stringify({}));
    };

    doPing();
    const interval = setInterval(doPing, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const fetchAnnouncementsAndGifts = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: reads } = await supabase
        .from("announcement_reads")
        .select("announcement_id")
        .eq("user_id", user.id);
      const readIds = reads?.map(r => r.announcement_id) || [];
      const { data: announcements } = await supabase
        .from("admin_announcements")
        .select("id, content, image_url, created_at")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });
      if (announcements) {
        const unread = readIds.length > 0
          ? announcements.filter(a => !readIds.includes(a.id))
          : announcements;
        setUnreadAnnouncements(unread);

        // Auto-show the latest unread announcement as popup
        const latest = unread[0];
        if (latest && !dismissedRef.current.has(latest.id) && !popupAnnouncement) {
          setPopupAnnouncement(latest);
        }
      }

      const { data: gifts } = await supabase
        .from("pending_gifts")
        .select("id, item_id, message, created_at")
        .is("claimed_at", null)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (gifts && gifts.length > 0) {
        const itemIds = gifts.map(g => g.item_id);
        const { data: items } = await supabase
          .from("gacha_items")
          .select("id, name, rarity, category")
          .in("id", itemIds);
        const itemMap = new Map(items?.map(i => [i.id, i]) || []);
        setPendingGifts(gifts.map(g => ({ ...g, gacha_items: itemMap.get(g.item_id) || null })));
      } else {
        setPendingGifts([]);
      }
    };
    fetchAnnouncementsAndGifts();
    const timer = setInterval(fetchAnnouncementsAndGifts, 15000);
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
    setPopupAnnouncement(null);

    // Show next unread
    const next = unreadAnnouncements.filter((a: any) => a.id !== id)[0];
    if (next) setPopupAnnouncement(next);
  };

  const dismissPopup = (id: string) => {
    dismissedRef.current.add(id);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissedRef.current]));
    setPopupAnnouncement(null);
  };

  const claimGift = async (giftId: string) => {
    const res = await fetch("/api/gifts/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ giftId }),
    });
    if (res.ok) {
      setPendingGifts((prev) => prev.filter((g: any) => g.id !== giftId));
    }
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
    if (Notification.permission === "granted" || Notification.permission === "default") {
      subscribe();
    }
  }, []);

  const totalUnread = unreadAnnouncements.length + pendingGifts.length;

  return (
    <>
      <Sidebar />
      <div className="ryutter-home-banner bg-gradient-to-b from-gray-900 to-blue-900 border-b-3 border-yellow-600 text-center py-3 shadow-lg mb-4">
        <h1 className="text-2xl text-yellow-600 font-serif tracking-wider m-0" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
          RYUTTER
        </h1>
        <p className="text-xs text-yellow-600 tracking-widest">リュッター</p>

        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <Link href="/notifications"
            className="text-lg bg-white/20 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer hover:bg-white/30 transition relative">
            <i className="far fa-bell text-yellow-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-md">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <div className="relative">
            <button onClick={() => setSettingsOpen(!settingsOpen)}
              className="text-lg bg-white/20 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer hover:bg-white/30 transition">
              <i className="fas fa-cog text-yellow-600" />
            </button>
            {settingsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setSettingsOpen(false); setPushMsg(""); }} />
                <div className="absolute top-full right-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-2 min-w-[220px]">
                  {pushMsg && <div className="px-3 py-1.5 mb-1 bg-blue-50 text-blue-700 rounded-lg text-[10px]">{pushMsg}</div>}
                  <Link href="/settings" onClick={() => setSettingsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition text-sm no-underline text-gray-700">
                    <i className="fas fa-envelope text-primary w-5 text-center" />
                    <span>要望・報告</span>
                  </Link>
                  <div className="border-t border-gray-100 mt-1 pt-2 px-3 pb-1">
                    <p className="text-[10px] text-gray-500 mb-2">プッシュ通知が届かないときは再登録</p>
                    <button onClick={async () => {
                      try {
                        const reg = await navigator.serviceWorker.ready;
                        const sub = await reg.pushManager.getSubscription();
                        if (sub) await sub.unsubscribe();
                        const key = "BDoPeVkeMYclyZBi4GMNRh4dNemJzOTvdnT3Qn-7Zt313qt6EPpOGohsbWjpgc5kh_KpeDQXxC9ndI_kqs23dgg";
                        const applicationServerKey = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
                        const fresh = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
                        const json = fresh.toJSON();
                        const res = await fetch("/api/push/subscribe", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
                        });
                        const data = await res.json();
                        setPushMsg(data.ok ? "プッシュ通知を再登録しました！" : "再登録に失敗しました。");
                      } catch {
                        setPushMsg("再登録に失敗しました。ブラウザの通知設定を確認してください。");
                      }
                    }}
                      className="w-full bg-primary text-white font-bold rounded-full py-1 text-xs cursor-pointer mb-1.5">
                      <i className="fas fa-sync-alt mr-1" /> 通知を再登録
                    </button>
                    <button onClick={async () => {
                      try {
                        const res = await fetch("/api/push/test", { method: "POST" });
                        const data = await res.json();
                        setPushMsg(data.ok ? `テスト通知を送信しました (${data.sent}件)` : (data.error || "テスト送信に失敗しました"));
                      } catch {
                        setPushMsg("テスト送信に失敗しました");
                      }
                    }}
                      className="w-full bg-orange-500 text-white font-medium rounded-full py-1 text-xs cursor-pointer hover:bg-orange-400 transition">
                      <i className="fas fa-paper-plane mr-1" /> テスト通知を送信
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <button onClick={() => setShowAnnouncement("list")}
            className="text-lg bg-white/20 rounded-full w-9 h-9 flex items-center justify-center cursor-pointer hover:bg-white/30 transition relative">
            <i className="far fa-envelope text-yellow-600" />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </button>
        </div>
      </div>

      <SwipeBack>
        <div className="container mx-auto max-w-2xl px-0 page-enter">
          {children}
        </div>
      </SwipeBack>

      <BottomNav unreadCount={unreadCount} />
      <InstallBanner />

      {/* お知らせポップアップ（自動表示） */}
      {popupAnnouncement && (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto p-4" onClick={() => dismissPopup(popupAnnouncement.id)}>
          <div className="flex items-center justify-center min-h-full">
            <div className="bg-white rounded-xl max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4">
                <h3 className="font-bold text-base">📢 お知らせ</h3>
                <button onClick={() => dismissPopup(popupAnnouncement.id)}
                  className="text-gray-500 text-xl cursor-pointer">
                  <i className="fas fa-times" />
                </button>
              </div>
              <div className="px-4 pb-4">
                {popupAnnouncement.image_url && (
                  <img src={popupAnnouncement.image_url} alt="" className="w-full rounded-lg mb-3 max-h-60 object-cover" />
                )}
                <p className="text-sm whitespace-pre-wrap">{popupAnnouncement.content}</p>
                <p className="text-xs text-gray-400 mt-3">{new Date(popupAnnouncement.created_at).toLocaleString("ja-JP")}</p>
              </div>
              <div className="px-4 pb-4 space-y-2">
                <button onClick={() => markAnnouncementRead(popupAnnouncement.id)}
                  className="w-full bg-primary text-white font-bold rounded-full py-2 text-sm cursor-pointer">
                  既読にする
                </button>
                <div className="text-center">
                  <button onClick={() => dismissPopup(popupAnnouncement.id)}
                    className="text-xs text-gray-500 cursor-pointer bg-transparent border-none">
                    後で見る
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
              {totalUnread === 0 && (
                <p className="text-center text-gray-400 py-8 text-sm">新しいお知らせはありません</p>
              )}

              {pendingGifts.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-purple-600 mb-2">🎁 受け取れるプレゼント</h4>
                  {pendingGifts.map((g: any) => (
                    <div key={g.id} className="border border-purple-200 rounded-lg p-3 bg-purple-50 mb-2">
                      <p className="text-sm font-bold mb-1">{g.gacha_items?.name}</p>
                      {g.gacha_items?.rarity && (
                        <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">
                          {g.gacha_items.rarity}
                        </span>
                      )}
                      {g.message && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{g.message}</p>}
                      <p className="text-xs text-gray-400 mt-1">{new Date(g.created_at).toLocaleString("ja-JP")}</p>
                      <button onClick={() => claimGift(g.id)}
                        className="mt-2 w-full text-sm bg-purple-600 text-white rounded-lg py-2 font-bold cursor-pointer hover:bg-purple-700 transition">
                        受け取る
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {unreadAnnouncements.length > 0 && (
                <div>
                  {pendingGifts.length > 0 && <h4 className="text-sm font-bold text-gray-600 mb-2">📢 お知らせ</h4>}
                  {unreadAnnouncements.map((a: any) => (
                    <div key={a.id} className="border border-gray-200 rounded-lg p-3">
                      {a.image_url && <img src={a.image_url} alt="" className="w-full rounded-lg mb-2 max-h-48 object-cover" />}
                      <p className="text-sm whitespace-pre-wrap mb-2">{a.content}</p>
                      <p className="text-xs text-gray-400 mb-2">{new Date(a.created_at).toLocaleString("ja-JP")}</p>
                      <button onClick={() => markAnnouncementRead(a.id)}
                        className="text-xs text-primary font-bold cursor-pointer">
                        既読にする
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
