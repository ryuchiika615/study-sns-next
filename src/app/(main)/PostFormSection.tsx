"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase";
import StudyTimer from "@/components/StudyTimer";
import { compressImage, insertAtCursor, notifyMentions } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import ImageCropper from "@/components/ImageCropper";
import MentionAutocomplete from "@/components/MentionAutocomplete";

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
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [silentPost, setSilentPost] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [cropIndex, setCropIndex] = useState(-1);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
  const [attachedImages, setAttachedImages] = useState<{ blob: Blob; originalUrl: string }[]>([]);
  const [subjectTemplates, setSubjectTemplates] = useState<{ id: string; name: string }[]>([]);
  const subjectRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const subjectOptions = [...subjectTemplates.map(t => t.name), ...textbooks.map(t => t.title)];
  const matchedTextbook = textbooks.find(t => t.title === subject);

  useEffect(() => {
    Promise.all([
      supabase.from("textbooks").select("id, title, total_pages, pages_completed").eq("user_id", userId),
      fetch("/api/subject-templates").then(r => r.ok ? r.json() : { data: [] }),
    ]).then(([tbRes, tmplRes]) => {
      if (tbRes.data) setTextbooks(tbRes.data);
      setSubjectTemplates(tmplRes.data || []);
    });
  }, [userId]);

  const addTemplate = async () => {
    if (!subject.trim()) return;
    const res = await fetch("/api/subject-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: subject.trim() }),
    });
    if (res.ok) {
      const { data } = await res.json();
      setSubjectTemplates(prev => [...prev.filter(t => t.name !== data.name), data]);
    }
  };

  const removeTemplate = async (id: string) => {
    await fetch(`/api/subject-templates?id=${id}`, { method: "DELETE" });
    setSubjectTemplates(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          subjectRef.current && !subjectRef.current.contains(e.target as Node)) {
        setShowSubjectDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    const imageUrls: string[] = [];
    if (beeryualResult) imageUrls.push(beeryualResult);

    for (const img of attachedImages) {
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(fileName, img.blob);
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("post-images")
          .getPublicUrl(fileName);
        if (urlData?.publicUrl) imageUrls.push(urlData.publicUrl);
      }
    }

    let audioUrl = "";
    let audioName = "";
    if (audioFile) {
      setUploadingAudio(true);
      const fileExt = audioFile.name.split(".").pop() || "mp3";
      const fileName = `post/${userId}/${Date.now()}.${fileExt}`;
      const { error: auErr } = await supabase.storage
        .from("audio-bgm")
        .upload(fileName, audioFile);
      if (!auErr) {
        const { data: urlData } = supabase.storage.from("audio-bgm").getPublicUrl(fileName);
        if (urlData?.publicUrl) {
          audioUrl = urlData.publicUrl;
          audioName = audioFile.name.replace(/\.[^/.]+$/, "").slice(0, 50);
        }
      }
      setUploadingAudio(false);
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
      p_silent: silentPost,
      p_audio_url: audioUrl || null,
      p_audio_name: audioName || null,
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
      if (pages > 0 && pages <= matchedTextbook.total_pages) {
        const added = pages - matchedTextbook.pages_completed;
        if (added > 0) {
          await supabase.from("textbook_progress_logs").insert({
            textbook_id: matchedTextbook.id, user_id: userId,
            pages_completed: added, date: studyDateVal,
          });
        }
        await supabase.from("textbooks").update({
          pages_completed: pages,
        }).eq("id", matchedTextbook.id).eq("user_id", userId);
        setTextbooks(prev => prev.map(t =>
          t.id === matchedTextbook.id ? { ...t, pages_completed: pages } : t
        ));
      }
    }

    setContent("");
    setSubject("");
    setStudyMinutes("");
    setTbPages("");
    setBeeryualResult(null);
    setSilentPost(false);
    setAudioFile(null);
    setAttachedImages([]);

    if (data?.post_id) {
      notifyMentions(data.post_id, content);
      if (!silentPost) {
        fetch("/api/push/follow-post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: data.post_id }),
        }).catch(() => {});
      }
    }

    window.dispatchEvent(new CustomEvent("post-created"));

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
          <div className="relative">
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => {
              }}
              placeholder="今日の学びを書こう"
              required
              maxLength={2000}
              className="w-full border-none outline-none text-lg resize-none h-20 pr-7"
            />
            <MentionAutocomplete textareaRef={contentRef} content={content} onChange={(v) => setContent(v)} />
            <button type="button" onClick={() => contentRef.current && insertAtCursor(contentRef.current, "@")}
              className="absolute top-0 right-0 text-gray-400 hover:text-primary bg-none border-none cursor-pointer text-sm p-1">
              ＠
            </button>
          </div>
          <p className="text-xs text-right mt-1 text-gray-400">{content.length}/2000</p>
          <div className="relative mt-2.5">
            <input
              ref={subjectRef}
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => setShowSubjectDropdown(true)}
              placeholder="科目名"
              required
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm"
            />
            {showSubjectDropdown && textbooks.length > 0 && (
              <div ref={dropdownRef}
                className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {textbooks.map(t =>
                  <button key={t.id} type="button" onClick={() => { setSubject(t.title); setShowSubjectDropdown(false); }}
                    className={`w-full text-left px-3 py-2 text-sm border-none cursor-pointer transition ${
                      subject === t.title
                        ? "bg-primary/10 text-primary font-bold"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}>
                    <span>{t.title}</span>
                    <span className="text-xs text-gray-400 ml-2">{t.pages_completed}/{t.total_pages}P</span>
                  </button>
                )}
              </div>
            )}
            {/* 科目テンプレート */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {subjectTemplates.map(t => (
                <span key={t.id} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs cursor-pointer border transition ${
                  subject === t.name
                    ? "bg-primary/15 text-primary border-primary/30 font-bold"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}>
                  <button type="button" onClick={() => setSubject(t.name)}
                    className="bg-transparent border-none cursor-pointer text-inherit p-0">
                    {t.name}
                  </button>
                  <button type="button" onClick={() => removeTemplate(t.id)}
                    className="text-gray-400 hover:text-red-500 cursor-pointer bg-transparent border-none p-0 leading-none text-[10px]"
                    title="削除">
                    <i className="fas fa-times" />
                  </button>
                </span>
              ))}
              {subject.trim() && !subjectTemplates.some(t => t.name === subject.trim()) && (
                <button type="button" onClick={addTemplate}
                  className="text-xs text-primary hover:bg-primary/10 rounded-full px-2 py-1 cursor-pointer bg-transparent border border-dashed border-primary/40"
                  title="テンプレートとして保存">
                  <i className="fas fa-plus mr-0.5" />保存
                </button>
              )}
            </div>
          </div>

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
                min={matchedTextbook.pages_completed + 1} max={matchedTextbook.total_pages}
                placeholder="現在のページ数"
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

          <div className="mt-2.5">
            <input type="file" accept="image/*" multiple className="text-sm"
              onChange={(e) => {
                const files = e.target.files;
                if (!files) return;
                const newImages = Array.from(files).map(file => ({
                  blob: file,
                  originalUrl: URL.createObjectURL(file),
                }));
                setAttachedImages(prev => [...prev, ...newImages]);
                e.target.value = "";
              }} />
            {attachedImages.length > 0 && (
              <div className="flex flex-wrap gap-3 mt-2">
                {attachedImages.map((img, i) => (
                  <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                    <img src={img.originalUrl} alt=""
                      className="w-full h-full object-cover" />
                    <div className="absolute top-1 right-1 flex gap-0.5">
                      <button type="button" onClick={() => { setCropImageUrl(img.originalUrl); setCropIndex(i); }}
                        className="w-6 h-6 bg-black/50 hover:bg-black/70 rounded text-white text-[10px] flex items-center justify-center cursor-pointer border-none">
                        <i className="fas fa-crop" />
                      </button>
                      <button type="button" onClick={() => {
                        setAttachedImages(prev => prev.filter((_, j) => j !== i));
                        URL.revokeObjectURL(img.originalUrl);
                      }}
                        className="w-6 h-6 bg-black/50 hover:bg-red-600/80 rounded text-white text-[10px] flex items-center justify-center cursor-pointer border-none">
                        <i className="fas fa-times" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100">
              <i className="fas fa-music" />
              音声ファイルを添付
              <input type="file" accept="audio/*" className="hidden"
                onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
            </label>
            {audioFile && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <i className="fas fa-check-circle" /> {audioFile.name}
                <button type="button" onClick={() => setAudioFile(null)} className="text-gray-400 hover:text-red-500 ml-1">&times;</button>
              </span>
            )}
            {uploadingAudio && <span className="text-xs text-gray-400">アップロード中...</span>}
          </div>

          <div className="flex items-center gap-2 mt-2.5">
            <BeeryualCamera userId={userId} supabase={supabase} onResult={setBeeryualResult} />
            {beeryualResult && (
              <span className="text-xs text-green-600">✓ ビーリュアル合成済み</span>
            )}
          </div>

          <div className="flex items-center justify-between mt-2.5">
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={silentPost} onChange={(e) => setSilentPost(e.target.checked)}
                className="accent-gray-400 w-3.5 h-3.5" />
              通知を送らない
            </label>
            <button type="submit" disabled={isSubmitting} className="bg-primary text-white font-bold rounded-full px-5 py-2 border-none cursor-pointer text-base disabled:opacity-50">
              リュイートする
            </button>
          </div>
        </form>
      </div>
      </div>
      {cropImageUrl && (
        <ImageCropper
          imageUrl={cropImageUrl}
          aspect={4 / 3}
          onComplete={(blob) => {
            if (cropIndex >= 0) {
              setAttachedImages(prev => prev.map((img, j) => j === cropIndex ? { ...img, blob } : img));
            }
            setCropImageUrl(null);
            setCropIndex(-1);
            setPendingCropFile(null);
          }}
          onCancel={() => {
            setCropImageUrl(null);
            setCropIndex(-1);
            setPendingCropFile(null);
          }}
        />
      )}
    </>
  );
}
