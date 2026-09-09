"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/lib/use-language";

const primaryItems = [
  { href: "/groups", icon: "fa-users", label: "グループ", customColor: "#60a5fa" },
  { href: "/board", icon: "fa-bullhorn", label: "掲示板", customColor: "#f59e0b" },
  { href: "/tasks", icon: "fa-tasks", label: "タスク", customColor: "#4ade80" },
  { href: "/study", icon: "fa-brain", label: "学習", customColor: "#a78bfa" },
  { href: "/profile/edit", icon: "fa-user-circle", label: "プロフィール", customColor: "#34d399" },
];

const moreItems = [
  { href: "/pro", icon: "fa-crown", label: "Proメニュー", description: "計画・限定機能", customColor: "#c084fc" },
  { href: "/rankings", icon: "fa-trophy", label: "ランキング", description: "学習の成果を確認", customColor: "#f472b6" },
  { href: "/analytics", icon: "fa-chart-pie", label: "分析", description: "学習の振り返り", customColor: "#c084fc" },
  { href: "/shop", icon: "fa-store", label: "ショップ", customColor: "#fb923c" },
  { href: "/achievements", icon: "fa-medal", label: "実績", description: "称号の文字を集める", customColor: "#facc15" },
];

 function BottomNavInner() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { isEnglish } = useLanguage();
  const label = (ja: string, en: string) => isEnglish ? en : ja;
  const isMoreActive = moreItems.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const moreText = (item: typeof moreItems[number]) => {
    if (item.href === "/pro") return { title: "Pro", description: label("計画・限定機能", "Plans & exclusive features") };
    if (item.href === "/rankings") return { title: label("ランキング", "Rankings"), description: label("学習の成果を確認", "See your learning progress") };
    if (item.href === "/analytics") return { title: label("分析", "Analytics"), description: label("学習の振り返り", "Review your progress") };
    if (item.href === "/achievements") return { title: label("実績", "Achievements"), description: label("称号の文字を集める", "Collect title letters") };
    return { title: label("ショップ", "Shop"), description: label("アイテムを見る", "Browse items") };
  };

  return (
    <nav className="bottom-nav">
      {moreOpen && <><button aria-label={label("メニューを閉じる", "Close menu")} className="fixed inset-0 z-40 bg-black/45" onClick={() => setMoreOpen(false)} /><div className="bottom-more-menu"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-black text-white">{label("その他の機能", "More features")}</p><button onClick={() => setMoreOpen(false)} className="bottom-more-close" aria-label={label("閉じる", "Close")}><i className="fas fa-xmark" /></button></div><div className="bottom-more-grid">{moreItems.map((item) => { const text = moreText(item); return <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="bottom-more-link"><i className={`fas ${item.icon}`} style={{ color: item.customColor }} /><span><b>{text.title}</b><small>{text.description}</small></span></Link>; })}</div></div></>}
      {primaryItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href}
            className={`nav-item group ${isActive ? "active" : ""}`}>
            <div className="relative">
              <i className={`fas ${item.icon} ${isActive ? "scale-110" : ""}`}
                style={item.customColor && !isActive ? { color: item.customColor } : undefined} />
            </div>
            <span className="nav-label">{item.href === "/groups" ? label("グループ", "Groups") : item.href === "/board" ? label("掲示板", "Board") : item.href === "/tasks" ? label("タスク", "Tasks") : item.href === "/study" ? label("学習", "Study") : label("プロフィール", "Profile")}</span>
          </Link>
        );
      })}
      <button type="button" onClick={() => setMoreOpen((open) => !open)} className={`nav-item ${isMoreActive || moreOpen ? "active" : ""}`} aria-expanded={moreOpen}>
        <i className={`fas fa-ellipsis-h ${moreOpen ? "scale-110" : ""}`} style={!isMoreActive && !moreOpen ? { color: "#cbd5e1" } : undefined} />
        <span className="nav-label">{label("その他", "More")}</span>
      </button>
    </nav>
  );
}

export const BottomNav = memo(BottomNavInner);
