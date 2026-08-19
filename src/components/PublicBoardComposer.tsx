"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { compressImage, getUploadValidationError } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";

const categories = ["グループ募集", "勉強仲間募集", "質問", "情報共有", "雑談", "その他"];
type OwnedGroup = { id: string; name: string; visibility: "private" | "public" };

export default function PublicBoardComposer({ userId }: { userId: string }) {
  const supabase = createClient();
  const addToast = useToast();
  const [category, setCategory] = useState(categories[0]);
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [groups, setGroups] = useState<OwnedGroup[]>([]);
  const [groupId, setGroupId] = useState("");

  useEffect(() => {
    supabase.from("study_groups").select("id, name, visibility").eq("owner_id", userId).order("created_at", { ascending: false })
      .then(({ data }) => setGroups((data || []) as OwnedGroup[]));
  }, [userId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim() || submitting) return;
    if (category === "グループ募集" && !groupId) { addToast({ message: "募集するグループを選んでください", type: "error" }); return; }
    setSubmitting(true);
    let imageUrl: string | null = null;
    try {
      if (image) {
        const validation = getUploadValidationError(image, "image");
        if (validation) throw new Error(validation);
        const blob = await compressImage(image).catch(() => image);
        const path = `board/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error: uploadError } = await supabase.storage.from("post-images").upload(path, blob);
        if (uploadError) throw uploadError;
        imageUrl = supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl;
      }
      const { data: createdPost, error } = await supabase.rpc("create_post", {
        p_content: content.trim(), p_subject: category, p_study_minutes: 0, p_workout_minutes: 0,
        p_image_url: imageUrl, p_image_urls: imageUrl ? [imageUrl] : null, p_study_date: null,
        p_quote_post_id: null, p_quote_comment_id: null, p_silent: false, p_audio_url: null,
        p_audio_name: null, p_pages_completed: 0, p_total_pages: 0,
      });
      if (error) throw error;
      if (category === "グループ募集") {
        const postId = Array.isArray(createdPost) ? createdPost[0]?.post_id : createdPost?.post_id;
        const { error: linkError } = await supabase.rpc("attach_group_recruitment", { p_post_id: postId, p_group_id: groupId });
        if (linkError) throw linkError;
      }
      setContent(""); setImage(null); setGroupId("");
      addToast({ message: "公開掲示板に投稿しました", type: "info" });
      window.dispatchEvent(new CustomEvent("post-created"));
      window.location.reload();
    } catch (error: any) {
      addToast({ message: error.message || "投稿できませんでした", type: "error" });
    } finally { setSubmitting(false); }
  };

  return <section className="mx-4 mb-4 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
    <div className="border-b border-amber-100 bg-amber-50 px-4 py-3"><div className="flex items-center justify-between gap-2"><h1 className="text-sm font-bold text-amber-950"><i className="fas fa-bullhorn mr-1.5" />公開掲示板に投稿</h1><span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-amber-700">🌍 全ユーザーに公開</span></div><p className="mt-1 text-[11px] text-amber-800">仲間募集・質問・情報共有など、新しいつながりを作る投稿の場所です。</p></div>
    <form onSubmit={submit} className="space-y-3 p-4"><label className="block text-xs font-bold text-gray-600">カテゴリ<select value={category} onChange={(e) => { setCategory(e.target.value); setGroupId(""); }} className="mt-1 block w-full rounded-lg border-gray-200 text-sm">{categories.map((item) => <option key={item}>{item}</option>)}</select></label>{category === "グループ募集" && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3"><label className="block text-xs font-bold text-blue-950">募集するグループ<select required value={groupId} onChange={(e) => setGroupId(e.target.value)} className="mt-1 block w-full rounded-lg border-blue-200 bg-white text-sm"><option value="">グループを選ぶ</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.visibility === "private" ? "🔒" : "🌍"} {group.name}</option>)}</select></label>{groups.length ? <p className="mt-2 text-[11px] text-blue-800">投稿カードに「このグループに参加する」ボタンが表示されます。</p> : <p className="mt-2 text-[11px] text-blue-800">先にグループを作ると、ここで募集できます。 <Link href="/groups" className="font-bold text-blue-700">グループを作る</Link></p>}</div>}<textarea required maxLength={2000} value={content} onChange={(e) => setContent(e.target.value.slice(0, 2000))} placeholder="例：TOEICを勉強している仲間を探しています！" className="h-24 w-full resize-none rounded-lg border border-gray-200 p-3 text-sm" /><div className="flex items-center justify-between gap-3"><label className="min-w-0 text-xs text-gray-500"><i className="far fa-image mr-1" />画像（任意）<input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} className="ml-2 max-w-[170px] text-xs" /></label><span className="shrink-0 text-[11px] text-gray-400">{content.length}/2000</span></div><button disabled={submitting} className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">{submitting ? "投稿中..." : "公開掲示板に投稿する"}</button></form>
  </section>;
}
