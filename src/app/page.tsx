"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import PostCard from "@/components/PostCard";
import AppShell from "@/components/AppShell";
import { WeeklyChart } from "@/components/WeeklyChart";
import { useToast } from "@/components/ToastProvider";

export default function HomePage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [studyMinutes, setStudyMinutes] = useState("");
  const [studyDate, setStudyDate] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [weeklyData, setWeeklyData] = useState<any>(null);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [lastNotifId, setLastNotifId] = useState(0);
  const addToast = useToast();
  const notifTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const fetchPosts = async (p: number, q: string) => {
    const params = new URLSearchParams({ page: String(p) });
    if (q) params.set("search", q);
    const res = await fetch(`/api/posts?${params}`);
    if (res.ok) {
      const data = await res.json();
      setPosts(data.posts);
      setTotalPages(data.totalPages);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      setUser(data.user);

      // プロフィール取得
      fetch("/api/profile").then((r) => r.ok && r.json()).then((d) => {
        if (d?.profile) setProfile(d.profile);
      });

      // 未読通知数
      fetch("/api/notifications").then((r) => r.ok && r.json()).then((d) => {
        if (d) setUnreadCount(d.unread_count);
      });

      // 週間データ
      fetch("/api/analytics").then((r) => r.ok && r.json()).then((d) => {
        if (d?.weekly_labels) {
          setWeeklyData({
            labels: JSON.parse(d.weekly_labels),
            datasets: JSON.parse(d.weekly_datasets),
          });
          // 合計時間計算
          const parsed = JSON.parse(d.weekly_datasets);
          const total = parsed.reduce((sum: number, ds: any) => sum + ds.data.reduce((a: number, b: number) => a + b, 0), 0);
          setTotalMinutes(total);
        }
      });

      // 通知ポーリング
      pollNotifications();
      notifTimer.current = setInterval(pollNotifications, 15000);
    });

    return () => {
      if (notifTimer.current) clearInterval(notifTimer.current);
    };
  }, []);

  const pollNotifications = async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    if (data.unread_count > 0 && data.unread_count !== unreadCount) {
      // 新しい通知があればトースト表示
      const lastNotif = data.notifications?.[0];
      if (lastNotif && lastNotif.id > lastNotifId) {
        setLastNotifId(lastNotif.id);
        if (lastNotif.notification_type === "like") {
          addToast({ message: `${lastNotif.sender?.display_name || "誰か"}がいいねしました`, type: "like" });
        } else if (lastNotif.notification_type === "reply") {
          addToast({ message: `${lastNotif.sender?.display_name || "誰か"}が返信しました`, type: "reply" });
        } else if (lastNotif.notification_type === "follow") {
          addToast({ message: `${lastNotif.sender?.display_name || "誰か"}がフォローしました`, type: "follow" });
        }
      }
      setUnreadCount(data.unread_count);
    }
  };

  useEffect(() => {
    if (user) fetchPosts(page, search);
  }, [page, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("content", content);
    formData.append("subject", subject || "その他");
    formData.append("study_minutes", studyMinutes || "0");
    const jstNow = new Date();
    jstNow.setHours(jstNow.getHours() + 9);
    formData.append("study_date", studyDate || jstNow.toISOString().split("T")[0]);

    const imageInput = document.querySelector<HTMLInputElement>('input[name="image"]');
    if (imageInput?.files?.[0]) {
      formData.append("image", imageInput.files[0]);
    }

    const res = await fetch("/api/posts", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      if (data.streak) {
        addToast({ message: "", type: "streak", streak: data.streak.streak, bonus: data.streak.bonus_points });
      }
      setContent("");
      setSubject("");
      setStudyMinutes("");
      fetchPosts(1, search);
      setPage(1);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPosts(1, search);
  };

  const formatRemaining = (minutes: number) => {
    if (minutes <= 0) return "目標達成！🎉";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) return `${h}時間${m}分`;
    if (h > 0) return `${h}時間`;
    return `${m}分`;
  };

  if (!user) return null;

  return (
    <AppShell unreadCount={unreadCount}>
      {totalMinutes > 0 && (
        <div className="mx-4 mb-4 p-4 rounded-lg bg-gradient-to-r from-blue-900 to-blue-700 text-white border border-blue-400 text-center">
          <p className="text-sm text-blue-200">総勉強時間</p>
          <p className="text-2xl font-bold">{formatRemaining(totalMinutes)}</p>
        </div>
      )}

      {profile?.target_date && profile?.target_minutes > 0 && (
        <div className="mx-4 mb-4 p-4 rounded-lg bg-gradient-to-r from-gray-900 to-gray-800 text-white border border-yellow-600 text-center">
          <h4 className="text-yellow-500 m-0 mb-2"><i className="fas fa-bullseye" /> {profile.target_date} までの目標</h4>
          <p className="text-sm text-gray-400">目標合計 {Math.floor(profile.target_minutes / 60)}時間{profile.target_minutes % 60}分</p>
          <p className="text-lg text-yellow-400 font-bold mt-1">あと {formatRemaining(profile.target_minutes - totalMinutes)}</p>
        </div>
      )}

      {weeklyData && <WeeklyChart labels={weeklyData.labels} datasets={weeklyData.datasets} />}

      {/* 投稿フォーム */}
      <div className="border-b border-gray-100 px-4 py-4">
        <form onSubmit={handleSearch} className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="リュイートを検索"
            className="w-full rounded-full border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm"
          />
        </form>

        <form onSubmit={handleSubmit} encType="multipart/form-data">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="今日の学びを書こう"
            required
            className="w-full border-none outline-none text-lg resize-none h-20"
          />
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="科目名 例: 数学, 英語"
            list="subjects"
            required
            className="w-full mt-2.5 p-2.5 border border-gray-200 rounded-lg text-sm"
          />
          <datalist id="subjects">
            <option value="数学" /><option value="英語" /><option value="プログラミング" />
            <option value="物理" /><option value="基本情報" />
          </datalist>

          <div className="flex gap-2.5 mt-2.5">
            <input
              type="number"
              value={studyMinutes}
              onChange={(e) => setStudyMinutes(e.target.value)}
              min={0}
              placeholder="勉強時間（分）"
              className="flex-1 p-2.5 border border-gray-200 rounded-lg text-sm"
            />
            <input
              type="date"
              value={studyDate}
              onChange={(e) => setStudyDate(e.target.value)}
              className="flex-1 p-2.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>

          <input type="file" name="image" accept="image/*" className="mt-2.5 text-sm" />

          <div className="text-right mt-2.5">
            <button type="submit" className="bg-primary text-white font-bold rounded-full px-5 py-2 border-none cursor-pointer text-base">
              リュイートする
            </button>
          </div>
        </form>
      </div>

      {/* 投稿一覧 */}
      {posts.map((post: any) => (
        <PostCard key={post.id} post={post} currentUserId={user.id} />
      ))}

      {posts.length === 0 && (
        <p className="text-center text-gray-500 py-10">まだポストがありません。</p>
      )}

      {/* ページネーション */}
      <div className="flex justify-center gap-2.5 my-5">
        {page > 1 && (
          <button onClick={() => setPage(page - 1)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
            &laquo; 前へ
          </button>
        )}
        <span className="px-4 py-2 text-gray-500 font-bold text-sm">{page} / {totalPages}</span>
        {page < totalPages && (
          <button onClick={() => setPage(page + 1)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer hover:bg-gray-50">
            次へ &raquo;
          </button>
        )}
      </div>
    </AppShell>
  );
}
