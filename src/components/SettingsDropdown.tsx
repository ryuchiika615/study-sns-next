"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

export default function SettingsDropdown({
  onClose,
}: {
  onClose: () => void;
}) {
  const [page, setPage] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("");
  const [quietHoursEnd, setQuietHoursEnd] = useState("");
  const [dailySummary, setDailySummary] = useState(true);
  const [pushAdminAnnouncements, setPushAdminAnnouncements] = useState(true);
  const [notifyChallenge, setNotifyChallenge] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [weeklyReportHidden, setWeeklyReportHidden] = useState(
    () => localStorage.getItem("weekly_report_dismissed") === "1"
  );

  const loadNotifSettings = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("notification_settings")
      .select("quiet_hours_start, quiet_hours_end, daily_summary, push_admin_announcements, notify_challenge")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setQuietHoursEnabled(!!(data.quiet_hours_start && data.quiet_hours_end));
      setQuietHoursStart(data.quiet_hours_start || "");
      setQuietHoursEnd(data.quiet_hours_end || "");
      setDailySummary(data.daily_summary ?? true);
      setPushAdminAnnouncements(data.push_admin_announcements ?? true);
      setNotifyChallenge(data.notify_challenge ?? true);
    }
  };

  const handleClose = () => {
    setPage(null);
    setMsg("");
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={handleClose} />
      <div className="absolute top-full right-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-2 min-w-[200px]">
        {!page ? (
          <>
            <div className="px-3 py-2 text-xs font-bold text-gray-400 border-b border-gray-100 mb-1">メニュー</div>
            <button onClick={() => { setPage("notif"); loadNotifSettings(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition text-sm text-gray-700 cursor-pointer">
              <i className="fas fa-bell text-red-400 w-5 text-center" />
              <span>通知設定</span>
            </button>
            <button onClick={() => setPage("account")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition text-sm text-gray-700 cursor-pointer">
              <i className="fas fa-lock text-gray-600 w-5 text-center" />
              <span>アカウント</span>
            </button>
            <button onClick={() => setPage("push")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition text-sm text-gray-700 cursor-pointer">
              <i className="fas fa-sync-alt text-blue-500 w-5 text-center" />
              <span>通知再設定</span>
            </button>
            <a href="/settings" onClick={handleClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition text-sm no-underline text-gray-700">
              <i className="fas fa-envelope text-primary w-5 text-center" />
              <span>要望・報告</span>
            </a>
            {weeklyReportHidden && (
              <button onClick={() => {
                localStorage.removeItem("weekly_report_dismissed");
                setWeeklyReportHidden(false);
                handleClose();
                window.dispatchEvent(new CustomEvent("restore-weekly-report"));
              }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition text-sm text-gray-700 cursor-pointer">
                <i className="fas fa-chart-line text-indigo-400 w-5 text-center" />
                <span>今週のレポートを再表示</span>
              </button>
            )}
          </>
        ) : page === "push" ? (
          <>
            <button onClick={() => { setPage(null); setMsg(""); }}
              className="flex items-center gap-1 text-xs text-gray-500 mb-2 cursor-pointer hover:text-gray-700">
              <i className="fas fa-chevron-left" /> 戻る
            </button>
            {msg && <div className="px-3 py-1.5 mb-1 bg-blue-50 text-blue-700 rounded-lg text-[10px]">{msg}</div>}
            <p className="text-[10px] text-gray-500 px-1 mb-2">スマホに通知が届かないときは再登録をお試しください</p>
            <button onClick={async () => {
              try {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                if (sub) await sub.unsubscribe();
                const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
                const applicationServerKey = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
                const fresh = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
                const json = fresh.toJSON();
                const res = await fetch("/api/push/subscribe", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
                });
                const data = await res.json();
                setMsg(data.ok ? "プッシュ通知を再登録しました！" : "再登録に失敗しました。");
              } catch {
                setMsg("再登録に失敗しました。ブラウザの通知設定を確認してください。");
              }
            }}
              className="w-full bg-primary text-white font-bold rounded-full py-1.5 text-sm cursor-pointer mb-1.5">
              <i className="fas fa-sync-alt mr-1" /> 通知を再登録
            </button>
            <button onClick={async () => {
              try {
                const res = await fetch("/api/push/test", { method: "POST" });
                const data = await res.json();
                setMsg(data.ok ? `テスト通知を送信しました (${data.sent}件)` : (data.error || "テスト送信に失敗しました"));
              } catch {
                setMsg("テスト送信に失敗しました");
              }
            }}
              className="w-full bg-orange-500 text-white font-medium rounded-full py-1.5 text-xs cursor-pointer hover:bg-orange-400 transition">
              <i className="fas fa-paper-plane mr-1" /> テスト通知を送信
            </button>
          </>
        ) : page === "notif" ? (
          <>
            <button onClick={() => { setPage(null); }}
              className="flex items-center gap-1 text-xs text-gray-500 mb-2 cursor-pointer hover:text-gray-700">
              <i className="fas fa-chevron-left" /> 戻る
            </button>
            <label className="flex items-center justify-between text-xs cursor-pointer py-1">
              <span>静音モード</span>
              <input type="checkbox" checked={quietHoursEnabled} onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                className="cursor-pointer" />
            </label>
            {quietHoursEnabled && (
              <div className="grid grid-cols-2 gap-2 pl-4 pb-1">
                <div>
                  <label className="block text-[10px] text-gray-500">開始</label>
                  <input type="time" value={quietHoursStart} onChange={(e) => setQuietHoursStart(e.target.value)}
                    className="w-full rounded-lg border-gray-300 text-xs py-1 mt-0.5" />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500">終了</label>
                  <input type="time" value={quietHoursEnd} onChange={(e) => setQuietHoursEnd(e.target.value)}
                    className="w-full rounded-lg border-gray-300 text-xs py-1 mt-0.5" />
                </div>
              </div>
            )}
            <p className="text-[10px] text-gray-400 -mt-0.5 mb-1">設定した時間帯はプッシュ通知が送信されなくなります</p>
            <label className="flex items-center justify-between text-xs cursor-pointer py-1">
              <span>デイリーまとめ通知</span>
              <input type="checkbox" checked={dailySummary} onChange={(e) => setDailySummary(e.target.checked)}
                className="cursor-pointer" />
            </label>
            <label className="flex items-center justify-between text-xs cursor-pointer py-1">
              <span>管理者からのお知らせ</span>
              <input type="checkbox" checked={pushAdminAnnouncements} onChange={(e) => setPushAdminAnnouncements(e.target.checked)}
                className="cursor-pointer" />
            </label>
            <label className="flex items-center justify-between text-xs cursor-pointer py-1">
              <span>🔥 勉強チャレンジ</span>
              <input type="checkbox" checked={notifyChallenge} onChange={(e) => setNotifyChallenge(e.target.checked)}
                className="cursor-pointer" />
            </label>
            <button onClick={async () => {
              await fetch("/api/notification-settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  push_admin_announcements: pushAdminAnnouncements,
                  quiet_hours_start: quietHoursEnabled ? quietHoursStart : null,
                  quiet_hours_end: quietHoursEnabled ? quietHoursEnd : null,
                  daily_summary: dailySummary,
                  notify_challenge: notifyChallenge,
                }),
              });
              setMsg("通知設定を保存しました");
            }}
              className="w-full bg-gray-100 text-gray-700 font-medium rounded-full py-1.5 text-xs cursor-pointer hover:bg-gray-200 transition mt-1">
              通知設定を保存
            </button>
          </>
        ) : page === "account" ? (
          <>
            <button onClick={() => { setPage(null); setNewPassword(""); setNewPasswordConfirm(""); }}
              className="flex items-center gap-1 text-xs text-gray-500 mb-2 cursor-pointer hover:text-gray-700">
              <i className="fas fa-chevron-left" /> 戻る
            </button>
            <div>
              <label className="block text-xs font-medium text-gray-700">新しいパスワード</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" minLength={6} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">新しいパスワード（確認）</label>
              <input type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" minLength={6} required />
            </div>
            <button onClick={async () => {
              if (newPassword !== newPasswordConfirm) { setMsg("パスワードが一致しません"); return; }
              if (newPassword.length < 6) { setMsg("パスワードは6文字以上で入力してください"); return; }
              setPasswordChanging(true);
              const supabase = createClient();
              const { error } = await supabase.auth.updateUser({ password: newPassword });
              setPasswordChanging(false);
              if (error) {
                setMsg(`パスワード変更失敗: ${error.message}`);
              } else {
                setMsg("パスワードを変更しました！");
                setNewPassword("");
                setNewPasswordConfirm("");
              }
            }}
              disabled={!newPassword || !newPasswordConfirm || passwordChanging}
              className="w-full bg-gray-800 text-white font-bold rounded-full py-1.5 text-sm mt-1 disabled:opacity-50 cursor-pointer">
              パスワードを変更
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}
