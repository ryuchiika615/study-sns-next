"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import NextImage from "next/image";
import dynamic from "next/dynamic";
import PostCard from "@/components/PostCard";
import { useToast } from "@/components/ToastProvider";
const SurveyPopup = dynamic(() => import("@/components/SurveyPopup"), { ssr: false });
const ChallengePopup = dynamic(() => import("@/components/ChallengePopup"), { ssr: false });
import PullToRefresh from "@/components/PullToRefresh";
import { PostCardSkeleton } from "@/components/Skeleton";
import { fetchAndEnrichPosts } from "@/lib/post-fetcher";
import { formatStudyTime, subjectColor, getOptimizedIconUrl, vibrateDevice } from "@/lib/utils";

type WholeHomeClientProps = {
  userId: string;
  profile: any;
  totalMinutes: number;
  initialPosts?: any[];
  initialTotalPages?: number;
  search?: string;
};

export default function WholeHomeClient({ userId, profile: initialProfile, totalMinutes: initialTotal, initialPosts, initialTotalPages, search = "" }: WholeHomeClientProps) {
  const supabase = createClient();
  const [posts, setPosts] = useState<any[]>(initialPosts || []);
  const [profile] = useState(initialProfile);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages || 1);
  const [totalMinutes, setTotalMinutes] = useState(initialTotal);
  const [showTargetAchievement, setShowTargetAchievement] = useState(false);
  const initialFetchDone = useRef(!!initialPosts);
  const seenNotifs = useRef<Set<string>>(new Set(
    JSON.parse(localStorage.getItem("seen_notifs") || "[]")
  ));
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
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<any>(null);
  const [showWeeklyReport, setShowWeeklyReport] = useState(() => localStorage.getItem("weekly_report_dismissed") !== "1");
  const [showDismissConfirm, setShowDismissConfirm] = useState(false);
  const [newAchievements, setNewAchievements] = useState<any[]>([]);
  const [showAchievementPopup, setShowAchievementPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const latestCreatedAt = useRef<string | null>(null);
  const addToast = useToast();

  const fetchPosts = async (p: number, q: string) => {
    setLoading(true);
    const result = await fetchAndEnrichPosts(supabase, userId, { page: p, search: q });
    setPosts(result.posts);
    setTotalPages(result.totalPages);
    if (result.posts.length > 0) {
      latestCreatedAt.current = result.posts[0].created_at;
    }
    setHasNewPosts(false);
    setLoading(false);
  };

  const pollNotifications = async () => {
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
        .eq("recipient_id", userId)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase.from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("recipient_id", userId)
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

    if (latestCreatedAt.current && page === 1 && !search) {
      const { data: followedUsers } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);
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

    // Supabase Realtime subscriptions for instant notifications
    const channel = supabase.channel("home-realtime")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        () => { pollNotifications(); }
      )
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "challenges", filter: `opponent_id=eq.${userId}` },
        () => { pollChallenges(); }
      )
      .subscribe();

    const refreshOnFocus = () => {
      if (document.hidden) return;
      pollAll();
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("pageshow", refreshOnFocus);

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

    if (initialProfile?.target_minutes > 0 && initialTotal >= initialProfile.target_minutes) {
      const key = `target_achieved_${initialProfile.target_minutes}_${initialProfile.target_date || ""}`;
      if (!localStorage.getItem(key)) {
        setShowTargetAchievement(true);
      }
    }

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("pageshow", refreshOnFocus);
    };
  }, []);

  useEffect(() => {
    if (initialFetchDone.current) { initialFetchDone.current = false; return; }
    fetchPosts(page, search);
  }, [page]);

  useEffect(() => {
    const fetchActive = async () => {
      const res = await fetch("/api/study/active-users");
      if (res.ok) setActiveUsers(await res.json());
    };
    fetchActive();
    fetch("/api/weekly-report").then(r => r.ok && r.json()).then(d => { if (d) setWeeklyReport(d); });
    // Listen for restore event from AppShell gear menu
    const restoreHandler = () => {
      setShowWeeklyReport(true);
    };
    window.addEventListener("restore-weekly-report", restoreHandler);
    // Check for newly earned achievements
    const seenKey = "seen_achievements";
    fetch("/api/achievements/check").then(r => r.ok && r.json()).then(d => {
      if (d && d.newlyEarned && d.newlyEarned.length > 0) {
        const seen = new Set(JSON.parse(localStorage.getItem(seenKey) || "[]"));
        const unseen = d.newlyEarned.filter((id: string) => !seen.has(id));
        if (unseen.length > 0) {
          setNewAchievements((d.achievements || []).filter((a: any) => unseen.includes(a.id)));
          setShowAchievementPopup(true);
          localStorage.setItem(seenKey, JSON.stringify([...seen, ...unseen]));
        }
      }
    });
    const iv = setInterval(fetchActive, 30000);
    return () => {
      clearInterval(iv);
      window.removeEventListener("restore-weekly-report", restoreHandler);
    };
  }, []);

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
      const r = await fetch("/api/surveys");
      if (r.ok) { const d = await r.json(); if (d.results) setSurveyResults(d.results); }
    }
    setSurveySubmitting(false);
  };

  return (
    <>
      {showWeeklyReport && weeklyReport && (
        <div className="mx-4 mb-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 text-white shadow-sm relative">
          <button onClick={() => setShowDismissConfirm(true)}
            className="absolute top-2 right-2 text-white/60 hover:text-white text-sm w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 cursor-pointer">
            <i className="fas fa-times" />
          </button>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold"><i className="fas fa-chart-line mr-1.5" />今週のレポート</h3>
            <span className="text-xs text-indigo-200">{weeklyReport.weekStart}〜</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center mb-2">
            <div>
              <p className="text-lg font-bold">{weeklyReport.totalMinutes > 0 ? `${Math.floor(weeklyReport.totalMinutes / 60)}h${weeklyReport.totalMinutes % 60}m` : "0m"}</p>
              <p className="text-[10px] text-indigo-200">勉強時間</p>
            </div>
            <div>
              <p className="text-lg font-bold">{weeklyReport.postCount}</p>
              <p className="text-[10px] text-indigo-200">投稿数</p>
            </div>
            <div>
              <p className="text-lg font-bold">{weeklyReport.habitRate}%</p>
              <p className="text-[10px] text-indigo-200">習慣達成</p>
            </div>
            <div>
              <p className="text-lg font-bold">{weeklyReport.textbookPages}</p>
              <p className="text-[10px] text-indigo-200">進捗P</p>
            </div>
          </div>
          {weeklyReport.subjects?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {weeklyReport.subjects.slice(0, 4).map((s: any) => (
                <span key={s.subject} className="text-[10px] bg-white/20 rounded-full px-2 py-0.5">
                  {s.subject} {Math.floor(s.minutes / 60)}h{s.minutes % 60}m
                </span>
              ))}
            </div>
          )}
          {weeklyReport.aiComment && (
            <div className="mt-2 bg-white/10 rounded-lg p-3 text-sm leading-relaxed">
              <i className="fas fa-robot mr-1.5 text-indigo-200" />
              {weeklyReport.aiComment}
            </div>
          )}
        </div>
      )}
      {activeUsers.length > 0 && (
        <div className="mx-4 mb-3 bg-blue-50 rounded-xl p-3 border border-blue-100">
          <p className="text-xs font-bold text-blue-600 mb-2"><i className="fas fa-book-open mr-1" />勉強中のユーザー</p>
          <div className="flex flex-wrap gap-2">
            {activeUsers.map((s: any) => (
              <a key={s.user_id} href={`/profile/${s.user_id}`}
                className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1 text-sm no-underline text-gray-700 border border-blue-100 hover:bg-blue-50">
                <img src={s.user?.icon_url || "/default-icon.png"} alt="" className="w-5 h-5 rounded-full" />
                {s.user?.display_name || s.user?.username || "不明"}
              </a>
            ))}
          </div>
        </div>
      )}
      <PullToRefresh onRefresh={async () => { await fetchPosts(1, search); }}>

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
        <PostCard key={post.id} post={post} currentUserId={userId}
          onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
          onUpdate={(id, data) => setPosts((prev) => prev.map((p) => p.id === id ? { ...p, ...data, subject_color: data.subject ? subjectColor(data.subject) : p.subject_color, display_study_time: formatStudyTime(data.study_minutes ?? p.study_minutes) } : p))} />
      ))}

      {posts.length === 0 && !loading && (
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

      {showAchievementPopup && newAchievements.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAchievementPopup(false)}>
          <div className="bg-gradient-to-br from-yellow-300 via-yellow-200 to-orange-100 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl mb-3">🏅</div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">実績解除！！</h2>
            <p className="text-sm text-gray-600 mb-4">新しい実績を達成しました！</p>
            <div className="space-y-2 mb-4">
              {newAchievements.map((a: any) => (
                <div key={a.id} className="bg-white/70 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-2xl">{a.icon}</span>
                  <div className="text-left">
                    <p className="font-bold text-sm text-gray-800">{a.title}</p>
                    <p className="text-xs text-gray-500">{a.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <a href="/achievements"
              className="block w-full bg-white text-gray-800 font-bold rounded-full py-2.5 text-sm shadow-md cursor-pointer hover:bg-gray-100 transition text-center no-underline mb-2">
              受け取る！
            </a>
            <button onClick={() => setShowAchievementPopup(false)}
              className="w-full text-gray-500 text-xs font-bold py-1.5 cursor-pointer hover:text-gray-700 transition">
              あとで
            </button>
          </div>
        </div>
      )}

      {/* 非表示確認ダイアログ */}
      {showDismissConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDismissConfirm(false)}>
          <div className="bg-white rounded-2xl max-w-xs w-full p-6 shadow-xl text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-gray-700 mb-4">今週のレポートを非表示にしますか？<br /><span className="text-xs text-gray-400">画面右下の ⚙ から再表示できます</span></p>
            <div className="flex gap-2">
              <button onClick={() => {
                localStorage.setItem("weekly_report_dismissed", "1");
                setShowWeeklyReport(false);
                setShowDismissConfirm(false);
              }} className="flex-1 bg-red-500 text-white font-bold rounded-full py-2 text-sm cursor-pointer hover:bg-red-600 transition">
                はい、非表示にする
              </button>
              <button onClick={() => setShowDismissConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-600 font-bold rounded-full py-2 text-sm cursor-pointer hover:bg-gray-200 transition">
                いいえ
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
