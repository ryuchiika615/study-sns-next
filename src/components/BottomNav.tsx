"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", icon: "fa-home", label: "ホーム", customColor: "#f59e0b" },
  { href: "/rankings", icon: "fa-trophy", label: "ランキング", customColor: "#f472b6" },
  { href: "/analytics", icon: "fa-chart-pie", label: "分析", customColor: "#c084fc" },
  { href: "/tasks", icon: "fa-tasks", label: "タスク", customColor: "#4ade80" },
  { href: "/study", icon: "fa-brain", label: "学習", customColor: "#a78bfa" },
  { href: "/shop", icon: "fa-store", label: "ショップ", customColor: "#fb923c" },
  { href: "/profile/edit", icon: "fa-user-circle", label: "プロフィール", customColor: "#34d399" },
];

 function BottomNavInner() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
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
    </nav>
  );
}

export const BottomNav = memo(BottomNavInner);
