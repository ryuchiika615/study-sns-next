"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

type Toast = {
  id: number;
  message: string;
  type: "streak" | "info" | "like" | "reply" | "follow" | "follow_post" | "gift" | "error";
  streak?: number;
  bonus?: number;
  href?: string;
};

const ToastContext = createContext<(toast: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children, unreadCount = 0 }: { children: React.ReactNode; unreadCount?: number }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => { if (toast.href) window.location.href = toast.href; }}
            className={`pointer-events-auto animate-slideDown px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-bold max-w-sm text-center ${
              toast.href ? "cursor-pointer" : ""
            } ${
              toast.type === "streak"
                ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                :               toast.type === "like"
                ? "bg-gradient-to-r from-pink-500 to-red-500"
                : toast.type === "reply"
                ? "bg-gradient-to-r from-blue-500 to-cyan-500"
                : toast.type === "gift"
                ? "bg-gradient-to-r from-purple-500 to-pink-500"
                : toast.type === "follow"
                ? "bg-gradient-to-r from-green-500 to-teal-500"
                : toast.type === "follow_post"
                ? "bg-gradient-to-r from-yellow-500 to-orange-500"
                : "bg-gradient-to-r from-gray-800 to-gray-700"
            }`}
          >
            {toast.type === "streak" && (
              <div>
                <div className="text-lg">🎉 連続{toast.streak}日目達成！</div>
                <div className="text-sm opacity-90">+{toast.bonus}pt ボーナス獲得</div>
              </div>
            )}
            {toast.type !== "streak" && <div>{toast.message}</div>}
          </div>
        ))}
      </div>

      <style jsx global>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </ToastContext.Provider>
  );
}
