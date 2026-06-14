"use client";

import { useEffect } from "react";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase";

export default function NotificationsClient({ notifications: initial }: { notifications: any[] }) {
  useEffect(() => {
    const supabase = createClient();
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

  return (
    <AppShell unreadCount={0}>
      <div className="p-4">
        <h2 className="text-lg font-bold mb-4">通知</h2>

        <div className="space-y-2">
          {initial.map((notif: any) => (
            <div key={notif.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-100 p-3">
              <div className="avatar-frame w-10 h-10">
                {notif.sender?.icon_url ? (
                  <img src={notif.sender.icon_url} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <i className="fas fa-user-circle text-2xl text-gray-300" />
                )}
              </div>
              <div className="flex-1 text-sm">
                <strong>{notif.sender?.display_name || "ユーザー"}</strong>
                <span className="text-gray-500"> {getNotificationText(notif)}</span>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(notif.created_at).toLocaleString("ja-JP")}
                </p>
              </div>
              {notif.notification_type === "follow" ? (
                <i className="fas fa-user-plus text-blue-500" />
              ) : (
                <i className={`fas ${notif.notification_type === "like" ? "fa-heart text-danger" : "fa-reply text-primary"}`} />
              )}
            </div>
          ))}
        </div>

        {initial.length === 0 && (
          <p className="text-center text-gray-500 py-10">通知はありません</p>
        )}
      </div>
    </AppShell>
  );
}
