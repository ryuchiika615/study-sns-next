"use client";

export function BottomNav({ unreadCount = 0 }: { unreadCount?: number }) {
  return (
    <nav className="bottom-nav">
      <a href="/" className="nav-item active"><i className="fas fa-home" /></a>
      <a href="/rankings" className="nav-item"><i className="fas fa-trophy" /></a>
      <a href="/analytics" className="nav-item"><i className="fas fa-chart-pie" /></a>
      <a href="/gacha" className="nav-item"><i className="far fa-calendar-check" style={{ color: "#4ade80" }} /></a>
      <a href="/notifications" className="nav-item relative">
        <i className="fas fa-bell" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
            {unreadCount}
          </span>
        )}
      </a>
      <a href="/profile/edit" className="nav-item"><i className="fas fa-user-circle text-2xl text-gray-400" /></a>
    </nav>
  );
}
