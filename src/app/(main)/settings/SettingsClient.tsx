"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { compressImage } from "@/lib/utils";
import XConnectionCard from "@/components/XConnectionCard";
import ProPlanCard from "@/components/ProPlanCard";
import LanguageSetting from "@/components/LanguageSetting";
import { useLanguage } from "@/lib/use-language";

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

export default function SettingsClient() {
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackType, setFeedbackType] = useState("feedback");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const supabase = createClient();
  const { isEnglish } = useLanguage();
  const text = (ja: string, en: string) => isEnglish ? en : ja;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <i className="fas fa-cog text-primary" /> {text("設定", "Settings")}
        </h1>

        {message && (
          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm">{message}</div>
        )}

        {sectionCard(text("SNS連携", "Social connections"), "fa-share-nodes", <XConnectionCard />)}
        {sectionCard("言語 / Language", "fa-language", <LanguageSetting />)}
        {sectionCard(text("プラン", "Plan"), "fa-crown", <ProPlanCard />)}

        {/* 要望・報告 */}
        {sectionCard(text("要望・報告", "Feedback & reports"), "fa-envelope",
          <>
            <p className="text-[10px] text-gray-500">{text("運営への要望、不具合報告、質問など", "Send requests, bug reports, or questions to the team.")}</p>
            <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={text("自由に書いてください...", "Write your message here...")}
              className="w-full rounded-lg border-gray-300 text-sm py-1.5 mt-0.5" rows={3} maxLength={1000} />
            <div className="flex items-center justify-between">
              <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)}
                className="rounded-lg border-gray-300 text-xs p-1.5">
                <option value="feedback">{text("要望", "Request")}</option>
                <option value="bug">{text("不具合報告", "Bug report")}</option>
                <option value="question">{text("質問", "Question")}</option>
                <option value="other">{text("その他", "Other")}</option>
              </select>
              <span className="text-[10px] text-gray-400">{feedbackText.length}/1000</span>
            </div>

            {imagePreview ? (
              <div className="relative inline-block">
                <img src={imagePreview} alt={text("プレビュー", "Preview")} className="max-h-40 rounded-lg border border-gray-200" />
                <button onClick={removeImage}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center cursor-pointer border-none">
                  ×
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
                <i className="fas fa-image text-gray-400" />
                <span>{text("画像を添付", "Attach image")}</span>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
            )}

            <button onClick={async () => {
              if (!feedbackText.trim()) return;
              setFeedbackSending(true);
              try {
                let imageUrl: string | null = null;
                if (imageFile) {
                  const compressed = imageFile.type.startsWith("image/")
                    ? await compressImage(imageFile).catch(() => imageFile) : imageFile;
                  const fileExt = imageFile.name.split(".").pop();
                  const fileName = `feedback/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
                  const { error: uploadError } = await supabase.storage
                    .from("post-images")
                    .upload(fileName, compressed);
                  if (!uploadError) {
                    const { data: urlData } = supabase.storage
                      .from("post-images")
                      .getPublicUrl(fileName);
                    imageUrl = urlData?.publicUrl || null;
                  }
                }

                const res = await fetch("/api/feedback", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: feedbackText, type: feedbackType, image_url: imageUrl }),
                });
                const data = await res.json();
                if (data.ok) {
                  setMessage(text("送信しました！ありがとうございます", "Sent. Thank you!"));
                  setFeedbackText("");
                  setImageFile(null);
                  setImagePreview(null);
                } else {
                  setMessage(data.error || text("送信に失敗しました", "Could not send your message."));
                }
              } catch {
                setMessage(text("送信に失敗しました", "Could not send your message."));
              }
              setFeedbackSending(false);
            }}
              disabled={!feedbackText.trim() || feedbackSending}
              className="w-full bg-gray-800 text-white font-bold rounded-full py-1.5 text-sm disabled:opacity-40 cursor-pointer">
              {feedbackSending ? text("送信中...", "Sending...") : text("送信する", "Send")}
            </button>
          </>
        )}

        <p className="text-xs text-gray-400 text-center">{text("他の設定は順次追加予定", "More settings are coming soon.")}</p>
      </div>
  );
}
