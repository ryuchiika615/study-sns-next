"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { formatStudyTime, subjectColor } from "@/lib/utils";
import ImageCropper from "@/components/ImageCropper";
import ProfileHeader from "./ProfileHeader";
import TitleManager from "./TitleManager";
import IconManager from "./IconManager";
import FollowRecommendations from "@/components/FollowRecommendations";

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
  const router = useRouter();
  const supabase = createClient();
  const userIdRef = useRef<string | null>(null);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      userIdRef.current = data.user.id;
      setUserId(data.user.id);
      loadData(data.user.id);
    });
  }, []);

  const loadData = async (uid?: string) => {
    const id = uid || userIdRef.current;
    if (!id) return;
    const [profileResult, userItemsResult] = await Promise.all([
      supabase.from("profiles").select("id, display_name, username, bio, icon_url, target_start_date, target_date, target_minutes, points, exchange_points, current_title_id, current_avatar_id").eq("id", id).single(),
      supabase.from("user_items").select("*, item:item_id(*)").eq("user_id", id),
    ]);

    if (profileResult.data) {
      setProfile(profileResult.data);
      setUsername(profileResult.data.username || "");
      setDisplayName(profileResult.data.display_name || "");
      setBio(profileResult.data.bio || "");
      setTargetDate(profileResult.data.target_date || "");
      setTargetStartDate(profileResult.data.target_start_date || new Date().toISOString().slice(0, 10));
      setTargetMinutes(String(profileResult.data.target_minutes || 0));
    }
    if (userItemsResult.data) {
      setItems(userItemsResult.data.map((ui: any) => ui.item));
    }

    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
    ]);
    setFollowersCount(followers ?? 0);
    setFollowingCount(following ?? 0);
  };

  const loadMyPosts = async () => {
    setMyPostsLoading(true);
    setMyPostsError("");
    setPostPage(1);
    const { data: myPostsData } = await supabase.from("posts")
      .select("*, user:user_id(id, display_name, username, icon_url)")
      .eq("user_id", userIdRef.current)
      .order("created_at", { ascending: false });
    if (myPostsData === null) setMyPostsError("読み込み失敗");
    else setMyPosts(myPostsData);
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
      target_date: targetDate || null, target_start_date: targetStartDate || null, target_minutes: parseInt(targetMinutes) || 0,
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
      setMessage("保存しました！"); loadData(user.id);
    } else if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
      setMessage("このユーザーIDは既に使われています");
    } else setMessage(error.message || "保存に失敗しました");
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
        editSection={editSection} setEditSection={setEditSection}
        myPosts={myPosts} myPostsLoading={myPostsLoading} myPostsError={myPostsError}
        postPage={postPage} setPostPage={setPostPage}
        likedPosts={likedPosts} likedLoading={likedLoading} likedError={likedError}
        likedPage={likedPage} setLikedPage={setLikedPage}
        loadMyPosts={loadMyPosts} loadLikedPosts={loadLikedPosts}
        onDeletePost={(id: string) => setMyPosts((prev) => prev.filter((p: any) => p.id !== id))}
        onUpdatePost={(id: string, data: any) => setMyPosts((prev: any[]) => prev.map((p: any) =>
          p.id === id ? { ...p, ...data, subject_color: data.subject ? subjectColor(data.subject) : p.subject_color, display_study_time: formatStudyTime(data.study_minutes ?? p.study_minutes) } : p))}
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
