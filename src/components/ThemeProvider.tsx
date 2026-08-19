"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";
export type HomeSkin = "default" | "ocean" | "sakura" | "midnight";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
  homeSkin: HomeSkin;
  setHomeSkin: (skin: HomeSkin) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  homeSkin: "default",
  setHomeSkin: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [homeSkin, setHomeSkin] = useState<HomeSkin>("default");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ryutter_theme") as Theme | null;
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
    const storedSkin = localStorage.getItem("ryutter_home_skin") as HomeSkin | null;
    if (storedSkin === "default" || storedSkin === "ocean" || storedSkin === "sakura" || storedSkin === "midnight") setHomeSkin(storedSkin);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("ryutter_theme", theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.homeSkin = homeSkin;
    localStorage.setItem("ryutter_home_skin", homeSkin);
  }, [homeSkin, mounted]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, homeSkin, setHomeSkin }}>
      {children}
    </ThemeContext.Provider>
  );
}
