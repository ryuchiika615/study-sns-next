"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const primaryItems = [
  { href: "/", icon: "fa-home", label: "ホーム", customColor: "#f59e0b" },
  { href: "/groups", icon: "fa-users", label: "グループ", customColor: "#60a5fa" },
  { href: "/tasks", icon: "fa-tasks", label: "タスク", customColor: "#4ade80" },
  { href: "/study", icon: "fa-brain", label: "学習", customColor: "#a78bfa" },
  { href: "/profile/edit", icon: "fa-user-circle", label: "プロフィール", customColor: "#34d399" },
];

const moreItems = [
  { href: "/pro", icon: "fa-crown", label: "Proメニュー", description: "計画・限定機能", customColor: "#c084fc" },
  { href: "/rankings", icon: "fa-trophy", label: "ランキング", description: "学習の成果を確認", customColor: "#f472b6" },
  { href: "/analytics", icon: "fa-chart-pie", label: "分析", description: "学習の振り返り", customColor: "#c084fc" },
  { href: "/shop", icon: "fa-store", label: "ショップ", customColor: "#fb923c" },
];

 function BottomNavInner() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = moreItems.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <nav className="bottom-nav">
      {moreOpen && <><button aria-label="メニューを閉じる" className="fixed inset-0 z-40 bg-black/40" onClick={() => setMoreOpen(false)} /><div className="bottom-more-menu"><p className="mb-2 text-center text-xs font-bold text-gray-400">その他の機能</p>{moreItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className="bottom-more-link"><i className={`fas ${item.icon}`} style={{ color: item.customColor }} /><span><b>{item.label}</b>{item.description && <small>{item.description}</small>}</span><i className="fas fa-chevron-right text-xs text-gray-500" /></Link>)}</div></>}
      {primaryItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        return (
          <Link key={item.href} href={item.href}
            className={`nav-item group ${isActive ? "active" : ""}`}>
            <div className="relative">
              <i className={`fas ${item.icon} ${isActive ? "scale-110" : ""}`}
                style={item.customColor && !isActive ? { color: item.customColor } : undefined} />
            </div>
            <span className="nav-label">{item.label}</span>
          </Link>
        );
      })}
      <button type="button" onClick={() => setMoreOpen((open) => !open)} className={`nav-item ${isMoreActive || moreOpen ? "active" : ""}`} aria-expanded={moreOpen}>
        <i className={`fas fa-ellipsis-h ${moreOpen ? "scale-110" : ""}`} style={!isMoreActive && !moreOpen ? { color: "#cbd5e1" } : undefined} />
        <span className="nav-label">その他</span>
      </button>
    </nav>
  );
}

export const BottomNav = memo(BottomNavInner);
