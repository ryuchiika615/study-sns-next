"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import NextImage from "next/image";
import PostCard from "@/components/PostCard";
import StudyTimer from "@/components/StudyTimer";
import { WeeklyChart } from "@/components/WeeklyChart";
import { useToast } from "@/components/ToastProvider";
import PullToRefresh from "@/components/PullToRefresh";
import { PostCardSkeleton } from "@/components/Skeleton";
import { fetchAndEnrichPosts } from "@/lib/post-fetcher";
import { formatStudyTime, getOptimizedIconUrl, compressImage } from "@/lib/utils";

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
  const seenNotifs = useRef<Set<string>>(new Set(
    JSON.parse(localStorage.getItem("seen_notifs") || "[]")
  ));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [beeryualResult, setBeeryualResult] = useState<string | null>(null);
  const [rankingPopup, setRankingPopup] = useState<{ top3: any[]; daysRemaining: number; month: number } | null>(null);
  const [dismissedWeek, setDismissedWeek] = useState(() => localStorage.getItem("dismissed_ranking_week") || "");
  const beeryualCanvasRef = useRef<HTMLCanvasElement>(null);
  const beeryualVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [beeryualStep, setBeeryualStep] = useState<'idle' | 'camera' | 'preview'>('idle');
  const [beeryualPhotos, setBeeryualPhotos] = useState<{ back: string | null; front: string | null }>({ back: null, front: null });
  const [beeryualFirstSide, setBeeryualFirstSide] = useState<'back' | 'front'>('back');
  const [beeryualSecondSide, setBeeryualSecondSide] = useState<'back' | 'front'>('front');
  const [beeryualCapturedFirst, setBeeryualCapturedFirst] = useState(false);
  const [beeryualCountdown, setBeeryualCountdown] = useState<number | null>(null);
  const [beeryualSwapped, setBeeryualSwapped] = useState(false);
  const [beeryualShowSmall, setBeeryualShowSmall] = useState(true);
  const [beeryualOverlayPos, setBeeryualOverlayPos] = useState<{ x: number; y: number }>({ x: 16, y: 16 });
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const smallOverlayRef = useRef<HTMLImageElement>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (facingMode: 'user' | 'environment') => {
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      streamRef.current = stream;
      if (beeryualVideoRef.current) {
        beeryualVideoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.error("Camera error", e);
    }
  };

  const captureFrame = (): Promise<string> => {
    return new Promise((resolve) => {
      const video = beeryualVideoRef.current;
      if (!video) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    });
  };

  const handleBeeryual = () => {
    setBeeryualResult(null);
    setBeeryualPhotos({ back: null, front: null });
    setBeeryualFirstSide('back');
    setBeeryualSecondSide('front');
    setBeeryualCapturedFirst(false);
    setBeeryualCountdown(null);
    setBeeryualSwapped(false);
    setBeeryualShowSmall(true);
    setBeeryualOverlayPos({ x: 0, y: 0 });
    setBeeryualStep('camera');
    startCamera('environment');
  };

  const handleBeeryualShutter = async () => {
    const dataUrl = await captureFrame();
    const side = beeryualFirstSide;
    setBeeryualPhotos(prev => ({ ...prev, [side]: dataUrl }));
    setBeeryualCapturedFirst(true);
    stopStream();
    await startCamera(beeryualSecondSide === 'back' ? 'environment' : 'user');
    let count = 3;
    setBeeryualCountdown(count);
    countdownTimer.current = setInterval(() => {
      count--;
      setBeeryualCountdown(count);
      if (count <= 0) {
        if (countdownTimer.current) clearInterval(countdownTimer.current);
        autoCaptureSecond();
      }
    }, 1000);
  };

  const autoCaptureSecond = async () => {
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    setBeeryualCountdown(null);
    const dataUrl = await captureFrame();
    const side = beeryualSecondSide;
    setBeeryualPhotos(prev => ({ ...prev, [side]: dataUrl }));
    stopStream();
    setBeeryualStep('preview');
  };

  const handleBeeryualCancel = () => {
    stopStream();
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    setBeeryualStep('idle');
    setBeeryualCountdown(null);
    setBeeryualPhotos({ back: null, front: null });
    setBeeryualCapturedFirst(false);
  };

  const compositeBeeryual = () => {
    const canvas = beeryualCanvasRef.current;
    const { back, front } = beeryualPhotos;
    if (!canvas || !back || !front) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const largeKey = beeryualSwapped ? 'front' : 'back';
    const smallKey = beeryualSwapped ? 'back' : 'front';
    const largeImg = new Image();
    const smallImg = new Image();
    let loaded = 0;
    largeImg.onload = smallImg.onload = () => {
      loaded++;
      if (loaded < 2) return;
      const devW = window.innerWidth;
      const devH = window.innerHeight;
      const devRatio = devW / devH;
      const imgW = largeImg.naturalWidth;
      const imgH = largeImg.naturalHeight;
      canvas.width = Math.max(800, imgW);
      canvas.height = canvas.width / devRatio;
      let sx = 0, sy = 0, sw = imgW, sh = imgH;
      if (imgW / imgH > devRatio) {
        sw = imgH * devRatio;
        sx = (imgW - sw) / 2;
      } else {
        sh = imgW / devRatio;
        sy = (imgH - sh) / 2;
      }
      ctx.drawImage(largeImg, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      if (beeryualShowSmall) {
        const rh = canvas.height * 0.28;
        const rw = rh * 0.7;
        const container = previewContainerRef.current;
        let ox: number, oy: number;
        if (container && beeryualOverlayPos.x) {
          const cr = container.getBoundingClientRect();
          ox = (beeryualOverlayPos.x / cr.width) * canvas.width;
          oy = (beeryualOverlayPos.y / cr.height) * canvas.height;
        } else {
          ox = 16;
          oy = 16;
        }
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(ox, oy, rw, rh, 12);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(smallImg, ox, oy, rw, rh);
        ctx.restore();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(ox, oy, rw, rh, 12);
        ctx.stroke();
      }
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
            setBeeryualStep('idle');
            setBeeryualPhotos({ back: null, front: null });
          }
        }
      }, "image/jpeg", 0.8);
    };
    largeImg.src = largeKey === 'back' ? back! : front!;
    smallImg.src = smallKey === 'front' ? front! : back!;
  };
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [loading, setLoading] = useState(true);
  const latestCreatedAt = useRef<string | null>(null);
  const addToast = useToast();
  const notifTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPosts = async (p: number, q: string) => {
    setLoading(true);
    const result = await fetchAndEnrichPosts(supabase, user.id, { page: p, search: q });
    setPosts(result.posts);
    setTotalPages(result.totalPages);
    if (result.posts.length > 0) {
      latestCreatedAt.current = result.posts[0].created_at;
    }
    setHasNewPosts(false);
    setLoading(false);
  };

  const pollNotifications = async () => {
    const [notifResult, countResult] = await Promise.all([
      supabase.from("notifications")
        .select("id, notification_type, sender_id, post_id, created_at, sender:sender_id(id, display_name, username)")
        .eq("recipient_id", user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase.from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false)
        .neq("notification_type", "follow_post"),
    ]);

    const unread = countResult.count || 0;
    const lastNotif = notifResult.data?.[0];
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
      } else if (lastNotif.notification_type === "follow_post") {
        addToast({ message: `${sender}が投稿しました`, type: "follow_post", href });
        fetch("/api/push/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "follow_post", recipient_id: user.id, sender_id: (lastNotif as any).sender?.id || (lastNotif as any).sender_id, post_id: (lastNotif as any).post_id }),
        }).catch(() => {});
      } else if (lastNotif.notification_type === "gift") {
        addToast({ message: `🎁 ${sender}からプレゼントが届きました。`, type: "gift", href: "/gacha" });
      } else if (lastNotif.notification_type === "mention") {
        addToast({ message: `${sender}からメンションが来ました`, type: "info", href });
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

  const pollAll = pollNotifications;

  useEffect(() => {
    pollAll();
    fetch("/api/daily-summary").catch(() => {});
    notifTimer.current = setInterval(pollAll, 15000);

    // Weekly ranking popup
    const now = new Date();
    const weekNum = `${now.getFullYear()}-W${String(Math.ceil((now.getDate() + (new Date(now.getFullYear(), now.getMonth(), 1).getDay())) / 7)).padStart(2, "0")}-${now.getMonth()}`;
    if (localStorage.getItem("dismissed_ranking_week") !== weekNum) {
      fetch("/api/rankings/current-month").then(r => r.ok && r.json()).then(d => {
        if (d) setRankingPopup(d);
      }).catch(() => {});
    }
    setDismissedWeek(weekNum);

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
      const compressed = file.type.startsWith("image/") ? await compressImage(file).catch(() => file) : file;
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(fileName, compressed);
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
    // Direct push fallback for followers (pg_net is unreliable)
    if (data?.post_id) {
      fetch("/api/push/follow-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: data.post_id }),
      }).catch(() => {});
    }
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
      <PullToRefresh onRefresh={async () => { await fetchPosts(1, search); }}>
      {/* ===== 統計セクション ===== */}
      <div className="mx-4 mb-3 space-y-3">
        {totalMinutes > 0 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900 to-blue-700 text-white border border-blue-400 text-center shadow-sm">
            <p className="text-sm text-blue-200">総勉強時間</p>
            <p className="text-2xl font-bold">{formatRemaining(totalMinutes)}</p>
          </div>
        )}

        {profile?.target_date && profile?.target_minutes > 0 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-gray-900 to-gray-800 text-white border border-yellow-600 text-center shadow-sm">
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <StudyTimer onStop={(m) => { setStudyMinutes(String(m)); }} />
        </div>
      </div>

      {/* ===== 投稿フォーム ===== */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mx-4 mb-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-500"><i className="far fa-edit mr-1.5" />新規リュイート</h3>
        </div>
        <div className="px-4 py-3">
          <form onSubmit={handleSearch} className="mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="リュイートを検索"
              className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm"
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
          </div>

          {beeryualStep === 'camera' && (
            <div className="fixed inset-0 z-[100] bg-black flex flex-col">
              <div className="relative flex-1 flex items-center justify-center">
                <video ref={beeryualVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                {beeryualCapturedFirst && beeryualCountdown !== null && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-6xl font-bold drop-shadow-lg">{beeryualCountdown}</span>
                  </div>
                )}
                {beeryualPhotos[beeryualFirstSide] && (
                  <img src={beeryualPhotos[beeryualFirstSide]!}
                    className="absolute top-4 left-4 w-20 h-20 rounded-full border-2 border-white object-cover shadow-lg" />
                )}
              </div>
              <div className="flex items-center justify-center gap-6 p-6">
                {!beeryualCapturedFirst ? (
                  <>
                    <button type="button" onClick={handleBeeryualShutter}
                      className="w-16 h-16 rounded-full bg-white border-4 border-gray-300 cursor-pointer active:scale-95 transition" />
                    <button type="button" onClick={() => {
                      const next = beeryualFirstSide === 'back' ? 'front' : 'back';
                      setBeeryualFirstSide(next);
                      setBeeryualSecondSide(next === 'back' ? 'front' : 'back');
                      startCamera(next === 'back' ? 'environment' : 'user');
                    }} className="text-white text-sm px-3 py-1 rounded-full bg-white/20 cursor-pointer">
                      切替
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={autoCaptureSecond}
                    className="w-16 h-16 rounded-full bg-white border-4 border-yellow-400 cursor-pointer active:scale-95 transition" />
                )}
                <button type="button" onClick={handleBeeryualCancel}
                  className="absolute top-4 right-4 text-white text-2xl cursor-pointer">✕</button>
              </div>
            </div>
          )}

            {beeryualStep === 'preview' && (
            <div className="fixed inset-0 z-[100] bg-black flex flex-col">
              <canvas ref={beeryualCanvasRef} className="hidden" />
              <div ref={previewContainerRef} className="relative flex-1 flex items-center justify-center overflow-hidden">
                {(() => {
                  const largeKey = beeryualSwapped ? 'front' : 'back';
                  const smallKey = beeryualSwapped ? 'back' : 'front';
                  const largeUrl = beeryualPhotos[largeKey];
                  const smallUrl = beeryualPhotos[smallKey];
                  return (
                    <>
                      <img src={largeUrl!} className="w-full h-full object-cover cursor-pointer" onClick={() => { if (beeryualShowSmall) setBeeryualSwapped(!beeryualSwapped); else setBeeryualShowSmall(true); }} onContextMenu={(e) => e.preventDefault()}
                        onPointerDown={(e) => {
                          const timer = setTimeout(() => { setBeeryualShowSmall(false); }, 600);
                          const onUp = () => { clearTimeout(timer); document.removeEventListener('pointerup', onUp); };
                          document.addEventListener('pointerup', onUp);
                        }} />
                      {smallUrl && beeryualShowSmall && (
                        <img ref={smallOverlayRef} src={smallUrl}
                          className="absolute h-[28dvh] w-[20dvh] rounded-xl border-2 border-white object-cover shadow-lg cursor-grab"
                          style={{ top: beeryualOverlayPos.y || 16, left: beeryualOverlayPos.x || 16, touchAction: "none" }}
                          onPointerDown={(e) => {
                            const el = e.currentTarget;
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const parent = el.parentElement!;
                            const parentRect = parent.getBoundingClientRect();
                            const elRect = el.getBoundingClientRect();
                            const startLeft = elRect.left - parentRect.left;
                            const startTop = elRect.top - parentRect.top;
                            const onMove = (ev: PointerEvent) => {
                              ev.preventDefault();
                              const x = Math.max(0, Math.min(parentRect.width - elRect.width, startLeft + ev.clientX - startX));
                              const y = Math.max(0, Math.min(parentRect.height - elRect.height, startTop + ev.clientY - startY));
                              el.style.left = x + "px";
                              el.style.top = y + "px";
                            };
                            const onUp = () => {
                              setBeeryualOverlayPos({ x: parseFloat(el.style.left || "16"), y: parseFloat(el.style.top || "16") });
                              document.removeEventListener('pointermove', onMove);
                              document.removeEventListener('pointerup', onUp);
                            };
                            document.addEventListener('pointermove', onMove);
                            document.addEventListener('pointerup', onUp);
                          }} />
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="flex items-center justify-center gap-4 p-4">
                <button type="button" onClick={() => setBeeryualStep('idle')}
                  className="px-6 py-2 rounded-full bg-white/20 text-white text-sm cursor-pointer">キャンセル</button>
                <button type="button" onClick={compositeBeeryual}
                  className="px-6 py-2 rounded-full bg-purple-500 text-white text-sm font-bold cursor-pointer hover:bg-purple-600">
                  合成して確定
                </button>
              </div>
            </div>
          )}

          <div className="text-right mt-2.5">
            <button type="submit" disabled={isSubmitting} className="bg-primary text-white font-bold rounded-full px-5 py-2 border-none cursor-pointer text-base disabled:opacity-50">
              リュイートする
            </button>
          </div>
        </form>
      </div>
      </div>

      {/* ===== 投稿一覧 ===== */}
      {loading && posts.length === 0 ? (
        <>
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </>
      ) : null}
      {hasNewPosts && (
        <button onClick={() => { fetchPosts(1, search); }}
          className="w-[calc(100%-2rem)] mx-4 py-2.5 bg-blue-50 text-blue-600 text-sm font-bold rounded-xl border border-blue-100 hover:bg-blue-100 cursor-pointer shadow-sm mb-3">
          <i className="fas fa-arrow-up mr-1" /> 新しい投稿があります
        </button>
      )}

      {posts.map((post: any) => (
        <PostCard key={post.id} post={post} currentUserId={user.id}
          onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
          onUpdate={(id, data) => setPosts((prev) => prev.map((p) => p.id === id ? { ...p, ...data, display_study_time: formatStudyTime(data.study_minutes ?? p.study_minutes) } : p))} />
      ))}

      {posts.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mx-4 py-12 text-center">
          <p className="text-gray-400"><i className="far fa-frown text-3xl mb-2 block" /></p>
          <p className="text-gray-500">まだポストがありません</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3 mx-4 my-5 bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3">
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
      </PullToRefresh>

      {rankingPopup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setRankingPopup(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">🏆 {rankingPopup.month}月のランキング</h3>
              <button onClick={() => { setRankingPopup(null); localStorage.setItem("dismissed_ranking_week", dismissedWeek); }}
                className="text-gray-500 text-xl cursor-pointer">
                <i className="fas fa-times" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">集計日まで残り<span className="font-bold text-primary">{rankingPopup.daysRemaining}</span>日</p>
            <div className="space-y-2">
              {rankingPopup.top3.map((entry: any, i: number) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${i === 0 ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"}`}>
                  <span className={`text-lg font-bold w-8 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-orange-400"}`}>
                    {i === 0 ? "👑" : `#${i + 1}`}
                  </span>
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                    {entry.user?.icon_url ? <NextImage src={getOptimizedIconUrl(entry.user.icon_url, 120)} width={32} height={32} className="rounded-full object-cover" alt="" />
                      : <div className="w-full h-full flex items-center justify-center text-gray-400"><i className="fas fa-user text-xs" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{entry.user?.display_name || entry.user?.username || "ユーザー"}</p>
                    <p className="text-xs text-gray-500">{entry.displayTime}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setRankingPopup(null); localStorage.setItem("dismissed_ranking_week", dismissedWeek); }}
              className="w-full mt-4 bg-primary text-white font-bold rounded-full py-2 text-sm cursor-pointer">
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
