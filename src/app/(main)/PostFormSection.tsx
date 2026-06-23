"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase";
import StudyTimer from "@/components/StudyTimer";
import { compressImage } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";

const BeeryualCamera = dynamic(() => import("@/components/BeeryualCamera"), { ssr: false });
const StudyPomodoro = dynamic(() => import("@/components/StudyPomodoro"), {
  ssr: false,
  loading: () => <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />,
});

export default function PostFormSection({ userId, profile }: { userId: string; profile: any }) {
  const router = useRouter();
  const supabase = createClient();
  const addToast = useToast();
  const [search, setSearch] = useState("");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [studyMinutes, setStudyMinutes] = useState("");
  const [studyDate, setStudyDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [beeryualResult, setBeeryualResult] = useState<string | null>(null);
  const [textbooks, setTextbooks] = useState<{ id: string; title: string; total_pages: number; pages_completed: number }[]>([]);
  const [tbPages, setTbPages] = useState("");

  const subjectOptions = textbooks.map(t => t.title);
  const matchedTextbook = textbooks.find(t => t.title === subject);

  useEffect(() => {
    supabase.from("textbooks").select("id, title, total_pages, pages_completed").eq("user_id", userId).then(({ data }) => {
      if (data) setTextbooks(data);
    });
  }, [userId]);

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
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
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

    if (matchedTextbook && tbPages) {
      const pages = parseInt(tbPages) || 0;
      if (pages > 0) {
        await supabase.from("textbook_progress_logs").insert({
          textbook_id: matchedTextbook.id, user_id: userId,
          pages_completed: pages, date: studyDateVal,
        });
        await supabase.from("textbooks").update({
          pages_completed: matchedTextbook.pages_completed + pages,
        }).eq("id", matchedTextbook.id).eq("user_id", userId);
        setTextbooks(prev => prev.map(t =>
          t.id === matchedTextbook.id ? { ...t, pages_completed: t.pages_completed + pages } : t
        ));
      }
    }

    setContent("");
    setSubject("");
    setStudyMinutes("");
    setTbPages("");
    setBeeryualResult(null);

    if (data?.post_id) {
      fetch("/api/push/follow-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ post_id: data.post_id }),
      }).catch(() => {});
    }

    router.refresh();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (q) {
      router.push(`/?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/");
    }
  };

  return (
    <>
      <div className="mx-4 mb-3 space-y-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <StudyTimer onStop={(m) => { setStudyMinutes(String(m)); }} />
        </div>
        <StudyPomodoro />
      </div>

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
            placeholder="科目名"
            list="subjects"
            required
            className="w-full mt-2.5 p-2.5 border border-gray-200 rounded-lg text-sm"
          />
          <datalist id="subjects">
            {subjectOptions.map(s => <option key={s} value={s} />)}
          </datalist>
          {textbooks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {textbooks.map(t =>
                <button key={t.id} type="button" onClick={() => setSubject(t.title)}
                  className={`text-xs px-2.5 py-1 rounded-full border cursor-pointer transition ${
                    subject === t.title
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-600 border-gray-200 hover:border-primary/30"
                  }`}>
                  {t.title}
                </button>
              )}
            </div>
          )}

          {matchedTextbook && (
            <div className="mt-2.5 flex gap-2 items-center">
              <span className="text-xs text-gray-500 whitespace-nowrap">
                <i className="fas fa-book mr-1" />{matchedTextbook.title}
                <span className="text-gray-400 ml-1">({matchedTextbook.pages_completed}/{matchedTextbook.total_pages}P)</span>
              </span>
              <input
                type="number"
                value={tbPages}
                onChange={(e) => setTbPages(e.target.value)}
                min={1} max={matchedTextbook.total_pages - matchedTextbook.pages_completed}
                placeholder="読了ページ"
                className="flex-1 p-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          )}

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
            <BeeryualCamera userId={userId} supabase={supabase} onResult={setBeeryualResult} />
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
    </>
  );
}
