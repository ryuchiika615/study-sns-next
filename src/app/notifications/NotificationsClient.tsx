"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase";

export default function NotificationsClient({ notifications: initial }: { notifications: any[] }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initial);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase.from("notifications").update({ is_read: true })
        .eq("recipient_id", data.user.id)
        .eq("is_read", false)
        .then(({ error }) => { if (error) console.error(error); });
    });
  }, []);

  const getNotificationText = (notif: any) => {
    switch (notif.notification_type) {
      case "like": return "があなたの投稿にいいねしました";
      case "reply": return "があなたの投稿に返信しました";
      case "follow": return "があなたをフォローしました";
      default: return "";
    }
  };

  const handleClick = (notif: any) => {
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
    }
  };

  return (
    <AppShell unreadCount={0}>
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4">通知</h2>

        <div className="space-y-2">
          {notifications.map((notif: any) => (
            <div
              key={notif.id}
              onClick={() => handleClick(notif)}
              className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="avatar-frame w-10 h-10 flex-shrink-0">
                {notif.sender?.icon_url ? (
                  <img src={notif.sender.icon_url} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <i className="fas fa-user-circle text-2xl text-gray-300" />
                )}
              </div>
              <div className="flex-1 text-sm min-w-0">
                <strong>{notif.sender?.display_name || "ユーザー"}</strong>
                <span className="text-gray-500"> {getNotificationText(notif)}</span>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(notif.created_at).toLocaleString("ja-JP")}
                </p>
              </div>
              {notif.notification_type === "follow" ? (
                notif.followed_back ? (
                  <span className="text-xs text-gray-400 whitespace-nowrap">フォロー済み</span>
                ) : (
                  <button
                    onClick={(e) => handleFollowBack(e, notif.sender.id)}
                    className="text-xs bg-blue-500 text-white px-3 py-1 rounded-full hover:bg-blue-600 whitespace-nowrap"
                  >
                    フォローを返す
                  </button>
                )
              ) : (
                <i className={`fas flex-shrink-0 ${notif.notification_type === "like" ? "fa-heart text-danger" : "fa-reply text-primary"}`} />
              )}
            </div>
          ))}
        </div>

        {notifications.length === 0 && (
          <p className="text-center text-gray-500 py-10">通知はありません</p>
        )}
      </div>
    </AppShell>
  );
}
