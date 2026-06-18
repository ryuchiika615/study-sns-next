"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import { formatStudyTime, getOptimizedIconUrl } from "@/lib/utils";
import { SHOP_CATALOG, SELL_VALUES, BUY_COSTS, RARITY_ORDER, isIconItem, isRefinedItem, itemDisplayName } from "@/lib/shop-catalog";

const RARITIES = ["N", "R", "SR", "SSR", "UR", "LR"];

export default function EditProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [titles, setTitles] = useState<any[]>([]);
  const [icons, setIcons] = useState<any[]>([]);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [targetMinutes, setTargetMinutes] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [message, setMessage] = useState("");
  const [selectedSell, setSelectedSell] = useState<Set<string>>(new Set());
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [profileTab, setProfileTab] = useState<"posts" | "likes">("posts");
  const [postPage, setPostPage] = useState(1);
  const [likedPage, setLikedPage] = useState(1);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [quietHoursStart, setQuietHoursStart] = useState("");
  const [quietHoursEnd, setQuietHoursEnd] = useState("");
  const [dailySummary, setDailySummary] = useState(true);
  const router = useRouter();
  const supabase = createClient();
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      userIdRef.current = data.user.id;
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
      setTitles(items.filter((i: any) => i.category === "title"));
      setIcons(items.filter((i: any) => i.category === "icon"));
      setFavoriteIds(new Set(userItemsResult.data.filter((ui: any) => ui.is_favorite).map((ui: any) => ui.item_id)));
    }

    setUnreadCount(notifResult.count || 0);

    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", uid),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", uid),
    ]);
    setFollowersCount(followers ?? 0);
    setFollowingCount(following ?? 0);

    const { data: likesData } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", uid);
    if (likesData) {
      const postIds = likesData.map((l) => l.post_id);
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
    }

    const { data: myPostsData } = await supabase
      .from("posts")
      .select("*, user:user_id(id, display_name, username, icon_url)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setMyPosts(myPostsData ?? []);

    const { data: notifSettings } = await supabase
      .from("notification_settings")
      .select("quiet_hours_start, quiet_hours_end, daily_summary")
      .eq("user_id", uid)
      .maybeSingle();
    if (notifSettings) {
      setQuietHoursStart(notifSettings.quiet_hours_start || "");
      setQuietHoursEnd(notifSettings.quiet_hours_end || "");
      setDailySummary(notifSettings.daily_summary ?? true);
    }
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

    await fetch("/api/notification-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quiet_hours_start: quietHoursStart || null, quiet_hours_end: quietHoursEnd || null, daily_summary: dailySummary }),
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      setMessage("パスワードが一致しません");
      return;
    }
    if (newPassword.length < 6) {
      setMessage("パスワードは6文字以上で入力してください");
      return;
    }
    setPasswordChanging(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordChanging(false);
    if (error) {
      setMessage(`パスワード変更失敗: ${error.message}`);
    } else {
      setMessage("パスワードを変更しました！");
      setNewPassword("");
      setNewPasswordConfirm("");
    }
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
      await supabase
        .from("profiles")
        .update({ [slot]: itemId })
        .eq("id", user.id);
      loadData(user.id);
    }
  };

  const handleBuy = async (rarity: string, itemType: string, itemName: string) => {
    const { data, error } = await supabase.rpc("buy_item", {
      p_rarity: rarity, p_item_type: itemType, p_item_name: itemName,
    });
    if (!error && data) {
      setMessage(`${itemName} を交換しました！`);
      loadData();
    } else {
      setMessage(error?.message || "交換に失敗しました");
    }
  };

  const handleSell = async (itemIds: string[]) => {
    const { data, error } = await supabase.rpc("sell_items", {
      p_item_ids: itemIds,
    });
    if (!error && data) {
      setMessage("売却しました！");
      setSelectedSell(new Set());
      loadData();
    }
  };

  const handleBulkSell = async (maxRarity: string) => {
    const { data, error } = await supabase.rpc("sell_items", {
      p_item_ids: [], p_max_rarity: maxRarity,
    });
    if (!error && data) {
      setMessage("売却しました！");
      loadData();
    }
  };

  const handleRefineParts = async (word: string, noun: string, namePart: string, order: string, connA?: string, connB?: string) => {
    const { data, error } = await supabase.rpc("refine_parts", {
      p_word: word, p_noun: noun, p_name_part: namePart, p_order: order,
      p_conn_a: connA || '', p_conn_b: connB || '',
    });
    if (!error && data) {
      setMessage("精錬しました！");
      loadData();
    } else {
      setMessage(error?.message || "精錬に失敗しました");
    }
  };

  const toggleSellItem = (id: string) => {
    setSelectedSell((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleFavorite = async (itemId: string) => {
    const isFav = favoriteIds.has(itemId);
    const { error } = await supabase
      .from("user_items")
      .update({ is_favorite: !isFav })
      .eq("user_id", userIdRef.current)
      .eq("item_id", itemId);
    if (!error) {
      const next = new Set(favoriteIds);
      if (isFav) next.delete(itemId); else next.add(itemId);
      setFavoriteIds(next);
    }
  };

  const sortTitles = (list: any[]) => {
    return [...list].sort((a, b) => {
      const aFav = favoriteIds.has(a.id) ? 0 : 1;
      const bFav = favoriteIds.has(b.id) ? 0 : 1;
      if (aFav !== bFav) return aFav - bFav;
      return (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0);
    });
  };

  const refinedTitles = sortTitles(titles.filter((t: any) => isRefinedItem(t)));
  const rawTitles = sortTitles(titles.filter((t: any) => !isRefinedItem(t)));

  const titleCard = (item: any) => {
    const isEquipped = profile.current_title_id === item.id;
    const sellable = canSell(item);
    const isFav = favoriteIds.has(item.id);
    return (
      <div key={item.id} className={`relative p-2 rounded-lg border text-sm ${isEquipped ? 'border-primary bg-blue-50' : 'border-gray-200'} ${isFav ? 'ring-2 ring-yellow-400' : ''}`}>
        <button onClick={() => handleToggleFavorite(item.id)}
          className="absolute top-1 right-1 text-base cursor-pointer bg-transparent border-none p-0 leading-none z-10">
          {isFav ? '❤️' : '🤍'}
        </button>
        <div className="flex items-center justify-between pr-5">
          <span className={`title-badge ${item.rarity} text-xs`}>{item.rarity}</span>
          {isRefinedItem(item) && <span className="text-xs text-gray-400">精錬品</span>}
        </div>
        <span className="ml-1 text-sm">{itemDisplayName(item)}</span>
        <div className="flex gap-1 mt-1">
          <button onClick={() => handleEquip(item.id, "current_title_id")}
            className="flex-1 text-xs text-primary hover:underline py-0.5">
            {isEquipped ? "装備中" : "装備"}
          </button>
           {sellable && (
             <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
               <input type="checkbox" checked={selectedSell.has(item.id)}
                 onChange={() => toggleSellItem(item.id)} />
               {isRefinedItem(item) ? "捨てる" : "売却"}
             </label>
           )}
         </div>
       </div>
    );
  };

  if (!profile) return null;

  const canSell = (item: any) => {
    if (item.id === profile.current_title_id) return false;
    if (item.id === profile.current_avatar_id) return false;
    return true;
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
  const parts = ownedParts();

  return (
    <AppShell unreadCount={unreadCount}>
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {message && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">{message}</div>
        )}

        {/* プロフィール情報 */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
          <div className="flex items-center gap-3">
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

        {/* 自分の投稿 / いいねした投稿 */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
          <div className="flex gap-1 border-b border-gray-100 pb-2">
            <button onClick={() => { setProfileTab("posts"); setPostPage(1); }}
              className={`text-xs font-medium px-3 py-1 rounded-full cursor-pointer transition ${profileTab === "posts" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}>
              自分の投稿 ({myPosts.length})
            </button>
            <button onClick={() => { setProfileTab("likes"); setLikedPage(1); }}
              className={`text-xs font-medium px-3 py-1 rounded-full cursor-pointer transition ${profileTab === "likes" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}>
              いいねした投稿 ({likedPosts.length})
            </button>
          </div>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {(profileTab === "posts" ? myPosts : likedPosts).length === 0 && (
              <p className="text-xs text-gray-400 text-center py-3">
                {profileTab === "posts" ? "まだ投稿がありません" : "いいねした投稿はありません"}
              </p>
            )}
            {(profileTab === "posts" ? myPosts : likedPosts).slice(0, (profileTab === "posts" ? postPage : likedPage) * 10).map((post: any) => (
              <PostCard key={post.id} post={post} currentUserId={userIdRef.current || ""}
                onDelete={(id) => {
                  setMyPosts((prev) => prev.filter((p: any) => p.id !== id));
                  setLikedPosts((prev) => prev.filter((p: any) => p.id !== id));
                }}
                onUpdate={(id, data) => {
                  setMyPosts((prev: any[]) => prev.map((p: any) =>
                    p.id === id ? { ...p, ...data, display_study_time: formatStudyTime(data.study_minutes ?? p.study_minutes) } : p));
                  setLikedPosts((prev: any[]) => prev.map((p: any) =>
                    p.id === id ? { ...p, ...data } : p));
                }} />
            ))}
            {profileTab === "posts" && myPosts.length > postPage * 10 && (
              <button onClick={() => setPostPage((p) => p + 1)}
                className="w-full py-1.5 text-xs text-primary font-bold cursor-pointer hover:bg-gray-50 rounded-lg">
                もっと見る
              </button>
            )}
            {profileTab === "likes" && likedPosts.length > likedPage * 10 && (
              <button onClick={() => setLikedPage((p) => p + 1)}
                className="w-full py-1.5 text-xs text-primary font-bold cursor-pointer hover:bg-gray-50 rounded-lg">
                もっと見る
              </button>
            )}
          </div>
        </div>

        {/* プロフィール設定 */}
        <form onSubmit={handleUpdateProfile} className="bg-white rounded-xl border border-gray-200 p-3 space-y-2.5">
          <h2 className="text-sm font-bold">プロフィール設定</h2>

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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700">目標日</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">目標時間(分)</label>
              <input type="number" value={targetMinutes} onChange={(e) => setTargetMinutes(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" min={0} />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-2 space-y-2">
            <p className="text-xs font-medium text-gray-700">通知設定</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500">静音開始</label>
                <input type="time" value={quietHoursStart} onChange={(e) => setQuietHoursStart(e.target.value)}
                  className="w-full rounded-lg border-gray-300 text-xs py-1 mt-0.5" />
              </div>
              <div>
                <label className="block text-xs text-gray-500">静音終了</label>
                <input type="time" value={quietHoursEnd} onChange={(e) => setQuietHoursEnd(e.target.value)}
                  className="w-full rounded-lg border-gray-300 text-xs py-1 mt-0.5" />
              </div>
            </div>
            <p className="text-[10px] text-gray-400">設定した時間帯はプッシュ通知が送信されなくなります</p>
            <label className="flex items-center justify-between text-xs cursor-pointer py-0.5">
              <span>デイリーまとめ通知</span>
              <input type="checkbox" checked={dailySummary} onChange={(e) => setDailySummary(e.target.checked)}
                className="cursor-pointer" />
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">アイコン画像</label>
            <input type="file" name="icon" accept="image/*" className="text-xs mt-0.5" />
          </div>

          <button type="submit" className="w-full bg-primary text-white font-bold rounded-full py-1.5 text-sm cursor-pointer">
            保存
          </button>
        </form>

        {/* パスワード変更 */}
        <form onSubmit={handleChangePassword} className="bg-white rounded-xl border border-gray-200 p-3 space-y-2.5">
          <h2 className="text-sm font-bold">パスワード変更</h2>
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
          <button type="submit" disabled={passwordChanging}
            className="w-full bg-gray-800 text-white font-bold rounded-full py-1.5 text-sm disabled:opacity-50 cursor-pointer">
            パスワードを変更
          </button>
        </form>

        {/* ポイント表示 */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-orange-500">{profile.exchange_points || 0}</p>
          <p className="text-[10px] text-gray-500">ポイント</p>
        </div>

        {/* 交換ショップ */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <h2 className="text-sm font-bold mb-1">交換ショップ</h2>
          <p className="text-[10px] text-gray-500 mb-2">売却で得た交換ptで称号やアイコンフレームを購入できます</p>
          {(() => {
            const ownedTitles = new Set(titles.map((t: any) => t.name));
            const ownedIcons = new Set(icons.map((i: any) => i.name));
            return RARITIES.map((rarity) => (
              <div key={rarity} className="mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                  <span className={`title-badge ${rarity}`}>{rarity}</span>
                  <span className="text-sm text-gray-500">購入 {BUY_COSTS[rarity]}pt / 売却 {SELL_VALUES[rarity]}pt</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <select id={`shop-title-${rarity}`} className="w-full rounded-lg border-gray-300 text-xs p-1.5">
                      {SHOP_CATALOG.title[rarity].map((name: string) => (
                        <option key={name} value={name} disabled={ownedTitles.has(name)}>
                          {name}{ownedTitles.has(name) ? " （取得済み）" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const select = document.getElementById(`shop-title-${rarity}`) as HTMLSelectElement;
                        handleBuy(rarity, "title", select.value);
                      }}
                      disabled={(profile.exchange_points || 0) < BUY_COSTS[rarity]}
                      className="w-full mt-1 text-xs bg-primary text-white rounded-full py-1.5 disabled:opacity-40"
                    >
                      称号を交換
                    </button>
                  </div>
                  <div>
                    <select id={`shop-icon-${rarity}`} className="w-full rounded-lg border-gray-300 text-xs p-1.5">
                      {SHOP_CATALOG.icon[rarity].map((name: string) => (
                        <option key={name} value={name} disabled={ownedIcons.has(name)}>
                          {name.replace("【アイコン】", "")}{ownedIcons.has(name) ? " （取得済み）" : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const select = document.getElementById(`shop-icon-${rarity}`) as HTMLSelectElement;
                        handleBuy(rarity, "icon", select.value);
                      }}
                      disabled={(profile.exchange_points || 0) < BUY_COSTS[rarity]}
                      className="w-full mt-1 text-xs bg-orange-500 text-white rounded-full py-1.5 disabled:opacity-40"
                    >
                      アイコンを交換
                    </button>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>

        {/* 称号を精錬（部位組み合わせ） */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <h2 className="text-sm font-bold mb-2">称号を精錬（部位組み合わせ）</h2>
          <RefineParts parts={parts} onRefine={handleRefineParts} />
        </div>

        {/* 一括売却 */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <h2 className="text-sm font-bold mb-2">一括売却</h2>
          <p className="text-[10px] text-gray-500 mb-2">装備中は売却できません（精錬品は0ptで捨てられます）</p>
          <div className="flex gap-2">
            {["N", "R", "SR"].map((rarity) => (
              <button key={rarity} onClick={() => handleBulkSell(rarity)}
                className="flex-1 bg-red-50 text-red-600 border border-red-200 rounded-lg py-2 text-xs font-medium hover:bg-red-100">
                {rarity}以下を売却
              </button>
            ))}
          </div>
        </div>

        {/* 称号一覧 */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <h2 className="text-sm font-bold mb-2">所持称号 ({titles.length})</h2>

          {refinedTitles.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-1.5">精錬品称号 ({refinedTitles.length})</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {refinedTitles.map((item: any) => titleCard(item))}
              </div>
            </>
          )}

          {rawTitles.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-1.5">通常称号 ({rawTitles.length})</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {rawTitles.map((item: any) => titleCard(item))}
              </div>
            </>
          )}

          {selectedSell.size > 0 && (
            <button onClick={() => handleSell(Array.from(selectedSell))}
              className="mt-3 w-full bg-red-500 text-white rounded-full py-2 text-sm font-medium">
              選択した{selectedSell.size}個を売却 (+{Array.from(selectedSell).reduce((sum, id) => {
                const item = items.find((i: any) => i.id === id);
                if (!item) return sum;
                if (isRefinedItem(item)) return sum;
                return sum + (SELL_VALUES[item?.rarity] || 0);
              }, 0)}pt)
            </button>
          )}
        </div>

          {/* アバター一覧 */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <h2 className="text-sm font-bold mb-2">所持アバター</h2>
           <div className="grid grid-cols-2 gap-2">
             {icons.map((item: any) => {
               const isEquipped = profile.current_avatar_id === item.id;
               const sellable = canSell(item);
               return (
                 <div key={item.id} className={`p-2 rounded-lg border text-sm ${isEquipped ? 'border-primary bg-blue-50' : 'border-gray-200'}`}>
                   <span className={`title-badge ${item.rarity} text-xs`}>{item.rarity}</span>
                   <span className="ml-1">{itemDisplayName(item).replace("【アイコン】", "")}</span>
                   <div className="flex gap-1 mt-1">
                     <button onClick={() => handleEquip(item.id, "current_avatar_id")}
                       className="flex-1 text-xs text-primary hover:underline py-0.5">
                       {isEquipped ? "装備中" : "装備"}
                     </button>
                     {sellable && (
                       <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                         <input type="checkbox" checked={selectedSell.has(item.id)}
                           onChange={() => toggleSellItem(item.id)} />
                         売却
                       </label>
                     )}
                   </div>
                 </div>
               );
             })}
           </div>
         </div>

      </div>
    </AppShell>
  );
}

const CONNECTORS = ["", "の", "と", "や", "とか", "を", "が", "で", "に", "な", "も", "へ", "から", "より"];

function ConnectorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border-gray-300 text-xs p-1.5 w-full text-center">
      {CONNECTORS.map((c) => (
        <option key={c} value={c}>{c || "−"}</option>
      ))}
    </select>
  );
}

function RefineParts({ parts, onRefine }: { parts: string[]; onRefine: (w: string, n: string, name: string, order: string, connA?: string, connB?: string) => void }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");
  const [connA, setConnA] = useState("");
  const [connB, setConnB] = useState("");

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-500">所持称号の文字を自由に選んで組み合わせられます。接続語でつなげることも可能</p>
      <div className="grid grid-cols-3 gap-2">
        <select value={a} onChange={(e) => setA(e.target.value)} className="rounded-lg border-gray-300 text-xs p-1.5">
          <option value="">パート1</option>
          {parts.map((p: string) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={b} onChange={(e) => setB(e.target.value)} className="rounded-lg border-gray-300 text-xs p-1.5">
          <option value="">パート2</option>
          {parts.map((p: string) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={c} onChange={(e) => setC(e.target.value)} className="rounded-lg border-gray-300 text-xs p-1.5">
          <option value="">パート3</option>
          {parts.map((p: string) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 min-w-[3rem] text-center truncate">{a || "(1)"}</span>
        <ConnectorSelect value={connA} onChange={setConnA} />
        <span className="text-xs text-gray-500 min-w-[3rem] text-center truncate">{b || "(2)"}</span>
        <ConnectorSelect value={connB} onChange={setConnB} />
        <span className="text-xs text-gray-500 min-w-[3rem] text-center truncate">{c || "(3)"}</span>
      </div>
      <button onClick={() => onRefine(a, b, c, "word_first", connA, connB)}
        disabled={!a && !b && !c}
        className="w-full bg-gray-800 text-white rounded-full py-2 text-xs disabled:opacity-40">
        精錬する
      </button>
    </div>
  );
}

