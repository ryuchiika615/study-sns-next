"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import AppShell from "@/components/AppShell";
import { SHOP_CATALOG, SELL_VALUES, BUY_COSTS, RARITY_ORDER, isIconItem, isRefinedItem, itemDisplayName } from "@/lib/shop-catalog";

const RARITIES = ["N", "R", "SR", "SSR", "UR", "LR"];

export default function EditProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [titles, setTitles] = useState<any[]>([]);
  const [icons, setIcons] = useState<any[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [department, setDepartment] = useState("");
  const [themeColor, setThemeColor] = useState("dark");
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
      supabase.from("profiles").select("id, display_name, bio, department, icon_url, theme_color, target_date, target_minutes, points, exchange_points, current_title_id, current_avatar_id").eq("id", uid).single(),
      supabase.from("user_items").select("*, item:item_id(*)").eq("user_id", uid),
      supabase.from("notifications").select("*", { count: "exact", head: true }).eq("recipient_id", uid).eq("is_read", false),
    ]);

    if (profileResult.data) {
      setProfile(profileResult.data);
      setDisplayName(profileResult.data.display_name || "");
      setBio(profileResult.data.bio || "");
      setDepartment(profileResult.data.department || "");
      setThemeColor(profileResult.data.theme_color || "dark");
      setTargetDate(profileResult.data.target_date || "");
      setTargetMinutes(String(profileResult.data.target_minutes || 0));
    }

    if (userItemsResult.data) {
      const items = userItemsResult.data.map((ui: any) => ui.item);
      setItems(items);
      setTitles(items.filter((i: any) => i.category === "title"));
      setIcons(items.filter((i: any) => i.category === "icon"));
    }

    setUnreadCount(notifResult.count || 0);

    const uid = userData.id;
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", uid),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", uid),
    ]);
    setFollowersCount(followers ?? 0);
    setFollowingCount(following ?? 0);

    const { data: likesData } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (likesData) {
      const postIds = likesData.map((l) => l.post_id);
      if (postIds.length > 0) {
        const { data: posts } = await supabase
          .from("posts")
          .select("*, profiles!inner(*)")
          .in("id", postIds)
          .order("created_at", { ascending: false });
        setLikedPosts(posts ?? []);
      } else {
        setLikedPosts([]);
      }
    }

    const { data: myPostsData } = await supabase
      .from("posts")
      .select("*, profiles!inner(*)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    setMyPosts(myPostsData ?? []);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updateData: Record<string, any> = {
      display_name: displayName,
      bio,
      department,
      theme_color: themeColor,
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
    }
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
      p_item_ids: itemIds.map(Number),
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

  const handleCombine = async (itemIdA: string, itemIdB: string, order: string) => {
    const { data, error } = await supabase.rpc("combine_items", {
      p_item_id_a: parseInt(itemIdA), p_item_id_b: parseInt(itemIdB), p_order: order,
    });
    if (!error && data) {
      setMessage("精錬しました！");
      loadData();
    } else {
      setMessage(error?.message || "精錬に失敗しました");
    }
  };

  const handleRefineParts = async (word: string, noun: string, namePart: string, order: string) => {
    const { data, error } = await supabase.rpc("refine_parts", {
      p_word: word, p_noun: noun, p_name_part: namePart, p_order: order,
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

  if (!profile) return null;

  const canSell = (item: any) => {
    if (isRefinedItem(item)) return false;
    if (item.id === profile.current_title_id) return false;
    if (item.id === profile.current_avatar_id) return false;
    return true;
  };

  const ownedParts = () => {
    const displayNames = titles.map((t: any) => itemDisplayName(t));
    const words = [...new Set(displayNames.filter((n: string) => WORDS_LIST.includes(n)))];
    const nouns = [...new Set(displayNames.filter((n: string) => NOUNS_LIST.includes(n)))];
    const names = [...new Set(displayNames.filter((n: string) => NAMES_LIST.includes(n)))];
    return { words, nouns, names };
  };
  const parts = ownedParts();

  return (
    <AppShell unreadCount={unreadCount}>
      <div className="p-4 max-w-2xl mx-auto space-y-6">
        {message && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">{message}</div>
        )}

        {/* プロフィール編集 */}
        <form onSubmit={handleUpdateProfile} className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <h2 className="text-lg font-bold">プロフィール設定</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">表示名</label>
            <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">自己紹介</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300}
              className="w-full rounded-lg border-gray-300 text-sm" rows={3} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">部署</label>
            <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">テーマカラー</label>
            <input type="text" value={themeColor} onChange={(e) => setThemeColor(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目標日</label>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目標時間(分)</label>
              <input type="number" value={targetMinutes} onChange={(e) => setTargetMinutes(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm" min={0} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">アイコン画像</label>
            <input type="file" name="icon" accept="image/*" className="text-sm" />
          </div>

          <button type="submit" className="bg-primary text-white font-bold rounded-full px-6 py-2 text-sm">
            保存
          </button>
        </form>

        {/* パスワード変更 */}
        <form onSubmit={handleChangePassword} className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <h2 className="text-lg font-bold">パスワード変更</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm" minLength={6} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード（確認）</label>
            <input type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm" minLength={6} required />
          </div>
          <button type="submit" disabled={passwordChanging}
            className="bg-gray-800 text-white font-bold rounded-full px-6 py-2 text-sm disabled:opacity-50">
            パスワードを変更
          </button>
        </form>

        {/* ポイント表示 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-3xl font-bold text-primary">{profile.points}</p>
            <p className="text-xs text-gray-500">勉強ポイント</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <p className="text-3xl font-bold text-orange-500">{profile.exchange_points || 0}</p>
            <p className="text-xs text-gray-500">交換ポイント</p>
          </div>
        </div>

        {/* 現在のアバター & フォロワー情報 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
          <h2 className="text-lg font-bold">プロフィール情報</h2>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
              {profile.icon_url ? (
                <img src={profile.icon_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-2xl">
                  {(profile.display_name || "?")[0]}
                </div>
              )}
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{followingCount}</p>
                <p className="text-xs text-gray-500">フォロー</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{followersCount}</p>
                <p className="text-xs text-gray-500">フォロワー</p>
              </div>
            </div>
          </div>
          {/* 現在装備中の称号 */}
          {profile.current_title_id && (() => {
            const equippedTitle = items.find((i: any) => i.id === profile.current_title_id);
            return equippedTitle ? (
              <div className="text-sm text-gray-600">
                称号: <span className="font-medium">{itemDisplayName(equippedTitle)}</span>
              </div>
            ) : null;
          })()}
        </div>

        {/* 自分の投稿 / いいねした投稿 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex gap-2 border-b border-gray-200 pb-2">
            <button onClick={() => setProfileTab("posts")}
              className={`text-sm font-medium px-3 py-1 rounded-full ${profileTab === "posts" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}>
              自分の投稿 ({myPosts.length})
            </button>
            <button onClick={() => setProfileTab("likes")}
              className={`text-sm font-medium px-3 py-1 rounded-full ${profileTab === "likes" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}>
              いいねした投稿 ({likedPosts.length})
            </button>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {(profileTab === "posts" ? myPosts : likedPosts).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                {profileTab === "posts" ? "まだ投稿がありません" : "いいねした投稿はありません"}
              </p>
            )}
            {(profileTab === "posts" ? myPosts : likedPosts).slice(0, 20).map((post: any) => (
              <div key={post.id} className="border border-gray-100 rounded-lg p-3 text-sm hover:bg-gray-50 cursor-pointer"
                onClick={() => router.push(`/post/${post.id}`)}>
                <p className="line-clamp-2">{post.content}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(post.created_at).toLocaleDateString("ja-JP")}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 交換ショップ */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-bold mb-1">交換ショップ</h2>
          <p className="text-xs text-gray-500 mb-3">売却で得た交換ptで称号やアイコンフレームを購入できます</p>
          {RARITIES.map((rarity) => (
            <div key={rarity} className="mb-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0 last:mb-0">
              <div className="flex items-center justify-between mb-2">
                <span className={`title-badge ${rarity}`}>{rarity}</span>
                <span className="text-sm text-gray-500">購入 {BUY_COSTS[rarity]}pt / 売却 {SELL_VALUES[rarity]}pt</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <select id={`shop-title-${rarity}`} className="w-full rounded-lg border-gray-300 text-xs p-1.5">
                    {SHOP_CATALOG.title[rarity].map((name: string) => (
                      <option key={name} value={name}>{name}</option>
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
                      <option key={name} value={name}>{name.replace("【アイコン】", "")}</option>
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
          ))}
        </div>

        {/* 称号を精錬（合成） */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-bold mb-3">称号を精錬（合成）</h2>
          <p className="text-xs text-gray-500 mb-3">所持している称号を組み合わせて新しい称号を作ります</p>
          <CombineTitles titles={titles} onCombine={handleCombine} />
        </div>

        {/* 称号を精錬（部位組み合わせ） */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-bold mb-3">称号を精錬（部位組み合わせ）</h2>
          <p className="text-xs text-gray-500 mb-3">フレーズ・名詞・人物名を組み合わせて精錬します</p>
          <RefineParts parts={parts} onRefine={handleRefineParts} />
        </div>

        {/* 一括売却 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-bold mb-3">一括売却</h2>
          <p className="text-xs text-gray-500 mb-3">装備中と精錬称号は売却されません</p>
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
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-bold mb-3">所持称号</h2>
          <div className="grid grid-cols-2 gap-2">
            {titles.map((item: any) => {
              const isEquipped = profile.current_title_id === item.id;
              const sellable = canSell(item);
              return (
                <div key={item.id} className={`p-2 rounded-lg border text-sm ${isEquipped ? 'border-primary bg-blue-50' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
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
                        売却
                      </label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {selectedSell.size > 0 && (
            <button onClick={() => handleSell(Array.from(selectedSell))}
              className="mt-3 w-full bg-red-500 text-white rounded-full py-2 text-sm font-medium">
              選択した{selectedSell.size}個を売却 (+{Array.from(selectedSell).reduce((sum, id) => {
                const item = items.find((i: any) => i.id === id);
                return sum + (SELL_VALUES[item?.rarity] || 0);
              }, 0)}pt)
            </button>
          )}
        </div>

        {/* アバター一覧 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-bold mb-3">所持アバター</h2>
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

function CombineTitles({ titles, onCombine }: { titles: any[]; onCombine: (a: string, b: string, order: string) => void }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [order, setOrder] = useState("normal");
  const normalTitles = titles.filter((t: any) => !t.name.startsWith("精錬:") && !t.name.startsWith("邊ｾ骭ｬ:"));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select value={a} onChange={(e) => setA(e.target.value)} className="rounded-lg border-gray-300 text-xs p-1.5">
          <option value="">称号1を選択</option>
          {normalTitles.map((t: any) => (
            <option key={t.id} value={t.id}>{itemDisplayName(t)} ({t.rarity})</option>
          ))}
        </select>
        <select value={b} onChange={(e) => setB(e.target.value)} className="rounded-lg border-gray-300 text-xs p-1.5">
          <option value="">称号2を選択</option>
          {normalTitles.map((t: any) => (
            <option key={t.id} value={t.id}>{itemDisplayName(t)} ({t.rarity})</option>
          ))}
        </select>
      </div>
      <select value={order} onChange={(e) => setOrder(e.target.value)} className="rounded-lg border-gray-300 text-xs p-1.5 w-full">
        <option value="normal">称号1 + 称号2</option>
        <option value="reverse">称号2 + 称号1</option>
      </select>
      <button onClick={() => a && b && onCombine(a, b, order)}
        disabled={!a || !b}
        className="w-full bg-gray-800 text-white rounded-full py-2 text-xs disabled:opacity-40">
        精錬する
      </button>
    </div>
  );
}

function RefineParts({ parts, onRefine }: { parts: { words: string[]; nouns: string[]; names: string[] }; onRefine: (w: string, n: string, name: string, order: string) => void }) {
  const [word, setWord] = useState("");
  const [noun, setNoun] = useState("");
  const [namePart, setNamePart] = useState("");
  const [order, setOrder] = useState("word_first");

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <select value={word} onChange={(e) => setWord(e.target.value)} className="rounded-lg border-gray-300 text-xs p-1.5">
          <option value="">フレーズなし</option>
          {parts.words.map((w: string) => <option key={w} value={w}>{w}</option>)}
        </select>
        <select value={noun} onChange={(e) => setNoun(e.target.value)} className="rounded-lg border-gray-300 text-xs p-1.5">
          <option value="">名詞なし</option>
          {parts.nouns.map((n: string) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={namePart} onChange={(e) => setNamePart(e.target.value)} className="rounded-lg border-gray-300 text-xs p-1.5">
          <option value="">人物名なし</option>
          {parts.names.map((n: string) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <select value={order} onChange={(e) => setOrder(e.target.value)} className="rounded-lg border-gray-300 text-xs p-1.5 w-full">
        <option value="word_first">フレーズ + 名詞 + 人物名</option>
        <option value="name_first">人物名 + フレーズ + 名詞</option>
        <option value="noun_first">名詞 + フレーズ + 人物名</option>
      </select>
      <button onClick={() => onRefine(word, noun, namePart, order)}
        disabled={!word && !noun && !namePart}
        className="w-full bg-gray-800 text-white rounded-full py-2 text-xs disabled:opacity-40">
        精錬する
      </button>
    </div>
  );
}

const WORDS_LIST = [
  "レポート未提出の", "単位を落とせし", "再履修のプロ", "課題に追われる",
  "電機大の良心", "北千住の支配者", "数学で詰んだ", "過去問を渇望する",
  "試験前日に徹夜する", "フル単の奇跡", "出席日数ギリギリの", "教授に目をつけられし",
  "研究室に引きこもる", "学食のカレーを愛する", "3号館で迷子になった",
  "線形代数で爆死した", "プログラミング課題を丸写しする", "意識だけは高い留年候補",
  "通学路がほぼ旅", "プレデターになれない", "万年ブロンズの", "クソエイムを極めし",
  "ウルトを無駄打ちする", "スプラで煽られる", "常にデスしている", "キャリーされ待ちの",
  "味方にブチギレる", "ガチホコを逆走する", "マイクラで全ロスした", "マリオメーカーで沼る",
  "回線落ちの帝王", "伝説の戦犯", "プレイヤースキル最底辺の", "ワンオペで崩壊する",
  "労働の奴隷", "残業代が出ない", "バイトリーダーを気取る", "レジ締めが合わない",
  "クレーマーを引き寄せる", "給料日前に干からびる", "貯金残高3桁の", "100円ローソン通いの",
  "もやし生活の", "奢られ待ちの天才", "財布を家に忘れる",
  "常に金ないが口癖の", "借金まみれの", "経済力皆無の", "Twitterに生息する",
  "ネット弁慶の", "匿名でしかイキれない", "いいねを渇望する", "炎上寸前の",
  "リプ欄でレスバする", "黒歴史を量産せし", "厨二病を拗らせた", "右手が疼く",
  "邪気眼の使い手", "闇の組織に追われる", "限界オタクの", "推しに全財産を貢ぐ",
  "液晶画面に恋する", "1日20時間画面を見る", "自称インフルエンサーの", "バズる幻覚を見る",
  "存在が放送事故の", "息をするだけで面白い", "絶望的に服のセンスがない", "常に寝不足の",
  "偏食の極み", "エナジードリンク中毒の", "三日坊主のエース", "言い訳の達人",
  "責任転嫁のプロ", "プライドだけはエベレストな",
  "口だけは達者な", "行動力を失いし", "部屋がゴミ屋敷の", "忘れ物の神様",
  "信頼残高マイナスの", "陽キャのフリをした", "LINEの返信が遅すぎる", "既読無視の常習犯",
  "嫉妬の化身", "すぐ病む", "メンヘラの極み", "恋愛初心者以下の", "独占欲の塊",
  "記念日を忘れる", "愛が重すぎる", "朝起きられない", "布団から出られない",
  "2度寝のファンタジスタ", "遅刻の常連", "時間を守る気がない", "常にギリギリを生きる",
  "奇跡待ちの", "就活を現実逃避する", "面接で頭が真っ白になる", "お祈りメールのコレクター",
  "自己分析で絶望する", "実家でイキる", "家族のパシリ", "親の脛を齧り尽くす",
  "ペーパードライバーの", "常に裏コードを入力している", "魔導書を枕にする",
  "混沌のオーラを纏う", "封印されし左手が暴れる", "黙示録の予言者", "終末を告げるもの",
  "神の加護を失いし", "令和の怪物", "世紀の大悪党", "希代の詐欺師", "期待の新人（仮）",
  "自称・天才エンジニア", "世界を救いそうにない勇者", "魔王のパシリ", "ただの一般人A",
  "西村店長に怒られし", "チームラボで迷子になった", "息をするようにスベる", "深夜テンションの",
  "松戸市代表", "カリフォルニア帰りの", "3浪の", "1留の", "留年確定の", "バ畜戦士",
  "月給24万", "金欠の", "課金沼に沈みし", "花菜を奪いし者", "令和の奇行種",
  "脳内お花畑の", "意識高い系", "圧倒的モブ", "メンヘラ製造機", "前世がティッシュ",
  "夢はマイクワゾウスキー", "みかんから生まれし", "桃から生まれし", "韓国のり顔の",
];

const NOUNS_LIST = [
  "支配者", "プロ", "帝王", "奇跡", "良心", "戦士", "候補", "常習犯", "コレクター", "使い手",
  "観測者", "勇者", "パシリ", "一般人A", "天才", "怪物", "大悪党", "詐欺師",
  "落ちこぼれ", "ファンタジスタ", "エース", "達人", "神様", "化身", "塊", "奴隷",
  "リーダー", "モブ", "奇行種", "放送事故", "留年候補", "戦犯", "ブロンズ", "インフルエンサー",
];

const NAMES_LIST = [
  "ゆいちゃん", "たいき", "あつき", "みおちゃん", "すばる",
  "ゆっきー", "さよちゃん", "しゅり", "りゅう", "みな",
  "そら", "はる", "れん", "あお", "なぎ",
];
