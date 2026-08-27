"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { compressImage, formatStudyTime, subjectColor } from "@/lib/utils";
import ImageCropper from "@/components/ImageCropper";
import ProfileHeader from "./ProfileHeader";
import TitleManager from "./TitleManager";
import IconManager from "./IconManager";
import FollowRecommendations from "@/components/FollowRecommendations";
import XConnectionCard from "@/components/XConnectionCard";
import { useTheme, type HomeSkin } from "@/components/ThemeProvider";

export default function EditProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [targetStartDate, setTargetStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetMinutes, setTargetMinutes] = useState("");
  const [message, setMessage] = useState("");
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activityTotals, setActivityTotals] = useState({ study: 0, workout: 0, monthStudy: 0, monthWorkout: 0 });
  const [focusScore, setFocusScore] = useState<any>(null);
  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [myPostsLoading, setMyPostsLoading] = useState(false);
  const [myPostsError, setMyPostsError] = useState("");
  const [likedLoading, setLikedLoading] = useState(false);
  const [likedError, setLikedError] = useState("");
  const [editSection, setEditSection] = useState<"posts" | "likes" | null>(null);
  const [postPage, setPostPage] = useState(1);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [iconFileName, setIconFileName] = useState("");
  const [likedPage, setLikedPage] = useState(1);
  const [isPro, setIsPro] = useState(false);
  const [defaultCardTheme, setDefaultCardTheme] = useState<"default" | "ocean" | "sunset" | "midnight" | "photo">("default");
  const [savingCardTheme, setSavingCardTheme] = useState(false);
  const [uploadingCardBackground, setUploadingCardBackground] = useState(false);
  const [cardBackgroundCropUrl, setCardBackgroundCropUrl] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const userIdRef = useRef<string | null>(null);
  const [userId, setUserId] = useState("");
  const { homeSkin, setHomeSkin } = useTheme();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      userIdRef.current = data.user.id;
      setUserId(data.user.id);
      loadData(data.user.id);
    });
  }, []);

  useEffect(() => {
    fetch("/api/pro/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setIsPro(Boolean(data?.isPro)))
      .catch(() => setIsPro(false));
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/focus-score?user_id=${encodeURIComponent(userId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setFocusScore(data))
      .catch(() => setFocusScore(null));
  }, [userId]);

  const loadData = async (uid?: string) => {
    const id = uid || userIdRef.current;
    if (!id) return;
    const [profileResult, userItemsResult] = await Promise.all([
      supabase.from("profiles").select("id, display_name, username, bio, icon_url, target_date, target_minutes, points, exchange_points, current_title_id, current_avatar_id, default_post_card_theme, post_card_background_url, post_card_background_path").eq("id", id).single(),
      supabase.from("user_items").select("*, item:item_id(*)").eq("user_id", id),
    ]);

    if (profileResult.data) {
      setProfile(profileResult.data);
      setUsername(profileResult.data.username || "");
      setDisplayName(profileResult.data.display_name || "");
      setBio(profileResult.data.bio || "");
      setTargetDate(profileResult.data.target_date || "");
      setTargetMinutes(String(profileResult.data.target_minutes || 0));
      setDefaultCardTheme(profileResult.data.default_post_card_theme || "default");
      (async () => {
        try {
          const { data: sd } = await supabase.from("profiles").select("target_start_date").eq("id", id).maybeSingle();
          const saved = (sd as any)?.target_start_date;
          if (saved) {
            setTargetStartDate(saved);
            localStorage.setItem("target_start_date_fallback", saved);
          } else {
            setTargetStartDate(localStorage.getItem("target_start_date_fallback") || new Date().toISOString().slice(0, 10));
          }
        } catch {
          setTargetStartDate(localStorage.getItem("target_start_date_fallback") || new Date().toISOString().slice(0, 10));
        }
      })();
    }
    if (userItemsResult.data) {
      setItems(userItemsResult.data.map((ui: any) => ui.item));
    }

    const [{ count: followers }, { count: following }, { data: activityPosts }] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
      supabase.from("posts").select("study_minutes, workout_minutes, created_at").eq("user_id", id),
    ]);
    setFollowersCount(followers ?? 0);
    setFollowingCount(following ?? 0);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const totals = (activityPosts || []).reduce((result: { study: number; workout: number; monthStudy: number; monthWorkout: number }, post: any) => {
      const study = Number(post.study_minutes) || 0;
      const workout = Number(post.workout_minutes) || 0;
      result.study += study;
      result.workout += workout;
      if (post.created_at && new Date(post.created_at) >= monthStart) {
        result.monthStudy += study;
        result.monthWorkout += workout;
      }
      return result;
    }, { study: 0, workout: 0, monthStudy: 0, monthWorkout: 0 });
    setActivityTotals(totals);
  };

  const loadMyPosts = async () => {
    setMyPostsLoading(true);
    setMyPostsError("");
    setPostPage(1);
    const { data: myPostsData } = await supabase.from("posts")
      .select("*, user:user_id(id, display_name, username, icon_url, post_card_background_url)")
      .eq("user_id", userIdRef.current)
      .order("created_at", { ascending: false });
    if (myPostsData === null) setMyPostsError("読み込み失敗");
    else setMyPosts(myPostsData.map((post: any) => ({ ...post, user: { ...post.user, has_active_pro: isPro } })));
    setMyPostsLoading(false);
  };

  const loadLikedPosts = async () => {
    setLikedLoading(true);
    setLikedError("");
    setLikedPage(1);
    const { data: likesData } = await supabase.from("likes").select("post_id").eq("user_id", userIdRef.current);
    if (!likesData) { setLikedError("読み込み失敗"); setLikedLoading(false); return; }
    const postIds = likesData.map((l: any) => l.post_id);
    if (postIds.length > 0) {
      const { data: posts } = await supabase.from("posts")
        .select("*, user:user_id(id, display_name, username, icon_url)")
        .in("id", postIds)
        .order("created_at", { ascending: false });
      setLikedPosts(posts ?? []);
    } else setLikedPosts([]);
    setLikedLoading(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (username && !/^[a-zA-Z0-9_.!~()@^'"=]+$/.test(username)) {
      setMessage("ユーザーIDに使用できない文字が含まれています"); return;
    }
    const updateData: Record<string, any> = {
      username: username || undefined, display_name: displayName, bio,
      target_date: targetDate || null, target_minutes: parseInt(targetMinutes) || 0,
      target_start_date: targetStartDate || null,
    };

    if (croppedBlob && iconFileName) {
      const { error: uploadError } = await supabase.storage.from("avatars").upload(iconFileName, croppedBlob);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(iconFileName);
        if (urlData?.publicUrl) updateData.icon_url = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from("profiles").update(updateData).eq("id", user.id);
    if (!error) {
      localStorage.setItem("target_start_date_fallback", targetStartDate);
      setMessage("保存しました！"); loadData(user.id);
    } else if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
      setMessage("このユーザーIDは既に使われています");
    } else if (error.message?.includes("target_start_date")) {
      // カラム未存在（マイグレーション未実行）→ そのカラムだけ除外して再試行
      delete updateData.target_start_date;
      const { error: retryErr } = await supabase.from("profiles").update(updateData).eq("id", user.id);
      if (retryErr) setMessage(retryErr.message || "保存に失敗しました");
      else { setMessage("保存しました！（開始日はマイグレーション後に反映されます）"); loadData(user.id); }
    } else setMessage(error.message || "保存に失敗しました");
  };

  const saveDefaultCardTheme = async (theme: "default" | "ocean" | "sunset" | "midnight" | "photo") => {
    if (!isPro || !userId) return;
    if (theme === "photo" && !profile?.post_card_background_url) {
      setMessage("先にカスタム背景画像をアップロードしてください。");
      return;
    }
    setDefaultCardTheme(theme);
    setSavingCardTheme(true);
    const { error } = await supabase.from("profiles").update({ default_post_card_theme: theme } as any).eq("id", userId);
    setSavingCardTheme(false);
    if (error) {
      setMessage("保存に失敗しました。画面を更新してもう一度試してください。");
      return;
    }
    setProfile((current: any) => ({ ...current, default_post_card_theme: theme }));
    setMessage("投稿カードの柄を保存しました。次の投稿から反映されます。");
  };

  const uploadCardBackground = async (file: File) => {
    if (!isPro || !userId) return;
    if (!file.type.startsWith("image/")) { setMessage("画像ファイルを選択してください。"); return; }
    if (file.size > 10 * 1024 * 1024) { setMessage("画像は10MB以下にしてください。"); return; }
    setUploadingCardBackground(true);
    try {
      const compressed = await compressImage(file, 0.82, 1600);
      if (compressed.size > 5 * 1024 * 1024) { setMessage("圧縮後も画像が大きすぎます。別の画像を選んでください。"); return; }
      const path = `${userId}/background.jpg`;
      const { error: uploadError } = await supabase.storage.from("post-card-backgrounds").upload(path, compressed, {
        upsert: true, contentType: "image/jpeg", cacheControl: "31536000",
      });
      if (uploadError) { setMessage(`画像アップロードに失敗しました: ${uploadError.message}`); return; }
      const { data: urlData } = supabase.storage.from("post-card-backgrounds").getPublicUrl(path);
      const url = urlData.publicUrl ? `${urlData.publicUrl}?v=${Date.now()}` : null;
      const { error } = await supabase.from("profiles").update({ post_card_background_url: url, post_card_background_path: path } as any).eq("id", userId);
      if (error || !url) { setMessage(error?.message || "背景画像の保存に失敗しました。"); return; }
      setProfile((current: any) => ({ ...current, post_card_background_url: url, post_card_background_path: path }));
      setMessage("背景画像を保存しました。自分の投稿カードすべてに反映されます。");
    } catch {
      setMessage("画像の読み込みまたは圧縮に失敗しました。");
    } finally {
      setUploadingCardBackground(false);
    }
  };

  const openCardBackgroundCropper = (file: File) => {
    if (!isPro) return;
    if (!file.type.startsWith("image/")) { setMessage("画像ファイルを選択してください。"); return; }
    if (file.size > 10 * 1024 * 1024) { setMessage("画像は10MB以下にしてください。"); return; }
    setCardBackgroundCropUrl(URL.createObjectURL(file));
  };

  const saveCardBackgroundCrop = async (blob: Blob) => {
    const file = new File([blob], "post-card-background.jpg", { type: "image/jpeg" });
    const oldUrl = cardBackgroundCropUrl;
    setCardBackgroundCropUrl(null);
    if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
    await uploadCardBackground(file);
  };

  const removeCardBackground = async () => {
    if (!isPro || !userId || !profile?.post_card_background_url) return;
    setUploadingCardBackground(true);
    const path = profile.post_card_background_path || `${userId}/background.jpg`;
    const nextTheme = defaultCardTheme === "photo" ? "default" : defaultCardTheme;
    const { error } = await supabase.from("profiles").update({ post_card_background_url: null, post_card_background_path: null, default_post_card_theme: nextTheme } as any).eq("id", userId);
    if (error) setMessage(error.message || "背景画像の削除に失敗しました。");
    else {
      await supabase.storage.from("post-card-backgrounds").remove([path]);
      setProfile((current: any) => ({ ...current, post_card_background_url: null, post_card_background_path: null, default_post_card_theme: nextTheme }));
      setDefaultCardTheme(nextTheme);
      setMessage("背景画像を削除しました。投稿カードは通常デザインに戻ります。");
    }
    setUploadingCardBackground(false);
  };

  if (!profile) return null;

  const sectionForm = (title: string, icon: string, onSubmit: (e: React.FormEvent) => Promise<void>, children: React.ReactNode) => (
    <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <i className={`fas ${icon} text-primary text-sm w-4 text-center`} />
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </form>
  );

  const sectionCard = (title: string, icon: string, children: React.ReactNode) => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <i className={`fas ${icon} text-primary text-sm w-4 text-center`} />
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {message && (
        <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">{message}</div>
      )}

      <ProfileHeader
        profile={profile} items={items} followersCount={followersCount} followingCount={followingCount} userId={userId}
        activityTotals={activityTotals}
        focusScore={focusScore}
        editSection={editSection} setEditSection={setEditSection}
        myPosts={myPosts} myPostsLoading={myPostsLoading} myPostsError={myPostsError}
        postPage={postPage} setPostPage={setPostPage}
        likedPosts={likedPosts} likedLoading={likedLoading} likedError={likedError}
        likedPage={likedPage} setLikedPage={setLikedPage}
        loadMyPosts={loadMyPosts} loadLikedPosts={loadLikedPosts}
        onDeletePost={(id: string) => setMyPosts((prev) => prev.filter((p: any) => p.id !== id))}
        onUpdatePost={(id: string, data: any) => setMyPosts((prev: any[]) => prev.map((p: any) =>
          p.id === id ? { ...p, ...data, subject_color: data.subject ? subjectColor(data.subject) : p.subject_color, display_study_time: formatStudyTime(data.study_minutes ?? p.study_minutes), display_workout_time: formatStudyTime(data.workout_minutes ?? p.workout_minutes) } : p))}
      />

      <FollowRecommendations userId={userId} />

      {sectionForm("プロフィール", "fa-user", handleUpdateProfile,
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700">ユーザーID (@...)</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" />
            <p className="text-[10px] text-gray-400 mt-0.5">一部記号も使用可能。変更するとURLも変わります。</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">表示名</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">自己紹介</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300}
              className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" rows={2} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">アイコン画像</label>
            <input type="file" accept="image/*" className="text-xs mt-0.5"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const ext = file.name.split(".").pop() || "jpg";
                setIconFileName(`icons/${userId}/${Date.now()}.${ext}`);
                setCropImageUrl(URL.createObjectURL(file));
              }} />
            {croppedBlob && (
              <span className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <i className="fas fa-check-circle" /> 切り抜き済み
              </span>
            )}
          </div>
          <button type="submit" className="w-full bg-primary text-white font-bold rounded-full py-1.5 text-sm cursor-pointer">
            保存
          </button>

          <TitleManager items={items} profile={profile} onRefresh={loadData} onMessage={setMessage} />
          <IconManager items={items} profile={profile} onRefresh={loadData} onMessage={setMessage} />
        </>)
      }

      {sectionCard("SNS連携", "fa-share-nodes", <XConnectionCard />)}

      {sectionCard("Proホームテーマ", "fa-wand-magic-sparkles",
        isPro ? <>
          <p className="text-xs text-gray-500">LINEの着せかえのように、自分のリュッター画面だけ色を変えられます。ほかの人の画面・投稿には影響しません。</p>
          <div className="grid grid-cols-2 gap-2">
            {([['default', 'スタンダード', 'from-slate-800 to-slate-950'], ['ocean', 'オーシャン', 'from-cyan-500 to-blue-800'], ['sakura', 'さくら', 'from-pink-400 to-fuchsia-700'], ['midnight', 'ミッドナイト', 'from-indigo-700 to-violet-950']] as const).map(([value, label, colors]) => <button key={value} type="button" onClick={() => setHomeSkin(value as HomeSkin)} className={`relative overflow-hidden rounded-xl border-2 p-3 text-left ${homeSkin === value ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'}`}><span className={`block h-9 rounded-lg bg-gradient-to-br ${colors}`} /><b className="mt-2 block text-xs text-gray-900">{label}</b>{homeSkin === value && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[10px] text-white"><i className="fas fa-check" /></span>}</button>)}
          </div>
          <p className="text-[11px] font-bold text-purple-700"><i className="fas fa-crown mr-1" />この端末でだけ保存されます。いつでも変更できます。</p>
        </> : <Link href="/pro?from=home-theme" className="block rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4 no-underline"><p className="text-sm font-bold text-purple-950"><i className="fas fa-lock mr-1.5" />ホームテーマはPro限定</p><p className="mt-1 text-xs text-purple-800">自分だけの画面カラーに着せかえできます。</p><div className="mt-3 flex gap-1.5"><span className="h-7 flex-1 rounded bg-gradient-to-br from-cyan-500 to-blue-800" /><span className="h-7 flex-1 rounded bg-gradient-to-br from-pink-400 to-fuchsia-700" /><span className="h-7 flex-1 rounded bg-gradient-to-br from-indigo-700 to-violet-950" /></div></Link>
      )}

      {sectionCard("Pro投稿カード", "fa-palette",
        isPro ? <>
          <p className="text-xs text-gray-500">ここで選んだ柄・背景が、変更するまで自分の投稿カードすべてに使われます。</p>
          <div className="flex flex-wrap gap-2">
            {([['default','標準'], ['ocean','オーシャン'], ['sunset','サンセット'], ['midnight','ミッドナイト'], ['photo','カスタム画像']] as const).map(([value, label]) => (
              <button key={value} type="button" disabled={savingCardTheme} onClick={() => saveDefaultCardTheme(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold border cursor-pointer disabled:opacity-50 ${defaultCardTheme === value ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-purple-200 text-purple-700'}`}>
                {defaultCardTheme === value && <i className="fas fa-check mr-1" />}{label}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-purple-100 bg-purple-50 p-3 space-y-2">
            <p className="text-xs font-bold text-purple-900"><i className="fas fa-image mr-1" />カスタム背景画像</p>
            {profile.post_card_background_url ? <>
              <div className="h-32 rounded-lg bg-cover bg-center relative overflow-hidden" style={{ backgroundImage: `linear-gradient(rgba(15,23,42,.45),rgba(15,23,42,.62)),url(${profile.post_card_background_url})` }}>
                <div className="absolute inset-x-3 bottom-3 text-white text-xs drop-shadow"><b>{profile.display_name || profile.username}</b><br />今日も積み上げました！</div>
              </div>
              <div className="flex gap-2">
                <label className="flex-1 text-center bg-purple-600 text-white rounded-full py-2 text-xs font-bold cursor-pointer">
                  {uploadingCardBackground ? "処理中..." : "画像を変更"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingCardBackground} onChange={(e) => { const file = e.target.files?.[0]; if (file) openCardBackgroundCropper(file); e.target.value = ""; }} />
                </label>
                <button type="button" disabled={uploadingCardBackground} onClick={() => setCardBackgroundCropUrl(profile.post_card_background_url)} className="bg-white border border-purple-200 text-purple-700 rounded-full px-3 py-2 text-xs font-bold cursor-pointer disabled:opacity-50">切り取りを調整</button>
                <button type="button" disabled={uploadingCardBackground} onClick={removeCardBackground} className="bg-white border border-red-200 text-red-600 rounded-full px-4 py-2 text-xs font-bold cursor-pointer disabled:opacity-50">背景を削除</button>
              </div>
            </> : <label className="block border-2 border-dashed border-purple-200 rounded-lg p-4 text-center cursor-pointer hover:bg-white/70">
              <i className="fas fa-cloud-arrow-up text-purple-500" /><p className="text-xs font-bold text-purple-800 mt-1">背景画像をアップロード</p><p className="text-[10px] text-purple-600 mt-1">JPG / PNG / WebP・10MBまで（自動で1600pxに圧縮）</p>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingCardBackground} onChange={(e) => { const file = e.target.files?.[0]; if (file) openCardBackgroundCropper(file); e.target.value = ""; }} />
            </label>}
          </div>
          {defaultCardTheme === "photo" && <p className="text-[11px] text-purple-700">保存済みのカスタム背景が、添付画像の有無に関係なく自分の全投稿に表示されます。</p>}
        </> : <a href="/pro?from=card-background" className="block rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4 no-underline cursor-pointer">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-purple-950"><i className="fas fa-lock mr-1.5" />投稿カードの背景・柄はPro限定</p><p className="mt-1 text-xs text-purple-800">投稿を自分らしいデザインにカスタマイズできます。</p></div><i className="fas fa-chevron-right text-purple-500 text-xs" /></div>
          <div className="mt-3 grid grid-cols-5 gap-1.5 opacity-80">
            <span className="h-10 rounded-md border border-gray-200 bg-white" />
            <span className="h-10 rounded-md bg-gradient-to-br from-sky-200 to-blue-400" />
            <span className="h-10 rounded-md bg-gradient-to-br from-orange-200 to-rose-400" />
            <span className="h-10 rounded-md bg-gradient-to-br from-slate-900 to-indigo-700" />
            <span className="relative h-10 rounded-md overflow-hidden bg-gradient-to-br from-violet-400 via-pink-300 to-amber-200"><i className="fas fa-image absolute inset-0 flex items-center justify-center text-white/90" /></span>
          </div>
          <p className="mt-2 text-[11px] font-bold text-purple-700"><i className="fas fa-crown mr-1" />好きな画像も背景に設定できます</p>
        </a>
      )}

      {sectionCard("ログインボーナス", "fa-calendar-check",
        <Link href="/gacha" className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 no-underline">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <i className="fas fa-calendar-check text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">ログインボーナス</p>
            <p className="text-xs text-gray-500">連続ログインでアイテムをGET！</p>
          </div>
          <i className="fas fa-chevron-right text-gray-300 text-xs" />
        </Link>
      )}

      {sectionCard("学習目標", "fa-bullseye",
        <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">開始日</label>
              <input type="date" value={targetStartDate} onChange={(e) => setTargetStartDate(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">目標日</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">目標時間（分）</label>
              <input type="number" value={targetMinutes} onChange={(e) => setTargetMinutes(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" min={0} />
            </div>
          </div>
      )}

      {cardBackgroundCropUrl && (
        <ImageCropper
          imageUrl={cardBackgroundCropUrl}
          aspect={16 / 9}
          allowAspectChange
          onComplete={saveCardBackgroundCrop}
          onCancel={() => {
            if (cardBackgroundCropUrl.startsWith("blob:")) URL.revokeObjectURL(cardBackgroundCropUrl);
            setCardBackgroundCropUrl(null);
          }}
        />
      )}

      {cropImageUrl && (
        <ImageCropper
          imageUrl={cropImageUrl}
          aspect={1}
          cropShape="round"
          onComplete={(blob) => {
            setCroppedBlob(blob);
            setCropImageUrl(null);
          }}
          onCancel={() => {
            setCropImageUrl(null);
            setCroppedBlob(null);
          }}
        />
      )}
    </div>
  );
}
