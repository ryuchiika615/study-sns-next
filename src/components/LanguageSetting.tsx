"use client";

import { useLanguage } from "@/lib/use-language";

export default function LanguageSetting() {
  const { language, setLanguage } = useLanguage();
  return <div>
    <p className="text-sm font-bold text-gray-800">表示言語</p>
    <p className="mt-1 text-xs text-gray-500">画面のメニューを日本語または英語で表示します。翻訳に料金はかかりません。</p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button onClick={() => setLanguage("ja")} className={`rounded-xl border px-3 py-3 text-left text-sm font-bold ${language === "ja" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600"}`}><span className="block">日本語</span><small className="font-normal">Japanese</small></button>
      <button onClick={() => setLanguage("en")} className={`rounded-xl border px-3 py-3 text-left text-sm font-bold ${language === "en" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-600"}`}><span className="block">English</span><small className="font-normal">英語</small></button>
    </div>
    {language === "en" && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">Navigation is now shown in English. Posts can be opened in Google Translate when needed.</p>}
  </div>;
}
