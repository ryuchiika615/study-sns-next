"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import PostCard from "@/components/PostCard";
import StudyTimer from "@/components/StudyTimer";
import { WeeklyChart } from "@/components/WeeklyChart";
import { useToast } from "@/components/ToastProvider";
import { fetchAndEnrichPosts } from "@/lib/post-fetcher";
import { formatStudyTime } from "@/lib/utils";

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
  const [unreadAnnouncements, setUnreadAnnouncements] = useState<any[]>([]);
  const [showAnnouncement, setShowAnnouncement] = useState<any>(null);
  const seenNotifs = useRef<Set<string>>(new Set(
    JSON.parse(localStorage.getItem("seen_notifs") || "[]")
  ));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [beeryualResult, setBeeryualResult] = useState<string | null>(null);
  const beeryualBackRef = useRef<HTMLInputElement>(null);
  const beeryualFrontRef = useRef<HTMLInputElement>(null);
  const beeryualCanvasRef = useRef<HTMLCanvasElement>(null);
  const [beeryualBack, setBeeryualBack] = useState<string | null>(null);
  const [beeryualFront, setBeeryualFront] = useState<string | null>(null);

  const handleBeeryual = () => {
    setBeeryualBack(null);
    setBeeryualFront(null);
    setBeeryualResult(null);
    beeryualBackRef.current?.click();
  };

  const compositeBeeryual = () => {
    const canvas = beeryualCanvasRef.current;
    if (!canvas || !beeryualBack || !beeryualFront) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const backImg = new Image();
    const frontImg = new Image();
    let loaded = 0;
    backImg.onload = frontImg.onload = () => {
      loaded++;
      if (loaded < 2) return;
      const w = Math.max(backImg.naturalWidth, 800);
      const h = Math.max(backImg.naturalHeight, 600);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(backImg, 0, 0, w, h);
      const overlaySize = Math.min(w, h) * 0.25;
      const ox = w - overlaySize - 16;
      const oy = h - overlaySize - 16;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ox + overlaySize / 2, oy + overlaySize / 2, overlaySize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(frontImg, ox, oy, overlaySize, overlaySize);
      ctx.restore();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ox + overlaySize / 2, oy + overlaySize / 2, overlaySize / 2, 0, Math.PI * 2);
      ctx.stroke();
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `beeryual-${Date.now()}.jpg`, { type: "image/jpeg" });
        const fileExt = "jpg";
        const fileName = `${user.id}/${Date.now()}-beeryual.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, file);
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("post-images")
            .getPublicUrl(fileName);
          if (urlData?.publicUrl) {
            setBeeryualResult(urlData.publicUrl);
            setBeeryualBack(null);
            setBeeryualFront(null);
          }
        }
      }, "image/jpeg", 0.9);
    };
    backImg.src = beeryualBack;
    frontImg.src = beeryualFront;
  };
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const latestCreatedAt = useRef<string | null>(null);
  const addToast = useToast();
  const notifTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPosts = async (p: number, q: string) => {
    const result = await fetchAndEnrichPosts(supabase, user.id, { page: p, search: q });
    setPosts(result.posts);
    setTotalPages(result.totalPages);
    if (result.posts.length > 0) {
      latestCreatedAt.current = result.posts[0].created_at;
    }
    setHasNewPosts(false);
  };

  const pollNotifications = async () => {
    const { data: notifications, count } = await supabase
      .from("notifications")
      .select("id, notification_type, sender_id, post_id, created_at, sender:sender_id(id, display_name, username)", { count: "estimated", head: false })
      .eq("recipient_id", user.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(1);

    const unread = count || 0;
    const lastNotif = notifications?.[0];
    if (lastNotif && !seenNotifs.current.has(lastNotif.id)) {
      seenNotifs.current.add(lastNotif.id);
      localStorage.setItem("seen_notifs", JSON.stringify([...seenNotifs.current]));
      const sender = (lastNotif as any).sender?.display_name || "誰か";
      const href = lastNotif.notification_type === "follow"
        ? `/profile/${(lastNotif as any).sender?.id}`
        : lastNotif.post_id ? `/post/${lastNotif.post_id}` : undefined;
      if (lastNotif.notification_type === "like") {
        addToast({ message: `${sender}がいいねしました`, type: "like", href });
      } else if (lastNotif.notification_type === "reply") {
        addToast({ message: `${sender}が返信しました`, type: "reply", href });
      } else if (lastNotif.notification_type === "follow") {
        addToast({ message: `${sender}がフォローしました`, type: "follow", href });
      } else if (lastNotif.notification_type === "gift") {
        addToast({ message: `おプレゼントが届きました！！`, type: "gift", href: "/gacha" });
      }
    }
    setUnreadCount(unread);

    if (latestCreatedAt.current && page === 1 && !search) {
      const { data: followedUsers } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      const followedIds = (followedUsers || []).map((f: any) => f.following_id);
      if (followedIds.length > 0) {
        const { data: newPosts } = await supabase
          .from("posts")
          .select("id")
          .in("user_id", followedIds)
          .gt("created_at", latestCreatedAt.current)
          .limit(1);
        if (newPosts && newPosts.length > 0) {
          setHasNewPosts(true);
        }
      }
    }
  };

  const fetchAnnouncements = async () => {
    const res = await fetch("/api/announcements");
    if (res.ok) {
      const data = await res.json();
      setUnreadAnnouncements(data.announcements || []);
    }
  };

  const markAnnouncementRead = async (id: string) => {
    await fetch("/api/announcements/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ announcementId: id }),
    });
    setUnreadAnnouncements((prev) => prev.filter((a) => a.id !== id));
    setShowAnnouncement(null);
  };

  useEffect(() => {
    pollNotifications();
    fetchAnnouncements();
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

    const imageInput = document.querySelector<HTMLInputElement>('input[name="image"]');
    const files = imageInput?.files ? Array.from(imageInput.files) : [];
    const imageUrls: string[] = [];
    if (beeryualResult) imageUrls.push(beeryualResult);

    for (const file of files) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(fileName, file);
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("post-images")
          .getPublicUrl(fileName);
        if (urlData?.publicUrl) imageUrls.push(urlData.publicUrl);
      }
    }

    const jstNow = new Date();
    jstNow.setHours(jstNow.getHours() + 9);
    const studyDateVal = studyDate || jstNow.toISOString().split("T")[0];

    const { data, error } = await supabase.rpc("create_post", {
      p_content: content,
      p_subject: subject || "その他",
      p_study_minutes: parseInt(studyMinutes || "0"),
      p_image_url: imageUrls[0] || null,
      p_image_urls: imageUrls.length > 0 ? imageUrls : null,
      p_study_date: studyDateVal,
    });

    setIsSubmitting(false);
    if (error) {
      addToast({ message: `投稿失敗: ${error.message}`, type: "error" });
      return;
    }
    if (!data) {
      addToast({ message: "投稿失敗: 応答がありません", type: "error" });
      return;
    }
    if (data.streak) {
      addToast({ message: "", type: "streak", streak: data.streak.streak, bonus: data.streak.bonus_points });
    }
    setContent("");
    setSubject("");
    setStudyMinutes("");
    setBeeryualResult(null);
    fetchPosts(1, search);
    setPage(1);
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

      <div className="px-4 py-3">
        <StudyTimer onStop={(m) => { setStudyMinutes(String(m)); }} />
      </div>

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

          <input type="file" name="image" accept="image/*" multiple className="mt-2.5 text-sm" />

          <div className="flex items-center gap-2 mt-2.5">
            <button type="button" onClick={handleBeeryual}
              className="text-xs bg-purple-100 text-purple-700 rounded-full px-3 py-1.5 border border-purple-200 cursor-pointer hover:bg-purple-200">
              ビーリュアル
            </button>
            {beeryualResult && (
              <span className="text-xs text-green-600">✓ ビーリュアル合成済み</span>
            )}
            {!beeryualResult && (beeryualBack || beeryualFront) && (
              <span className="text-xs text-gray-400">写真を選択中...</span>
            )}
          </div>

          <input ref={beeryualBackRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                const url = URL.createObjectURL(f);
                setBeeryualBack(url);
                beeryualFrontRef.current?.click();
              }
            }} />
          <input ref={beeryualFrontRef} type="file" accept="image/*" capture="user"
            className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                const url = URL.createObjectURL(f);
                setBeeryualFront(url);
              }
            }} />

          {beeryualBack && beeryualFront && !beeryualResult && (
            <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
              <canvas ref={beeryualCanvasRef} className="w-full rounded-lg" />
              <button type="button" onClick={compositeBeeryual}
                className="mt-2 w-full bg-purple-500 text-white rounded-full py-1.5 text-xs font-bold cursor-pointer hover:bg-purple-600">
                合成して確定
              </button>
            </div>
          )}

          <div className="text-right mt-2.5">
            <button type="submit" disabled={isSubmitting} className="bg-primary text-white font-bold rounded-full px-5 py-2 border-none cursor-pointer text-base disabled:opacity-50">
              リュイートする
            </button>
          </div>
        </form>
      </div>

      {hasNewPosts && (
        <button onClick={() => { fetchPosts(1, search); }}
          className="w-full py-2 bg-blue-50 text-blue-600 text-sm font-bold border-b border-blue-100 hover:bg-blue-100 cursor-pointer">
          新しい投稿があります
        </button>
      )}

      {posts.map((post: any) => (
        <PostCard key={post.id} post={post} currentUserId={user.id}
          onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
          onUpdate={(id, data) => setPosts((prev) => prev.map((p) => p.id === id ? { ...p, ...data, display_study_time: formatStudyTime(data.study_minutes ?? p.study_minutes) } : p))} />
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

      {unreadAnnouncements.length > 0 && (
        <button onClick={() => setShowAnnouncement(unreadAnnouncements[0])}
          className="fixed top-4 right-4 z-50 text-2xl bg-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
          ✉
        </button>
      )}

      {showAnnouncement && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
            <h3 className="font-bold text-lg mb-3">📨 管理者からのお知らせ</h3>
            <p className="text-sm whitespace-pre-wrap mb-4">{showAnnouncement.content}</p>
            <p className="text-xs text-gray-400 mb-4">{new Date(showAnnouncement.created_at).toLocaleString("ja-JP")}</p>
            <button onClick={() => markAnnouncementRead(showAnnouncement.id)}
              className="w-full bg-primary text-white font-bold rounded-full py-2 text-sm cursor-pointer">
              既読にする
            </button>
          </div>
        </div>
      )}
    </>
  );
}
