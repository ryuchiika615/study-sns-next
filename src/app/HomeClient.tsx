"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import NextImage from "next/image";
import dynamic from "next/dynamic";
import PostCard from "@/components/PostCard";
import StudyTimer from "@/components/StudyTimer";
import { useToast } from "@/components/ToastProvider";

const WeeklyChart = dynamic(() => import("@/components/WeeklyChart").then(m => ({ default: m.WeeklyChart })), {
  ssr: false,
  loading: () => <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />,
});
const SurveyPopup = dynamic(() => import("@/components/SurveyPopup"), { ssr: false });
const ChallengePopup = dynamic(() => import("@/components/ChallengePopup"), { ssr: false });
const BeeryualCamera = dynamic(() => import("@/components/BeeryualCamera"), { ssr: false });
const StudyPomodoro = dynamic(() => import("@/components/StudyPomodoro"), {
  ssr: false,
  loading: () => <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />,
});
import PullToRefresh from "@/components/PullToRefresh";
import { PostCardSkeleton } from "@/components/Skeleton";
import { fetchAndEnrichPosts } from "@/lib/post-fetcher";
import { formatStudyTime, getOptimizedIconUrl, compressImage, vibrateDevice } from "@/lib/utils";

type HomeClientProps = {
  user: { id: string; email?: string };
  profile: any;
  unreadCount: number;
  weeklyLabels: string[];
  weeklyDatasets: any[];
  totalMinutes: number;
  initialPosts?: any[];
  initialTotalPages?: number;
};

