"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

  const items: { href: string; icon: string; label: string; customColor?: string; badge?: number }[] = [
    { href: "/", icon: "fa-home", label: "ホーム", customColor: "#f59e0b" },
    { href: "/rankings", icon: "fa-trophy", label: "ランキング", customColor: "#f472b6" },
    { href: "/analytics", icon: "fa-chart-pie", label: "分析", customColor: "#c084fc" },
    { href: "/study", icon: "fa-brain", label: "学習", customColor: "#a78bfa" },
    { href: "/shop", icon: "fa-store", label: "ショップ", customColor: "#fb923c" },
    { href: "/profile/edit", icon: "fa-user-circle", label: "プロフィール", customColor: "#34d399" },
  ];

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
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-md">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
            </div>
            <span className="nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
