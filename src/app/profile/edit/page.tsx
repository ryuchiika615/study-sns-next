"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import { formatStudyTime, getOptimizedIconUrl } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";
import { itemDisplayName, isRefinedItem, SELL_VALUES, RARITY_ORDER, SHOP_CATALOG } from "@/lib/shop-catalog";
import FollowRecommendations from "@/components/FollowRecommendations";
import RefineParts from "@/components/RefineParts";

export default function EditProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetMinutes, setTargetMinutes] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
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
  const [likedPage, setLikedPage] = useState(1);

  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [titles, setTitles] = useState<any[]>([]);
  const { theme, toggleTheme } = useTheme();
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

  const loadData = async (userId?: string) => {
    const uid = userId || userIdRef.current;
    if (!uid) return;
    const [profileResult, userItemsResult, notifResult] = await Promise.all([
      supabase.from("profiles").select("id, display_name, username, bio, icon_url, target_date, target_minutes, points, exchange_points, current_title_id, current_avatar_id").eq("id", uid).single(),
      supabase.from("user_items").select("*, item:item_id(*)").eq("user_id", uid),
      supabase.from("notifications").select("*", { count: "exact", head: true }).eq("recipient_id", uid).eq("is_read", false).neq("notification_type", "follow_post"),
    ]);

    if (profileResult.data) {
      setProfile(profileResult.data);
      setUsername(profileResult.data.username || "");
      setDisplayName(profileResult.data.display_name || "");
      setBio(profileResult.data.bio || "");
      setTargetDate(profileResult.data.target_date || "");
      setTargetMinutes(String(profileResult.data.target_minutes || 0));
    }

    if (userItemsResult.data) {
      const items = userItemsResult.data.map((ui: any) => ui.item);
      setItems(items);

    }

    setUnreadCount(notifResult.count || 0);

    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", uid),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", uid),
    ]);
    setFollowersCount(followers ?? 0);
    setFollowingCount(following ?? 0);
  };

  const loadMyPosts = async () => {
    setMyPostsLoading(true);
    setMyPostsError("");
    setPostPage(1);
    const { data: myPostsData } = await supabase
      .from("posts")
      .select("*, user:user_id(id, display_name, username, icon_url)")
      .eq("user_id", userIdRef.current)
      .order("created_at", { ascending: false });
    if (myPostsData === null) { setMyPostsError("読み込み失敗"); }
    else { setMyPosts(myPostsData); }
    setMyPostsLoading(false);
  };

  const loadLikedPosts = async () => {
    setLikedLoading(true);
    setLikedError("");
    setLikedPage(1);
    const { data: likesData } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", userIdRef.current);
    if (!likesData) { setLikedError("読み込み失敗"); setLikedLoading(false); return; }
    const postIds = likesData.map((l: any) => l.post_id);
    if (postIds.length > 0) {
      const { data: posts } = await supabase
        .from("posts")
        .select("*, user:user_id(id, display_name, username, icon_url)")
        .in("id", postIds)
        .order("created_at", { ascending: false });
      setLikedPosts(posts ?? []);
    } else {
      setLikedPosts([]);
    }
    setLikedLoading(false);
  };

  const loadInventory = () => {
    setTitles(items.filter((i: any) => i.category === "title"));
  };

  const handleEquip = async (itemId: string, slot: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: ownership } = await supabase
      .from("user_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("item_id", itemId)
      .maybeSingle();
    if (ownership) {
      await supabase.from("profiles").update({ [slot]: itemId }).eq("id", user.id);
      loadData(user.id);
    }
  };

  const handleRefineParts = async (word: string, noun: string, namePart: string, order: string, connA?: string, connB?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.rpc("refine_parts", {
      p_word: word, p_noun: noun, p_name_part: namePart, p_order: order,
      p_conn_a: connA || '', p_conn_b: connB || '',
    });
    if (!error && data) {
      setMessage("精錬しました！");
      loadData(user.id);
    } else {
      setMessage(error?.message || "精錬に失敗しました");
    }
  };

  const ownedParts = () => {
    const displayNames = titles.map((t: any) => itemDisplayName(t));
    const tokens = new Set<string>();
    for (const name of displayNames) {
      tokens.add(name);
      const parts = name.split(/[\s,、。．.（）()「」【】]+/).filter(Boolean);
      for (const p of parts) tokens.add(p);
    }
    return [...tokens].sort();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (username && !/^[a-zA-Z0-9_.!~()@^'"=]+$/.test(username)) {
      setMessage("ユーザーIDに使用できない文字が含まれています");
      return;
    }
    const updateData: Record<string, any> = {
      username: username || undefined,
      display_name: displayName,
      bio,
      target_date: targetDate || null,
      target_minutes: parseInt(targetMinutes) || 0,
    };

    const iconInput = document.querySelector<HTMLInputElement>('input[name="icon"]');
    if (iconInput?.files?.[0]) {
      const file = iconInput.files[0];
      const fileExt = file.name.split(".").pop();
      const fileName = `icons/${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);
        if (urlData?.publicUrl) updateData.icon_url = urlData.publicUrl;
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id);

    if (!error) {
      setMessage("保存しました！");
      loadData(user.id);
    } else if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
      setMessage("このユーザーIDは既に使われています");
    } else {
      setMessage(error.message || "保存に失敗しました");
    }
  };

  const sectionCard = (title: string, icon: string, children: React.ReactNode) => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <i className={`fas ${icon} text-primary text-sm w-4 text-center`} />
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      <div className="p-4 space-y-3">
        {children}
      </div>
    </div>
  );

  const sectionForm = (title: string, icon: string, onSubmit: (e: React.FormEvent) => Promise<void>, children: React.ReactNode) => (
    <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <i className={`fas ${icon} text-primary text-sm w-4 text-center`} />
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      <div className="p-4 space-y-3">
        {children}
      </div>
    </form>
  );

  if (!profile) return null;

  return (
    <AppShell unreadCount={unreadCount}>
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {message && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">{message}</div>
        )}

        {/* ① プロフィールカード（ヘッダー） */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
                {profile.icon_url ? (
                  <Image src={getOptimizedIconUrl(profile.icon_url, 168)} width={56} height={56} className="rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl">
                    {(profile.display_name || "?")[0]}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm truncate">{profile.display_name || "ユーザー"}</span>
                  <span className="text-xs text-gray-400 truncate">@{profile.username || "unknown"}</span>
                </div>
                <div className="flex gap-3 mt-0.5">
                  <Link href={`/profile/${encodeURIComponent(profile?.username || userIdRef.current)}/follow?tab=following`}
                    className="text-xs text-gray-500 hover:opacity-70 cursor-pointer no-underline">
                    <strong className="text-gray-800">{followingCount}</strong> フォロー
                  </Link>
                  <Link href={`/profile/${encodeURIComponent(profile?.username || userIdRef.current)}/follow?tab=followers`}
                    className="text-xs text-gray-500 hover:opacity-70 cursor-pointer no-underline">
                    <strong className="text-gray-800">{followersCount}</strong> フォロワー
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={toggleTheme}
                  className="text-sm w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 cursor-pointer border-none transition">
                  {theme === "dark" ? "☀️" : "🌙"}
                </button>
                <div className="text-center">
                  <p className="text-xl font-bold text-orange-500">{profile.exchange_points || 0}</p>
                  <p className="text-[9px] text-gray-400">pt</p>
                  <Link href="/shop"
                    className="text-[9px] text-primary hover:underline block">
                    交換所
                  </Link>
                </div>
              </div>
            </div>
            {profile.current_title_id && (() => {
              const equippedTitle = items.find((i: any) => i.id === profile.current_title_id);
              return equippedTitle ? (
                <div className="text-xs text-gray-600 ml-0.5">
                  <span className="text-gray-400">称号:</span> <span className="font-medium">{itemDisplayName(equippedTitle)}</span>
                </div>
              ) : null;
            })()}
          </div>

          {/* 投稿・いいねリンク */}
          {!editSection && (
            <div className="border-t border-gray-100 grid grid-cols-2">
              <button onClick={() => { setEditSection("posts"); loadMyPosts(); }}
                className="flex items-center justify-center gap-2 py-3 hover:bg-blue-50 transition cursor-pointer text-left border-r border-gray-100">
                <i className="far fa-file-alt text-blue-500 text-sm" />
                <span className="text-sm font-bold">自分の投稿</span>
              </button>
              <button onClick={() => { setEditSection("likes"); loadLikedPosts(); }}
                className="flex items-center justify-center gap-2 py-3 hover:bg-red-50 transition cursor-pointer text-left">
                <i className="far fa-heart text-red-500 text-sm" />
                <span className="text-sm font-bold">いいねした投稿</span>
              </button>
            </div>
          )}

          {/* 投稿コンテンツ */}
          {editSection === "posts" && (
            <div className="border-t border-gray-100 p-4 space-y-2">
              <button onClick={() => { setEditSection(null); setMyPosts([]); }}
                className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer mb-2">
                <i className="fas fa-arrow-left" /> 戻る
              </button>
              {myPostsError && <div className="bg-red-50 text-red-600 p-2 rounded-lg text-xs">{myPostsError}</div>}
              {myPostsLoading && (
                <div className="text-center py-4">
                  <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                </div>
              )}
              {!myPostsLoading && myPosts.length === 0 && !myPostsError && (
                <p className="text-xs text-gray-400 text-center py-3">まだ投稿がありません</p>
              )}
              {myPosts.slice(0, postPage * 10).map((post: any) => (
                <PostCard key={post.id} post={post} currentUserId={userIdRef.current || ""}
                  onDelete={(id) => setMyPosts((prev) => prev.filter((p: any) => p.id !== id))}
                  onUpdate={(id, data) => setMyPosts((prev: any[]) => prev.map((p: any) =>
                    p.id === id ? { ...p, ...data, display_study_time: formatStudyTime(data.study_minutes ?? p.study_minutes) } : p))} />
              ))}
              {myPosts.length > postPage * 10 && (
                <button onClick={() => setPostPage((p) => p + 1)}
                  className="w-full py-2 text-xs text-primary font-bold cursor-pointer hover:bg-gray-50 rounded-lg">
                  もっと見る
                </button>
              )}
            </div>
          )}
          {editSection === "likes" && (
            <div className="border-t border-gray-100 p-4 space-y-2">
              <button onClick={() => { setEditSection(null); setLikedPosts([]); }}
                className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer mb-2">
                <i className="fas fa-arrow-left" /> 戻る
              </button>
              {likedError && <div className="bg-red-50 text-red-600 p-2 rounded-lg text-xs">{likedError}</div>}
              {likedLoading && (
                <div className="text-center py-4">
                  <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                </div>
              )}
              {!likedLoading && likedPosts.length === 0 && !likedError && (
                <p className="text-xs text-gray-400 text-center py-3">いいねした投稿はありません</p>
              )}
              {likedPosts.slice(0, likedPage * 10).map((post: any) => (
                <PostCard key={post.id} post={post} currentUserId={userIdRef.current || ""}
                  onDelete={() => {}}
                  onUpdate={() => {}} />
              ))}
              {likedPosts.length > likedPage * 10 && (
                <button onClick={() => setLikedPage((p) => p + 1)}
                  className="w-full py-2 text-xs text-primary font-bold cursor-pointer hover:bg-gray-50 rounded-lg">
                  もっと見る
                </button>
              )}
            </div>
          )}
        </div>

        <FollowRecommendations userId={userId} />

        {/* ② プロフィール設定 */}
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
              <input type="file" name="icon" accept="image/*" className="text-xs mt-0.5" />
            </div>
            <button type="submit" className="w-full bg-primary text-white font-bold rounded-full py-1.5 text-sm cursor-pointer">
              保存
            </button>

            {/* 称号管理アコーディオン */}
            <div className="border-t border-gray-100 pt-3">
              <button type="button" onClick={() => {
                if (!inventoryOpen) loadInventory();
                setInventoryOpen(!inventoryOpen);
              }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition ${inventoryOpen ? 'bg-primary/10 border border-primary/20' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'}`}>
                <div className="flex items-center gap-2">
                  <i className={`fas fa-box ${inventoryOpen ? 'text-primary' : 'text-gray-400'} text-sm`} />
                  <span className={`text-sm font-bold ${inventoryOpen ? 'text-primary' : 'text-gray-700'}`}>称号管理</span>
                </div>
                <div className="flex items-center gap-2">
                  {titles.length > 0 && (
                    <span className="text-[10px] text-gray-400">{titles.length}個</span>
                  )}
                  <i className={`fas fa-chevron-${inventoryOpen ? "up" : "down"} text-gray-400 text-xs transition-transform`} />
                </div>
              </button>

              {inventoryOpen && (
                <div className="space-y-3 pt-2">
                  {/* 精錬 */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h3 className="text-xs font-bold mb-2">称号を精錬</h3>
                    <RefineParts parts={ownedParts()} onRefine={handleRefineParts} />
                  </div>

                  {/* 称号一覧 */}
                  <div className="space-y-1">
                    {(() => {
                      const sortTitles = (list: any[]) => [...list].sort((a: any, b: any) => (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0));
                      const refined = sortTitles(titles.filter((t: any) => isRefinedItem(t)));
                      const raw = sortTitles(titles.filter((t: any) => !isRefinedItem(t)));
                      const list = [...refined, ...raw];
                      if (!list.length) return <p className="text-xs text-gray-400">称号をまだ持っていません</p>;
                      return list.map((item: any) => {
                        const isEquipped = profile.current_title_id === item.id;
                        return (
                          <div key={item.id} className={`flex items-center justify-between py-1.5 px-2 rounded-lg ${isEquipped ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`title-badge ${item.rarity} flex-shrink-0`}>{item.rarity}</span>
                              <span className="text-xs truncate">{itemDisplayName(item)}</span>
                              {isRefinedItem(item) && <span className="text-[10px] text-gray-400 flex-shrink-0">精錬品</span>}
                            </div>
                            <button type="button" onClick={() => handleEquip(item.id, "current_title_id")}
                              className={`text-xs flex-shrink-0 px-3 py-1.5 rounded-full font-bold cursor-pointer transition ${isEquipped ? 'bg-primary text-white shadow-sm' : 'bg-white text-primary border border-primary hover:bg-primary hover:text-white'}`}>
                              {isEquipped ? "装備中" : "装備"}
                            </button>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
            </div>
          </>)
        }

        {sectionCard("学習目標", "fa-bullseye",
          <div className="grid grid-cols-2 gap-3">
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

      </div>
    </AppShell>
  );
}