export default function HomeClient({ user, profile: initialProfile, unreadCount: initialUnread, weeklyLabels, weeklyDatasets, totalMinutes: initialTotal, initialPosts, initialTotalPages }: HomeClientProps) {
  const supabase = createClient();
  const [posts, setPosts] = useState<any[]>(initialPosts || []);
  const [profile] = useState(initialProfile);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages || 1);
  const [search, setSearch] = useState("");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [studyMinutes, setStudyMinutes] = useState("");
  const [studyDate, setStudyDate] = useState("");
  const [unreadCount, setUnreadCount] = useState(initialUnread);
  const [totalMinutes, setTotalMinutes] = useState(initialTotal);
  const [showTargetAchievement, setShowTargetAchievement] = useState(false);
  const initialFetchDone = useRef(!!initialPosts);
  const seenNotifs = useRef<Set<string>>(new Set(
    JSON.parse(localStorage.getItem("seen_notifs") || "[]")
  ));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [beeryualResult, setBeeryualResult] = useState<string | null>(null);
  const [activeSurvey, setActiveSurvey] = useState<any>(null);
  const [surveyResponse, setSurveyResponse] = useState<any>(null);
  const [surveyResults, setSurveyResults] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState("");
  const [customReply, setCustomReply] = useState("");
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveyDismissed, setSurveyDismissed] = useState(false);
  const [publishedDismissed, setPublishedDismissed] = useState(() => localStorage.getItem("dismissed_published_survey") || "");
  const [rankingPopup, setRankingPopup] = useState<{ top3: any[]; daysRemaining: number; month: number } | null>(null);
  const [dismissedWeek, setDismissedWeek] = useState(() => localStorage.getItem("dismissed_ranking_week") || "");
  const vibratePrefs = useRef<Record<string, boolean>>({ like: true, reply: true, follow: true, mention: true, gift: true, follow_post: true, admin_announcement: true, repost: true, challenge: true });
  const [incomingChallenge, setIncomingChallenge] = useState<any>(null);

  const dismissAchievement = useCallback(() => {
    const key = `target_achieved_${profile?.target_minutes}_${profile?.target_date || ""}`;
    localStorage.setItem(key, "1");
    setShowTargetAchievement(false);
  }, [profile?.target_minutes, profile?.target_date]);

  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [loading, setLoading] = useState(true);
  const latestCreatedAt = useRef<string | null>(null);
  const addToast = useToast();

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
    // Refresh vibration settings before checking notifications
    try {
      const res = await fetch("/api/notification-settings");
      if (res.ok) {
        const d = await res.json();
        if (d) vibratePrefs.current = { like: d.vibrate_like ?? true, reply: d.vibrate_reply ?? true, follow: d.vibrate_follow ?? true, mention: d.vibrate_mention ?? true, gift: d.vibrate_gift ?? true, follow_post: d.vibrate_follow_post ?? true, admin_announcement: d.vibrate_admin_announcement ?? true, repost: d.vibrate_repost ?? true, challenge: d.vibrate_challenge ?? true };
      }
    } catch {}

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
      } else if (lastNotif.notification_type === "gift") {
        addToast({ message: `🎁 ${sender}からプレゼントが届きました。`, type: "gift", href: "/gacha" });
      } else if (lastNotif.notification_type === "mention") {
        addToast({ message: `${sender}からメンションが来ました`, type: "info", href });
      } else if (lastNotif.notification_type === "admin_announcement") {
        addToast({ message: `お知らせが届きました`, type: "info", href: "/" });
      } else if (lastNotif.notification_type === "repost") {
        addToast({ message: `${sender}があなたの投稿を引用しました`, type: "info", href: lastNotif.post_id ? `/post/${lastNotif.post_id}` : undefined });
      } else if (lastNotif.notification_type === "challenge") {
        addToast({ message: `🔥 ${sender}から勝負が仕掛けられました！`, type: "info", href: "/challenges" });
      }
      if (vibratePrefs.current[lastNotif.notification_type]) vibrateDevice();
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

  const pollChallenges = async () => {
    try {
      const res = await fetch("/api/challenges");
      if (res.ok) {
        const data = await res.json();
        const pending = (data.incoming || []).find((c: any) => c.status === "pending");
        if (pending) {
          setIncomingChallenge(pending);
        }
      }
    } catch {}
  };

  const pollAll = async () => {
    await pollNotifications();
    await pollChallenges();
  };

  useEffect(() => {
    pollAll();
    fetch("/api/daily-summary").catch(() => {});

    const refreshOnFocus = () => {
      if (document.hidden) return;
      pollAll();
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("pageshow", refreshOnFocus);

    // Weekly ranking popup
    const now = new Date();
    const weekNum = `${now.getFullYear()}-W${String(Math.ceil((now.getDate() + (new Date(now.getFullYear(), now.getMonth(), 1).getDay())) / 7)).padStart(2, "0")}-${now.getMonth()}`;
    if (localStorage.getItem("dismissed_ranking_week") !== weekNum) {
      fetch("/api/rankings/current-month").then(r => r.ok && r.json()).then(d => {
        if (d) setRankingPopup(d);
      }).catch(() => {});
    }
    setDismissedWeek(weekNum);

    fetch("/api/surveys").then(r => r.ok && r.json()).then(d => {
      if (d?.survey) {
        if (d.myResponse) {
          setSurveyResponse(d.myResponse);
          setSurveyResults(d.results || null);
          setSurveyDismissed(true);
        } else if (d.readOnly) {
          if (publishedDismissed === d.survey.id) return;
          setActiveSurvey(d.survey);
          setSurveyResults(d.results || null);
          setSurveyDismissed(false);
        } else {
          setActiveSurvey(d.survey);
          setSurveyDismissed(false);
        }
      }
    }).catch(() => {});

    // Target achievement check
    if (initialProfile?.target_minutes > 0 && initialTotal >= initialProfile.target_minutes) {
      const key = `target_achieved_${initialProfile.target_minutes}_${initialProfile.target_date || ""}`;
      if (!localStorage.getItem(key)) {
        setShowTargetAchievement(true);
      }
    }

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("pageshow", refreshOnFocus);
    };
  }, []);

  useEffect(() => {
    if (initialFetchDone.current) { initialFetchDone.current = false; return; }
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
      p_quote_post_id: null,
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
    // Update local total and check target achievement
    const studyMins = parseInt(studyMinutes || "0");
    const newTotal = totalMinutes + studyMins;
    setTotalMinutes(newTotal);
    if (profile?.target_minutes > 0 && newTotal >= profile.target_minutes) {
      const key = `target_achieved_${profile.target_minutes}_${profile.target_date || ""}`;
      if (!localStorage.getItem(key)) {
        setShowTargetAchievement(true);
      }
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

  const handleSurveySubmit = async () => {
    if (!activeSurvey || !selectedOption) return;
    setSurveySubmitting(true);
    const res = await fetch("/api/surveys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ survey_id: activeSurvey.id, selected_option: selectedOption, custom_reply: customReply || null }),
    });
    if (res.ok) {
      setSurveyResponse({ selected_option: selectedOption });
      setSelectedOption("");
      setCustomReply("");
      // reload results
      const r = await fetch("/api/surveys");
      if (r.ok) { const d = await r.json(); if (d.results) setSurveyResults(d.results); }
    }
    setSurveySubmitting(false);
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

        <StudyPomodoro />
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
            onChange={(e) => setContent(e.target.value.slice(0, 300))}
            placeholder="今日の学びを書こう"
            required
            maxLength={300}
            className="w-full border-none outline-none text-lg resize-none h-20"
          />
          <p className="text-xs text-right mt-1 text-gray-400">{content.length}/300</p>
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
            <BeeryualCamera userId={user.id} supabase={supabase} onResult={setBeeryualResult} />
            {beeryualResult && (
              <span className="text-xs text-green-600">✓ ビーリュアル合成済み</span>
            )}
          </div>

          <div className="text-right mt-2.5">
            <button type="submit" disabled={isSubmitting} className="bg-primary text-white font-bold rounded-full px-5 py-2 border-none cursor-pointer text-base disabled:opacity-50">
              リュイートする
            </button>
          </div>
        </form>
      </div>
      </div>

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

      {activeSurvey && !surveyDismissed && (
        <SurveyPopup
          activeSurvey={activeSurvey}
          surveyResponse={surveyResponse}
          surveyResults={surveyResults}
          selectedOption={selectedOption}
          customReply={customReply}
          surveySubmitting={surveySubmitting}
          readOnly={!surveyResponse && !!surveyResults}
          onSelectOption={setSelectedOption}
          onCustomReplyChange={setCustomReply}
          onSubmit={handleSurveySubmit}
          onDismiss={() => {
            if (!surveyResponse && surveyResults) {
              localStorage.setItem("dismissed_published_survey", activeSurvey.id);
              setPublishedDismissed(activeSurvey.id);
            }
            setSurveyDismissed(true);
          }}
          onClose={() => {
            if (!surveyResponse && surveyResults) {
              localStorage.setItem("dismissed_published_survey", activeSurvey.id);
              setPublishedDismissed(activeSurvey.id);
            }
            setSurveyDismissed(true);
          }}
        />
      )}

      {showTargetAchievement && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={dismissAchievement}>
          <div className="bg-gradient-to-br from-yellow-300 via-yellow-200 to-orange-200 rounded-2xl max-w-sm w-full p-8 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-6xl mb-4 animate-bounce">🎉</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">目標達成おめでとう！</h2>
            <p className="text-gray-700 mb-2">目標の <span className="font-bold">{Math.floor(profile?.target_minutes / 60)}時間{profile?.target_minutes % 60}分</span> を達成しました！</p>
            <p className="text-sm text-gray-600 mb-6">これからも勉強頑張ってください！</p>
            <div className="text-4xl mb-4">🏆🌟🎊</div>
            <button onClick={dismissAchievement}
              className="w-full bg-white text-gray-800 font-bold rounded-full py-3 text-base shadow-md cursor-pointer hover:bg-gray-100 transition">
              やったー！
            </button>
          </div>
        </div>
      )}

      {incomingChallenge && (
        <ChallengePopup
          incomingChallenge={incomingChallenge}
          onClose={() => setIncomingChallenge(null)}
          onAccept={async () => {
            await fetch(`/api/challenges/${incomingChallenge.id}/respond`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "accept" }),
            });
            setIncomingChallenge(null);
            addToast({ message: "勝負を受けた！頑張って！", type: "info" });
          }}
          onDecline={async () => {
            await fetch(`/api/challenges/${incomingChallenge.id}/respond`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "decline" }),
            });
            setIncomingChallenge(null);
          }}
        />
      )}
    </>
  );
}
