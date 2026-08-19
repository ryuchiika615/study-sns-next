"use client";

import { useEffect, useState } from "react";

export type AppLanguage = "ja" | "en";
export const LANGUAGE_STORAGE_KEY = "ryutter_language";

export function useLanguage() {
  const [language, setLanguageState] = useState<AppLanguage>("ja");

  useEffect(() => {
    const update = () => {
      const next = (localStorage.getItem(LANGUAGE_STORAGE_KEY) as AppLanguage) === "en" ? "en" : "ja";
      document.documentElement.lang = next;
      setLanguageState(next);
    };
    update();
    window.addEventListener("ryutter-language-change", update);
    return () => window.removeEventListener("ryutter-language-change", update);
  }, []);

  const setLanguage = (next: AppLanguage) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    document.documentElement.lang = next;
    setLanguageState(next);
    window.dispatchEvent(new Event("ryutter-language-change"));
  };

  return { language, setLanguage, isEnglish: language === "en" };
}
