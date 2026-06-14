"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import PostCard from "@/components/PostCard";
import { WeeklyChart } from "@/components/WeeklyChart";
import { useToast } from "@/components/ToastProvider";
import { fetchAndEnrichPosts } from "@/lib/post-fetcher";

type HomeClientProps = {
  user: { id: string; email?: string };
  profile: any;
  unreadCount: number;
  weeklyLabels: string[];
  weeklyDatasets: any[];
  totalMinutes: number;
};

export default function HomeClient({ user, profile: initialProfile, unreadCount: initialUnread, weeklyLabels, weeklyDatasets, totalMinutes: initialTotal }: HomeClientProps) {
  const supabase = createClient();
  const [posts, setPosts] = useState<any[]>([]);
  const [profile] = useState(initialProfile);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [studyMinutes, setStudyMinutes] = useState("");
  const [studyDate, setStudyDate] = useState("");
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const [totalMinutes] = useState(initialTotal);
  const [lastNotifId, setLastNotifId] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addToast = useToast();
  const notifTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPosts = async (p: number, q: string) => {
    const result = await fetchAndEnrichPosts(supabase, user.id, { page: p, search: q });
    setPosts(result.posts);
    setTotalPages(result.totalPages);
  };

  const pollNotifications = async () => {
    const { data: notifications, count } = await supabase
      .from("notifications")
      .select("id, notification_type, sender_id, created_at, sender:sender_id(id, display_name, username)", { count: "estimated", head: false })
      .eq("recipient_id", user.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(1);

    const unread = count || 0;
    const lastNotif = notifications?.[0];
    if (lastNotif && lastNotif.id > lastNotifId) {
      setLastNotifId(lastNotif.id);
      if (lastNotif.notification_type === "like") {
        addToast({ message: `${(lastNotif as any).sender?.display_name || "誰か"}がいいねしました`, type: "like" });
      } else if (lastNotif.notification_type === "reply") {
        addToast({ message: `${(lastNotif as any).sender?.display_name || "誰か"}が返信しました`, type: "reply" });
      } else if (lastNotif.notification_type === "follow") {
        addToast({ message: `${(lastNotif as any).sender?.display_name || "誰か"}がフォローしました`, type: "follow" });
      } else if (lastNotif.notification_type === "gift") {
        addToast({ message: `おプレゼントが届きました！！`, type: "gift" });
      }
    }
    setUnreadCount(unread);
  };

  useEffect(() => {
    pollNotifications();
    notifTimer.current = setInterval(pollNotifications, 15000);
    return () => {
      if (notifTimer.current) clearInterval(notifTimer.current);
    };
  }, []);

  useEffect(() => {
    fetchPosts(page, search);
  }, [page]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    let imageUrl: string | null = null;
    const imageInput = document.querySelector<HTMLInputElement>('input[name="image"]');
    if (imageInput?.files?.[0]) {
      const file = imageInput.files[0];
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(fileName, file);
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("post-images")
          .getPublicUrl(fileName);
        imageUrl = urlData?.publicUrl || null;
      }
    }

    const jstNow = new Date();
    jstNow.setHours(jstNow.getHours() + 9);
    const studyDateVal = studyDate || jstNow.toISOString().split("T")[0];

    const { data, error } = await supabase.rpc("create_post", {
      p_content: content,
      p_subject: subject || "その他",
      p_study_minutes: parseInt(studyMinutes || "0"),
      p_image_url: imageUrl,
      p_study_date: studyDateVal,
    });

    setIsSubmitting(false);
    if (!error && data) {
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

  return (
    <>
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

      {weeklyLabels.length > 0 && (
        <WeeklyChart labels={weeklyLabels} datasets={weeklyDatasets.map(d => ({
          ...d,
          backgroundColor: d.backgroundColor,
        }))} />
      )}

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
            <button type="submit" disabled={isSubmitting} className="bg-primary text-white font-bold rounded-full px-5 py-2 border-none cursor-pointer text-base disabled:opacity-50">
              リュイートする
            </button>
          </div>
        </form>
      </div>

      {posts.map((post: any) => (
        <PostCard key={post.id} post={post} currentUserId={user.id} />
      ))}

      {posts.length === 0 && (
        <p className="text-center text-gray-500 py-10">まだポストがありません。</p>
      )}

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
    </>
  );
}
