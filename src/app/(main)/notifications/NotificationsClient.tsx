"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { getOptimizedIconUrl } from "@/lib/utils";

interface GiftBgm {
  id: string;
  name: string;
  audio_url: string;
}

export default function NotificationsClient({ notifications: initial }: { notifications: any[] }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initial);
  const [giftBgms, setGiftBgms] = useState<Record<string, GiftBgm>>({});
  const [showGift, setShowGift] = useState<GiftBgm | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase.from("notifications").update({ is_read: true })
        .eq("recipient_id", data.user.id)
        .eq("is_read", false)
        .then(({ error }) => { if (error) console.error(error); });
      supabase.rpc("cleanup_old_notifications", { days_old: 30 }).then(() => {});
    });

    const giftNotifs = initial.filter((n: any) => n.notification_type === "gift" && n.post_id);
    if (giftNotifs.length > 0) {
      Promise.all(giftNotifs.map(async (n: any) => {
        try {
          const res = await fetch(`/api/bgm/get?id=${n.post_id}`);
          if (res.ok) {
            const bgm = await res.json();
            return { id: n.post_id, bgm };
          }
        } catch {}
        return null;
      })).then((results) => {
        const map: Record<string, GiftBgm> = {};
        results.forEach((r) => { if (r) map[r.id] = r.bgm; });
        setGiftBgms(map);
      });
    }
  }, []);

  const getNotificationText = (notif: any) => {
    switch (notif.notification_type) {
      case "like": return "がリアクションしました";
      case "reply": return "からコメントが来ました";
      case "follow": return "がフォローしました";
      case "follow_post": return "が投稿しました";
      case "gift": return "からプレゼントが届きました 🎁";
      case "mention": return "からメンションが来ました";
      default: return "";
    }
  };

  const getSenderName = (notif: any) => {
    if (notif.notification_type === "gift" && notif.sender?.is_admin) {
      return "管理者";
    }
    return notif.sender?.display_name || "ユーザー";
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "like": return "fa-smile text-yellow-500";
      case "reply": return "fa-reply text-blue-500";
      case "follow": return "fa-user-plus text-green-500";
      case "follow_post": return "fa-retweet text-blue-400";
      case "gift": return "fa-gift text-purple-500";
      case "mention": return "fa-at text-purple-500";
      default: return "fa-bell text-gray-400";
    }
  };

  const handleClick = (notif: any) => {
    if (notif.notification_type === "gift" && notif.post_id) {
      const bgm = giftBgms[notif.post_id];
      if (bgm) {
        setShowGift(bgm);
        return;
      }
    }
    if (notif.notification_type === "follow") {
      router.push(`/profile/${notif.sender?.id}`);
    } else if (notif.post_id) {
      router.push(`/post/${notif.post_id}`);
    }
  };

  const handleFollowBack = async (e: React.MouseEvent, senderId: string) => {
    e.stopPropagation();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("follows").insert({
      follower_id: user.id,
      followee_id: senderId,
    });
    if (error) {
      console.error(error);
    } else {
      setNotifications((prev) =>
        prev.map((n) =>
          n.sender?.id === senderId ? { ...n, followed_back: true } : n
        )
      );
      fetch("/api/push/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "follow", recipient_id: senderId }),
      }).catch(() => {});
    }
  };

  return (
    <div className="mx-4 my-4 space-y-3">
        {notifications.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-12 text-center">
            <p className="text-gray-400"><i className="far fa-bell-slash text-3xl mb-2 block" /></p>
            <p className="text-gray-500 text-sm">通知はありません</p>
          </div>
        )}
        {notifications.map((notif: any) => (
          <div
            key={notif.id}
            onClick={() => handleClick(notif)}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50 transition-colors active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              {notif.sender?.icon_url && !notif.sender?.is_admin ? (
                <Image src={getOptimizedIconUrl(notif.sender.icon_url, 120)} width={40} height={40} className="rounded-full object-cover" alt="" />
              ) : (
                <i className={`fas ${getIcon(notif.notification_type)} text-lg`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm truncate">{getSenderName(notif)}</span>
                <i className={`fas ${getIcon(notif.notification_type)} text-xs flex-shrink-0`} />
              </div>
              <p className="text-sm text-gray-600 mt-0.5">
                {notif.notification_type === "gift" && notif.post_id && giftBgms[notif.post_id] ? (
                  <><span className="text-gray-400">から</span> <span className="text-purple-600 font-medium">「{giftBgms[notif.post_id].name}」</span> <span className="text-gray-400">が届きました 🎁</span></>
                ) : (
                  <span className="text-gray-400">{getNotificationText(notif)}</span>
                )}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(notif.created_at).toLocaleString("ja-JP")}
              </p>
            </div>
            <div className="flex-shrink-0">
              {notif.notification_type === "follow" ? (
                notif.followed_back ? (
                  <span className="text-xs text-gray-400 whitespace-nowrap bg-gray-100 px-2.5 py-1 rounded-full">フォロー済み</span>
                ) : (
                  <button
                    onClick={(e) => handleFollowBack(e, notif.sender.id)}
                    className="text-xs bg-primary text-white px-3 py-1.5 rounded-full hover:bg-blue-600 whitespace-nowrap font-bold active:scale-95 transition">
                    フォローを返す
                  </button>
                )
              ) : null}
            </div>
          </div>
        ))}

      {showGift && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowGift(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl mb-4">🎁</div>
            <h3 className="text-lg font-bold mb-2">プレゼントが届きました！</h3>
            <div className="bg-purple-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-500 mb-1">受け取ったBGM</p>
              <p className="text-lg font-bold text-purple-700">{showGift.name}</p>
              <audio src={showGift.audio_url} controls className="w-full mt-3 h-10 rounded-lg" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setShowGift(null); window.dispatchEvent(new CustomEvent("bgm-select", { detail: `user-${showGift.id}` })); }}
                className="flex-1 bg-primary text-white font-bold rounded-full py-2 text-sm cursor-pointer border-none">
                使う
              </button>
              <button onClick={() => setShowGift(null)}
                className="flex-1 bg-gray-100 text-gray-700 rounded-full py-2 text-sm cursor-pointer border-none">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
